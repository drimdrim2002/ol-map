<template>
  <div class="map-view-container">
    <div id="map" ref="mapRef"></div>
    <map-popup
      ref="mapPopup"
      :map="map"
      :point="selectedPoint"
      :header-color="headerColor"
      :available-routes="availableRoutes"
      :current-route="selectedPoint && selectedPoint.route"
      @close="handlePopupClose"
      @route-hover="highlightRoute"
      @route-hover-out="removeHighlight"
      @route-change="handleRouteChange"
    />
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
import { getRouteColor, adjustBrightness } from "../utils/colors";
import MapPopup from "./MapPopup.vue";
import "./MapView.css";

export default {
  name: "MapView",
  components: {
    MapPopup,
  },
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
      markerScale: 1,
      selectedPoint: null,
    };
  },
  computed: {
    headerColor() {
      if (!this.selectedPoint || !this.selectedPoint.route) return "#2196f3";
      return (
        this.selectedPoint.route.color ||
        getRouteColor(parseInt(this.selectedPoint.route.id) - 1)
      );
    },
    availableRoutes() {
      if (!this.selectedPoint || !this.selectedPoint.route) return [];
      return this.routes.filter(
        (route) => route.id !== this.selectedPoint.route.id
      );
    },
  },
  mounted() {
    this.initMap();
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

          this.selectedPoint = {
            ...point,
            route: currentRoute,
          };
          this.$refs.mapPopup.setPosition(coordinates);
        } else {
          this.$refs.mapPopup.setPosition(undefined);
          this.removeHighlight();
          this.selectedPoint = null;
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

        this.$refs.mapPopup.setPosition(undefined);
        this.removeHighlight();
      });
    },

    handlePopupClose() {
      const features = this.markerLayers.flatMap((layer) =>
        layer
          .getSource()
          .getFeatures()
          .filter((f) => f.get("animating"))
      );

      features.forEach((feature) => this.stopMarkerAnimation(feature));
      this.removeHighlight();
      this.selectedPoint = null;
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
        <div class="map-view-route-change">
          <select class="map-view-route-select">
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

    handleRouteChange({ point, oldRoute, newRouteId }) {
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
      // location_id를 기준으로 중복 제거
      const uniqueLocations = [];
      const locationMap = {}; // Map 객체 대신 일반 객체 사용

      route.path.forEach((point, index) => {
        if (!locationMap[point.location_id]) {
          // has 대신 객체 속성 확인
          locationMap[point.location_id] = { point, index };
          uniqueLocations.push({ point, index });
        }
      });

      const features = uniqueLocations.map(({ point, index }) => {
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
.map-view-container {
  width: 100%;
  height: 600px;
  position: relative;
}

#map {
  width: 100%;
  height: 100%;
}
</style>
