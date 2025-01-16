<template>
  <div class="map-container">
    <div id="map" ref="mapRef"></div>
    <div id="popup" ref="popupRef" class="ol-popup">
      <a href="#" ref="popupCloserRef" class="ol-popup-closer"></a>
      <div ref="popupContentRef"></div>
    </div>
  </div>
</template>

<script>
import "ol/ol.css";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import { fromLonLat } from "ol/proj";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { Feature } from "ol";
import { LineString, Point } from "ol/geom";
import { Style, Stroke, Circle, Fill, Text } from "ol/style";
import Overlay from "ol/Overlay";

export default {
  name: "MapView",
  props: {
    routes: {
      type: Array,
      required: true,
    },
  },
  data() {
    return {
      map: null,
      routeLayers: [],
      markerLayers: [],
      popup: null,
      popupCloser: null,
      popupContent: null,
      markerScale: 1,
    };
  },
  mounted() {
    this.initMap();
    this.initPopup();

    this.markerScale = 1.5;
    setTimeout(() => {
      this.markerScale = 1.2;
      this.updateRoutes();
    }, 500);
  },
  watch: {
    routes: {
      handler: "updateRoutes",
      deep: true,
    },
    markerScale: {
      handler: "updateRoutes",
      immediate: false,
    },
  },
  methods: {
    initMap() {
      this.map = new Map({
        target: this.$refs.mapRef,
        layers: [
          new TileLayer({
            source: new OSM(),
          }),
        ],
        view: new View({
          center: fromLonLat([126.978, 37.5665]),
          zoom: 12,
        }),
      });

      let isDragging = false;
      let draggedFeature = null;
      let hoveredRoute = null;
      let dragStartPosition = null;

      this.map.on("pointermove", (evt) => {
        if (isDragging && draggedFeature) {
          evt.preventDefault();
          evt.stopPropagation();
          draggedFeature.getGeometry().setCoordinates(evt.coordinate);

          // Check if dragged marker is over any route
          const routeFeatures = this.routeLayers.map(
            (layer) => layer.getSource().getFeatures()[0]
          );
          let closestRoute = null;
          let minDistance = Infinity;

          const currentRoute = draggedFeature.get("route");

          routeFeatures.forEach((routeFeature) => {
            // Skip if it's the current route
            if (routeFeature.get("route").id === currentRoute.id) {
              return;
            }

            const lineString = routeFeature.getGeometry();
            const closestPoint = lineString.getClosestPoint(evt.coordinate);
            const distance = Math.sqrt(
              Math.pow(closestPoint[0] - evt.coordinate[0], 2) +
                Math.pow(closestPoint[1] - evt.coordinate[1], 2)
            );

            if (distance < minDistance && distance < 20) {
              minDistance = distance;
              closestRoute = routeFeature;
            }
          });

          // Highlight the closest route
          if (closestRoute !== hoveredRoute) {
            if (hoveredRoute) {
              hoveredRoute.setStyle(hoveredRoute.get("normalStyle"));
            }
            if (closestRoute) {
              closestRoute.setStyle(closestRoute.get("highlightStyle"));
            }
            hoveredRoute = closestRoute;
          }
        }
      });

      this.map.on("pointerdown", (evt) => {
        const feature = this.map.forEachFeatureAtPixel(
          evt.pixel,
          (feature) => feature,
          {
            hitTolerance: 5,
          }
        );

        if (
          feature &&
          feature.get("point") &&
          !feature.get("point").is_warehouse
        ) {
          isDragging = true;
          draggedFeature = feature;
          dragStartPosition = feature.getGeometry().getCoordinates();
          evt.preventDefault();
          evt.stopPropagation();
          this.map.getTargetElement().style.cursor = "grabbing";
        }
      });

      this.map.on("pointerup", () => {
        if (isDragging && draggedFeature) {
          if (hoveredRoute) {
            const point = draggedFeature.get("point");
            const currentRoute = draggedFeature.get("route");
            const newRoute = hoveredRoute.get("route");

            if (newRoute.id !== currentRoute.id) {
              // Remove point from current route
              const oldRouteIndex = this.routes.findIndex(
                (r) => r.id === currentRoute.id
              );
              if (oldRouteIndex !== -1) {
                const pointIndex = this.routes[oldRouteIndex].path.findIndex(
                  (p) => p.location_id === point.location_id
                );
                if (pointIndex !== -1) {
                  this.routes[oldRouteIndex].path.splice(pointIndex, 1);
                }
              }

              // Add point to the end of new route
              const newRouteIndex = this.routes.findIndex(
                (r) => r.id === newRoute.id
              );
              if (newRouteIndex !== -1) {
                this.routes[newRouteIndex].path.push(point);
              }

              // Emit updated routes
              const updatedRoutes = [...this.routes];
              this.$emit("update:routes", updatedRoutes);
            } else {
              // If not dropped on a new route, return to original position
              draggedFeature.getGeometry().setCoordinates(dragStartPosition);
            }

            hoveredRoute.setStyle(hoveredRoute.get("normalStyle"));
            hoveredRoute = null;
          } else {
            // If not dropped on any route, return to original position
            draggedFeature.getGeometry().setCoordinates(dragStartPosition);
          }
        }

        isDragging = false;
        draggedFeature = null;
        dragStartPosition = null;
        this.map.getTargetElement().style.cursor = "";
      });

      this.map.getViewport().addEventListener("contextmenu", (evt) => {
        evt.preventDefault();

        const pixel = this.map.getEventPixel(evt);
        const feature = this.map.forEachFeatureAtPixel(
          pixel,
          (feature) => feature
        );

        if (feature && feature.get("point")) {
          this.removeHighlight();
          this.animateMarker(feature);

          const point = feature.get("point");
          const currentRoute = feature.get("route");
          const coordinates = feature.getGeometry().getCoordinates();

          const routeOptions = point.is_warehouse
            ? ""
            : this.getRouteOptionsHtml(currentRoute);

          let content = `
            <div class="popup-content">
              <div class="popup-header">
                <h4>${point.name}</h4>
                <div class="drag-handle">⋮⋮</div>
              </div>
              <p>위치 ID: ${point.location_id}</p>
              <p>유형: ${point.is_warehouse ? "창고" : "고객"}</p>
              <p>좌표: ${point.lat}, ${point.lng}</p>
              ${routeOptions}
              ${
                !point.is_warehouse
                  ? `
                <div class="popup-actions">
                  <button class="confirm-btn" style="display: none;">확인</button>
                  <button class="cancel-btn" style="display: none;">취소</button>
                </div>
              `
                  : ""
              }
            </div>
          `;

          this.popupContent.innerHTML = content;
          this.popup.setPosition(coordinates);

          if (!point.is_warehouse) {
            const routeSelect =
              this.popupContent.querySelector(".route-select");
            const confirmBtn = this.popupContent.querySelector(".confirm-btn");
            const cancelBtn = this.popupContent.querySelector(".cancel-btn");
            let selectedRouteId = null;

            routeSelect.addEventListener("change", (e) => {
              selectedRouteId = e.target.value;
              if (selectedRouteId && selectedRouteId !== currentRoute.id) {
                this.highlightRoute(selectedRouteId);
                confirmBtn.style.display = "inline-block";
                cancelBtn.style.display = "inline-block";
              }
            });

            confirmBtn.addEventListener("click", () => {
              if (selectedRouteId && selectedRouteId !== currentRoute.id) {
                this.changePointRoute(point, currentRoute, selectedRouteId);
                this.popup.setPosition(undefined);
                this.removeHighlight();
              }
            });

            cancelBtn.addEventListener("click", () => {
              routeSelect.value = "";
              this.removeHighlight();
              confirmBtn.style.display = "none";
              cancelBtn.style.display = "none";
            });

            routeSelect.addEventListener("mouseover", (e) => {
              const option = e.target;
              if (
                option.tagName === "OPTION" &&
                option.value &&
                option.value !== ""
              ) {
                this.highlightRoute(option.value);
              }
            });

            routeSelect.addEventListener("mouseout", (e) => {
              const option = e.target;
              if (
                option.tagName === "OPTION" &&
                (!selectedRouteId || option.value !== selectedRouteId)
              ) {
                this.removeHighlight();
              }
            });
          }
        } else {
          this.popup.setPosition(undefined);
          this.removeHighlight();
        }
      });

      this.map.on("click", () => {
        const features = this.markerLayers.flatMap((layer) =>
          layer
            .getSource()
            .getFeatures()
            .filter((f) => f.get("animating"))
        );

        features.forEach((feature) => this.stopMarkerAnimation(feature));

        this.popup.setPosition(undefined);
        this.removeHighlight();
      });
    },
    initPopup() {
      this.popup = new Overlay({
        element: this.$refs.popupRef,
        positioning: "bottom-center",
        stopEvent: true,
        offset: [0, -10],
      });

      this.map.addOverlay(this.popup);
      this.popupCloser = this.$refs.popupCloserRef;
      this.popupContent = this.$refs.popupContentRef;

      let isDragging = false;
      let startPosition = null;

      const onMouseDown = (e) => {
        if (e.target.closest(".popup-header")) {
          isDragging = true;
          this.$refs.popupRef.style.position = "absolute";
          startPosition = {
            x: e.clientX - this.$refs.popupRef.offsetLeft,
            y: e.clientY - this.$refs.popupRef.offsetTop,
          };
          e.preventDefault();
          e.stopPropagation();
        }
      };

      const onMouseMove = (e) => {
        if (isDragging) {
          this.$refs.popupRef.style.left = `${e.clientX - startPosition.x}px`;
          this.$refs.popupRef.style.top = `${e.clientY - startPosition.y}px`;
          e.preventDefault();
          e.stopPropagation();
        }
      };

      const onMouseUp = () => {
        isDragging = false;
      };

      this.$refs.popupRef.addEventListener("mousedown", onMouseDown);
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);

      this.$once("hook:beforeDestroy", () => {
        this.$refs.popupRef.removeEventListener("mousedown", onMouseDown);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      });

      this.popupCloser.onclick = () => {
        const features = this.markerLayers.flatMap((layer) =>
          layer
            .getSource()
            .getFeatures()
            .filter((f) => f.get("animating"))
        );

        features.forEach((feature) => this.stopMarkerAnimation(feature));

        this.popup.setPosition(undefined);
        this.popupCloser.blur();
        this.removeHighlight();
        return false;
      };
    },

    getRouteOptionsHtml(currentRoute) {
      const options = this.routes
        .filter((route) => route.id !== currentRoute.id)
        .map(
          (route) => `
          <option value="${route.id}" style="background-color: ${route.color}; color: white;">
            ${route.vehicle_id} (${route.vehicle_type})
          </option>
        `
        )
        .join("");

      return `
        <div class="route-change">
          <p>경로 변경:</p>
          <select class="route-select">
            <option value="" selected disabled>경로 선택</option>
            ${options}
          </select>
        </div>
      `;
    },

    highlightRoute(routeId) {
      console.log("animation invoke:", routeId);

      this.routeLayers.forEach((layer) => {
        const routeFeature = layer.getSource().getFeatures()[0];
        routeFeature.setStyle(routeFeature.get("normalStyle"));
        routeFeature.set("animating", false);
      });

      const routeLayer = this.routeLayers.find(
        (layer) =>
          layer.getSource().getFeatures()[0].get("route").id === routeId
      );

      if (routeLayer) {
        const routeFeature = routeLayer.getSource().getFeatures()[0];
        const route = routeFeature.get("route");

        const animate = () => {
          if (!routeFeature.get("animating")) return;

          const highlightStyle = new Style({
            stroke: new Stroke({
              color: route.color,
              width: 6 + Math.sin(performance.now() / 200) * 2,
              lineDash: [10, 10],
              lineDashOffset: (performance.now() / 50) % 20,
            }),
          });

          routeFeature.setStyle(highlightStyle);
          requestAnimationFrame(animate);
        };

        routeFeature.set("animating", true);
        animate();
      }
    },

    removeHighlight() {
      this.routeLayers.forEach((layer) => {
        const routeFeature = layer.getSource().getFeatures()[0];
        routeFeature.set("animating", false);
        routeFeature.setStyle(routeFeature.get("normalStyle"));
      });
    },

    changePointRoute(point, oldRoute, newRouteId) {
      const oldRouteIndex = this.routes.findIndex((r) => r.id === oldRoute.id);
      if (oldRouteIndex !== -1) {
        const pointIndex = this.routes[oldRouteIndex].path.findIndex(
          (p) => p.location_id === point.location_id
        );
        if (pointIndex !== -1) {
          this.routes[oldRouteIndex].path.splice(pointIndex, 1);
        }
      }

      const newRoute = this.routes.find((r) => r.id === newRouteId);
      if (newRoute) {
        newRoute.path.push({
          ...point,
          lat: point.lat,
          lng: point.lng,
        });

        const updatedRoutes = [...this.routes];
        this.$emit("update:routes", updatedRoutes);
      }
    },
    updateRoutes() {
      this.routeLayers.forEach((layer) => this.map.removeLayer(layer));
      this.markerLayers.forEach((layer) => this.map.removeLayer(layer));
      this.routeLayers = [];
      this.markerLayers = [];

      this.routes.forEach((route) => {
        this.createRouteLayer(route);
        this.createMarkerLayer(route);
      });
    },
    createRouteLayer(route) {
      const coordinates = route.path.map((point) =>
        fromLonLat([point.lng, point.lat])
      );

      const routeFeature = new Feature({
        geometry: new LineString(coordinates),
        route: route,
      });

      const routeStyle = new Style({
        stroke: new Stroke({
          color: route.color,
          width: 4,
          opacity: 1,
        }),
      });

      const highlightStyle = new Style({
        stroke: new Stroke({
          color: route.color,
          width: 6,
          opacity: 0.8,
          lineDash: [10, 10],
          lineDashOffset: 0,
        }),
      });

      routeFeature.setStyle(routeStyle);
      routeFeature.set("normalStyle", routeStyle);
      routeFeature.set("highlightStyle", highlightStyle);
      routeFeature.set("animating", false);

      const vectorLayer = new VectorLayer({
        source: new VectorSource({
          features: [routeFeature],
        }),
        zIndex: 1,
      });

      this.map.addLayer(vectorLayer);
      this.routeLayers.push(vectorLayer);
    },
    createMarkerStyle(point, route, index, isHighlighted = false) {
      return new Style({
        image: new Circle({
          radius:
            15 * (isHighlighted ? this.markerScale * 1.2 : this.markerScale),
          fill: new Fill({
            color: point.is_warehouse ? "#000000" : route.color,
          }),
          stroke: new Stroke({
            color: "#ffffff",
            width: isHighlighted ? 4 : 3,
          }),
        }),
        text: new Text({
          text: `${index + 1}`,
          fill: new Fill({
            color: "#ffffff",
          }),
          font: `bold ${
            14 * (isHighlighted ? this.markerScale * 1.2 : this.markerScale)
          }px Arial`,
          textAlign: "center",
          textBaseline: "middle",
        }),
      });
    },
    animateMarker(feature) {
      if (!feature) return;

      const point = feature.get("point");
      const route = feature.get("route");
      const index = feature.get("index");
      let scale = 1;
      let increasing = true;

      const animate = () => {
        if (!feature.get("animating")) return;

        if (increasing) {
          scale += 0.03;
          if (scale >= 1.2) increasing = false;
        } else {
          scale -= 0.03;
          if (scale <= 1) increasing = true;
        }

        const style = this.createMarkerStyle(point, route, index, true);
        style.getImage().setScale(scale);
        feature.setStyle(style);

        requestAnimationFrame(animate);
      };

      feature.set("animating", true);
      animate();
    },
    stopMarkerAnimation(feature) {
      if (!feature) return;

      feature.set("animating", false);
      const point = feature.get("point");
      const route = feature.get("route");
      const index = feature.get("index");

      feature.setStyle(this.createMarkerStyle(point, route, index));
    },
    createMarkerLayer(route) {
      const features = route.path.map((point, index) => {
        const feature = new Feature({
          geometry: new Point(fromLonLat([point.lng, point.lat])),
          point: point,
          route: route,
          index: index,
        });

        feature.setStyle(this.createMarkerStyle(point, route, index));
        return feature;
      });

      const vectorLayer = new VectorLayer({
        source: new VectorSource({
          features: features,
        }),
        zIndex: 2,
      });

      this.map.addLayer(vectorLayer);
      this.markerLayers.push(vectorLayer);
    },
  },
};
</script>

<style scoped>
.map-container {
  width: 100%;
  height: 600px;
  position: relative;
}

#map {
  width: 100%;
  height: 100%;
}

.ol-popup {
  position: absolute;
  background-color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  padding: 0;
  border-radius: 8px;
  border: 1px solid #ddd;
  min-width: 220px;
  user-select: none;
  z-index: 1000;
  font-size: 12px;
}

.popup-content {
  padding: 10px;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: move;
  background-color: #f5f5f5;
  border-radius: 8px 8px 0 0;
  padding: 8px 12px;
  margin: 0;
  border-bottom: 1px solid #ddd;
  touch-action: none;
}

.popup-header:hover {
  background-color: #eee;
}

.popup-header h4 {
  margin: 0;
  flex: 1;
  pointer-events: none;
  font-size: 14px;
}

.drag-handle {
  color: #666;
  cursor: move;
  user-select: none;
  padding: 0 5px;
  pointer-events: none;
}

.popup-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #eee;
}

.popup-actions button {
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid #ddd;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.3s ease;
}

.confirm-btn {
  background-color: #4caf50;
  color: white;
  border-color: #4caf50 !important;
}

.confirm-btn:hover {
  background-color: #45a049;
}

.cancel-btn {
  background-color: white;
  color: #666;
}

.cancel-btn:hover {
  background-color: #f5f5f5;
}

.ol-popup:after,
.ol-popup:before {
  top: 100%;
  border: solid transparent;
  content: " ";
  height: 0;
  width: 0;
  position: absolute;
  pointer-events: none;
}

.ol-popup:after {
  border-top-color: white;
  border-width: 10px;
  left: 48px;
  margin-left: -10px;
}

.ol-popup:before {
  border-top-color: #cccccc;
  border-width: 11px;
  left: 48px;
  margin-left: -11px;
}

.ol-popup-closer {
  text-decoration: none;
  position: absolute;
  top: 2px;
  right: 8px;
}

.ol-popup-closer:after {
  content: "✖";
}

.popup-content h4 {
  margin: 0 0 10px 0;
  color: #333;
}

.popup-content p {
  margin: 3px 0;
  color: #666;
  font-size: 12px;
}

.route-change {
  margin-top: 15px;
}

.route-change p {
  margin-bottom: 3px;
  font-weight: bold;
  font-size: 12px;
}

.route-select {
  width: 100%;
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 12px;
  cursor: pointer;
  outline: none;
  transition: all 0.3s ease;
}

.route-select:hover {
  border-color: #999;
}

.route-select:focus {
  border-color: #666;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.1);
}

.route-select option {
  padding: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.route-select option:first-child {
  background-color: white !important;
  color: #666;
}

.route-select option:not(:first-child) {
  color: white;
}

.route-select option:hover {
  filter: brightness(90%);
}

.route-select option:checked {
  filter: brightness(85%);
}

.route-select:focus option:hover {
  background-color: rgba(0, 0, 0, 0.1);
}
</style>
