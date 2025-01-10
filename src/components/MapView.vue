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
          center: fromLonLat([126.978, 37.5665]), // 서울시청 중심
          zoom: 12,
        }),
      });
    },
    initPopup() {
      this.popup = new Overlay({
        element: this.$refs.popupRef,
        positioning: "bottom-center",
        stopEvent: false,
        offset: [0, -10],
      });

      this.map.addOverlay(this.popup);
      this.popupCloser = this.$refs.popupCloserRef;
      this.popupContent = this.$refs.popupContentRef;

      this.popupCloser.onclick = () => {
        this.popup.setPosition(undefined);
        this.popupCloser.blur();
        return false;
      };

      this.map.on("click", (evt) => {
        const feature = this.map.forEachFeatureAtPixel(
          evt.pixel,
          (feature) => feature
        );

        if (feature && feature.get("point")) {
          const point = feature.get("point");
          const currentRoute = feature.get("route");
          const coordinates = feature.getGeometry().getCoordinates();

          // 창고가 아닌 경우에만 경로 변경 옵션 표시
          const routeOptions = point.is_warehouse
            ? ""
            : this.getRouteOptionsHtml(currentRoute);

          let content = `
            <div class="popup-content">
              <h4>${point.name}</h4>
              <p>위치 ID: ${point.location_id}</p>
              <p>유형: ${point.is_warehouse ? "창고" : "고객"}</p>
              <p>좌표: ${point.lat}, ${point.lng}</p>
              ${routeOptions}
            </div>
          `;

          this.popupContent.innerHTML = content;
          this.popup.setPosition(coordinates);

          // 경로 변경 이벤트 리스너 추가
          if (!point.is_warehouse) {
            const routeOptions =
              this.popupContent.querySelectorAll(".route-option");
            routeOptions.forEach((option) => {
              // 마우스 오버 시 경로 하이라이트
              option.addEventListener("mouseenter", () => {
                const routeId = option.dataset.routeId;
                this.highlightRoute(routeId);
              });

              // 마우스 아웃 시 하이라이트 제거
              option.addEventListener("mouseleave", () => {
                this.removeHighlight();
              });

              // 클릭 시 경로 변경
              option.addEventListener("click", () => {
                const newRouteId = option.dataset.routeId;
                if (newRouteId && newRouteId !== currentRoute.id) {
                  this.changePointRoute(point, currentRoute, newRouteId);
                  this.popup.setPosition(undefined);
                }
              });
            });
          }
        }
      });
    },

    // 경로 옵션 HTML 생성
    getRouteOptionsHtml(currentRoute) {
      const options = this.routes
        .filter((route) => route.id !== currentRoute.id)
        .map(
          (route) => `
          <div class="route-option" data-route-id="${route.id}">
            <div class="route-color" style="background-color: ${route.color}"></div>
            <div class="route-info">
              ${route.vehicle_id} (${route.vehicle_type})
            </div>
          </div>
        `
        )
        .join("");

      return `
        <div class="route-change">
          <p>경로 변경:</p>
          <div class="route-options">
            ${options}
          </div>
        </div>
      `;
    },

    // 경로 하이라이트 애니메이션
    highlightRoute(routeId) {
      // 모든 경로 스타일 초기화
      this.routeLayers.forEach((layer) => {
        const routeFeature = layer.getSource().getFeatures()[0];
        routeFeature.setStyle(routeFeature.get("normalStyle"));
        routeFeature.set("animating", false);
      });

      // 선택된 경로 하이라이트
      const routeLayer = this.routeLayers.find(
        (layer) =>
          layer.getSource().getFeatures()[0].get("route").id === routeId
      );

      if (routeLayer) {
        const routeFeature = routeLayer.getSource().getFeatures()[0];
        const highlightStyle = new Style({
          stroke: new Stroke({
            color: routeFeature.get("route").color,
            width: 6,
            opacity: 0.8,
            lineDash: [10, 10],
            lineDashOffset: 0,
          }),
        });

        const animate = () => {
          if (!routeFeature.get("animating")) return;

          const offset = (performance.now() / 50) % 20;
          highlightStyle.getStroke().setLineDashOffset(offset);
          routeFeature.setStyle(highlightStyle);
          requestAnimationFrame(animate);
        };

        routeFeature.set("animating", true);
        animate();
      }
    },

    // 경로 하이라이트 제거
    removeHighlight() {
      this.routeLayers.forEach((layer) => {
        const routeFeature = layer.getSource().getFeatures()[0];
        routeFeature.set("animating", false);
        routeFeature.setStyle(routeFeature.get("normalStyle"));
      });
    },

    // 포인트의 경로 변경
    changePointRoute(point, oldRoute, newRouteId) {
      // 기존 경로에서 포인트 제거
      const oldRouteIndex = this.routes.findIndex((r) => r.id === oldRoute.id);
      if (oldRouteIndex !== -1) {
        const pointIndex = this.routes[oldRouteIndex].path.findIndex(
          (p) => p.location_id === point.location_id
        );
        if (pointIndex !== -1) {
          this.routes[oldRouteIndex].path.splice(pointIndex, 1);
        }
      }

      // 새 경로에 포인트 추가
      const newRoute = this.routes.find((r) => r.id === newRouteId);
      if (newRoute) {
        newRoute.path.push({
          ...point,
          lat: point.lat,
          lng: point.lng,
        });

        // 경로 업데이트
        const updatedRoutes = [...this.routes];
        this.$emit("update:routes", updatedRoutes);
      }
    },
    updateRoutes() {
      this.routeLayers.forEach((layer) => this.map.removeLayer(layer));
      this.markerLayers.forEach((layer) => this.map.removeLayer(layer));
      this.routeLayers = [];
      this.markerLayers = [];

      // 각 경로에 대해 레이어 생성
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
    createMarkerLayer(route) {
      const features = route.path.map((point, index) => {
        const feature = new Feature({
          geometry: new Point(fromLonLat([point.lng, point.lat])),
          point: point,
          route: route,
          index: index,
        });

        const style = new Style({
          image: new Circle({
            radius: 15 * this.markerScale,
            fill: new Fill({
              color: point.is_warehouse ? "#000000" : route.color,
            }),
            stroke: new Stroke({
              color: "#ffffff",
              width: 3,
            }),
          }),
          text: new Text({
            text: point.name,
            fill: new Fill({
              color: "#000000",
            }),
            stroke: new Stroke({
              color: "#ffffff",
              width: 3,
            }),
            font: `${12 * this.markerScale}px Arial`,
            offsetY: -20,
            textAlign: "center",
            textBaseline: "bottom",
          }),
        });

        feature.setStyle(style);
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
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  padding: 15px;
  border-radius: 10px;
  border: 1px solid #cccccc;
  bottom: 12px;
  left: -50px;
  min-width: 200px;
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
  font-size: 16px;
}

.ol-popup-closer:after {
  content: "✖";
}

.popup-content {
  font-size: 14px;
}

.popup-content h4 {
  margin: 0 0 10px 0;
  color: #333;
}

.popup-content p {
  margin: 5px 0;
  color: #666;
}

.route-change {
  margin-top: 15px;
  padding-top: 10px;
  border-top: 1px solid #eee;
}

.route-change p {
  margin-bottom: 8px;
  font-weight: bold;
  color: #333;
}

.route-select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 14px;
  color: #333;
  cursor: pointer;
}

.route-select:focus {
  outline: none;
  border-color: #4285f4;
}

.route-select option {
  padding: 8px;
  font-size: 14px;
  background-color: white;
}

.route-select option:hover {
  background-color: #f5f5f5;
}

.route-select option:checked {
  background-color: #e8f0fe;
  color: #1a73e8;
}

.route-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.route-option {
  display: flex;
  align-items: center;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: white;
}

.route-option:hover {
  background-color: #f5f5f5;
  border-color: #4285f4;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.route-color {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  margin-right: 10px;
  border: 2px solid #fff;
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.3);
}

.route-info {
  flex: 1;
  color: #333;
  font-size: 14px;
}
</style>
