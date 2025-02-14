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
import { getRouteColor, adjustBrightness } from "../utils/colors";

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

          const headerColor =
            currentRoute.color || getRouteColor(parseInt(currentRoute.id) - 1);

          let content = `
            <div class="popup-content">
              <div class="popup-header" style="border-bottom: 3px solid ${headerColor}; background-color: ${headerColor}20;">
                <span class="header-text" style="color: ${headerColor};">${
            currentRoute.vehicle_id
          }</span>
              </div>
              <div class="popup-body">
                <table class="info-table">
                  <tr class="info-row">
                    <td class="info-label">위치 ID:</td>
                    <td class="info-value" title="${point.location_id}">${
            point.location_id
          }</td>
                  </tr>
                  <tr class="info-row">
                    <td class="info-label">위치 이름:</td>
                    <td class="info-value" title="${point.name}">${
            point.name
          }</td>
                  </tr>
                  <tr class="info-row">
                    <td class="info-label">유형:</td>
                    <td class="info-value" title="${
                      point.is_warehouse ? "창고" : "고객"
                    }">${point.is_warehouse ? "창고" : "고객"}</td>
                  </tr>
                  <tr class="info-row">
                    <td class="info-label">좌표:</td>
                    <td class="info-value" title="${point.lat}, ${point.lng}">${
            point.lat
          }, ${point.lng}</td>
                  </tr>
                </table>
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
          <option value="${route.id}" style="background-color: ${
            route.color || getRouteColor(parseInt(route.id) - 1)
          };">
            ${route.vehicle_id} (${route.vehicle_type})
          </option>
        `
        )
        .join("");

      return `
        <div class="route-change">
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
        const routeColor = route.color || getRouteColor(parseInt(route.id) - 1);

        const animate = () => {
          if (!routeFeature.get("animating")) return;

          const highlightStyle = new Style({
            stroke: new Stroke({
              color: routeColor,
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

      const routeColor = route.color || getRouteColor(parseInt(route.id) - 1);

      const routeStyle = new Style({
        stroke: new Stroke({
          color: routeColor,
          width: 4,
          opacity: 1,
        }),
      });

      const highlightStyle = new Style({
        stroke: new Stroke({
          color: adjustBrightness(routeColor, 1.2),
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
      const markerColor = route.color || getRouteColor(parseInt(route.id) - 1);

      return new Style({
        image: new Circle({
          radius:
            15 * (isHighlighted ? this.markerScale * 1.2 : this.markerScale),
          fill: new Fill({
            color: point.is_warehouse ? "#000000" : markerColor,
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
    getContrastColor(hexcolor) {
      // Remove the # if present
      const hex = hexcolor.replace("#", "");

      // Convert to RGB
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);

      // Calculate luminance
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      // Return black or white depending on background luminance
      return luminance > 0.5 ? "#000000" : "#ffffff";
    },
  },
};
</script>

<style>
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
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  padding: 0 0 24px 0;
  border-radius: 8px;
  border: none;
  min-width: 320px;
  height: 300px;
  user-select: none;
  z-index: 1000;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;
  letter-spacing: -0.2px;
}

.popup-content {
  padding: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.popup-header {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 40px;
  padding: 0;
  border-bottom: 3px solid transparent;
  background-color: transparent;
  border-radius: 8px 8px 0 0;
  position: relative;
  margin-bottom: 16px;
}

.header-text {
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: calc(100% - 48px);
  text-align: center;
}

.popup-body {
  padding: 0 24px;
  background-color: #fcfcfc;
  flex: 1;
  overflow-y: auto;
  border-radius: 8px;
}

.info-table {
  width: 100%;
  border-collapse: collapse;
  border: 2px solid #000000;
  background-color: #ffffff;
}

.info-row {
  line-height: 1.2;
  border-bottom: 2px solid #000000;
  min-height: 20px;
  max-height: 70px;
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 13px;
  font-weight: 600;
  color: #4a4a4a;
  letter-spacing: 0;
  vertical-align: top;
  padding: 6px 12px;
  border-right: 2px solid #000000;
  background-color: #fafafa;
}

.info-value {
  font-size: 14px;
  color: #1a1a1a;
  font-weight: 400;
  padding: 6px 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
  min-height: 20px;
}

.drag-handle {
  color: #999;
  cursor: move;
  user-select: none;
  font-size: 18px;
  padding: 4px;
}

.route-change {
  margin-top: 8px;
  background-color: #ffffff;
  border-radius: 8px;
  padding: 4px;
  margin: 8px 0 0 0;
}

.route-change p {
  margin: 0 0 0 0;
  font-size: 14px;
  font-weight: 600;
  color: #4a4a4a;
}

.route-select {
  width: 280px;
  padding: 12px 6px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  color: #1a1a1a;
  background-color: white;
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
}

.route-select:hover {
  border-color: #999;
}

.route-select:focus {
  border-color: #2196f3;
  box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
}

.popup-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 10px;
  padding: 20px 4px 0;
}

.popup-actions button {
  padding: 12px 24px;
  border-radius: 6px;
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.confirm-btn {
  background-color: #2196f3;
  color: white;
}

.confirm-btn:hover {
  background-color: #1976d2;
}

.cancel-btn {
  background-color: #f5f5f5;
  color: #4a4a4a;
  border: 1px solid #e0e0e0;
}

.cancel-btn:hover {
  background-color: #eeeeee;
}

.ol-popup:after,
.ol-popup:before {
  display: none;
}

.ol-popup-closer {
  text-decoration: none;
  position: absolute;
  top: 0;
  right: 0;
  color: #666;
  font-size: 20px;
  opacity: 0.7;
  transition: opacity 0.2s ease;
  height: 32px;
  width: 32px;
  line-height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  cursor: pointer;
  border-radius: 50%;
  margin: 4px;
}

.ol-popup-closer:hover {
  opacity: 1;
  color: #333;
  background-color: rgba(0, 0, 0, 0.05);
}

.ol-popup-closer:after {
  content: "×";
  font-weight: bold;
}

/* 스크롤바 스타일 */
.route-select::-webkit-scrollbar {
  width: 8px;
}

.route-select::-webkit-scrollbar-track {
  background: #f5f5f5;
  border-radius: 4px;
}

.route-select::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 4px;
}

.route-select::-webkit-scrollbar-thumb:hover {
  background: #999;
}

/* Firefox */
.route-select {
  scrollbar-width: thin;
  scrollbar-color: #ccc #f5f5f5;
}
</style>
