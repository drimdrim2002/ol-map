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
        stopEvent: true,
        offset: [0, -10],
      });

      this.map.addOverlay(this.popup);
      this.popupCloser = this.$refs.popupCloserRef;
      this.popupContent = this.$refs.popupContentRef;

      // 팝업 드래그 기능 추가
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

      // 이벤트 리스너 등록
      this.$refs.popupRef.addEventListener("mousedown", onMouseDown);
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);

      // 컴포넌트가 제거될 때 이벤트 리스너 제거
      this.$once("hook:beforeDestroy", () => {
        this.$refs.popupRef.removeEventListener("mousedown", onMouseDown);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      });

      this.popupCloser.onclick = () => {
        this.popup.setPosition(undefined);
        this.popupCloser.blur();
        this.removeHighlight();
        return false;
      };

      this.map.on("click", (evt) => {
        const feature = this.map.forEachFeatureAtPixel(
          evt.pixel,
          (feature) => feature
        );

        if (feature && feature.get("point")) {
          this.removeHighlight();

          const point = feature.get("point");
          const currentRoute = feature.get("route");
          const coordinates = feature.getGeometry().getCoordinates();

          // 창고가 아닌 경우에만 경로 변경 옵션 표시
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

          // 경로 변경 이벤트 리스너 추가
          if (!point.is_warehouse) {
            const routeSelect =
              this.popupContent.querySelector(".route-select");
            const confirmBtn = this.popupContent.querySelector(".confirm-btn");
            const cancelBtn = this.popupContent.querySelector(".cancel-btn");
            let selectedRouteId = null;

            // 드롭다운 변경 시 경로 하이라이트 및 버튼 표시
            routeSelect.addEventListener("change", (e) => {
              selectedRouteId = e.target.value;
              if (selectedRouteId && selectedRouteId !== currentRoute.id) {
                this.highlightRoute(selectedRouteId);
                confirmBtn.style.display = "inline-block";
                cancelBtn.style.display = "inline-block";
              }
            });

            // 확인 버튼 클릭
            confirmBtn.addEventListener("click", () => {
              if (selectedRouteId && selectedRouteId !== currentRoute.id) {
                this.changePointRoute(point, currentRoute, selectedRouteId);
                this.popup.setPosition(undefined);
                this.removeHighlight();
              }
            });

            // 취소 버튼 클릭
            cancelBtn.addEventListener("click", () => {
              routeSelect.value = "";
              this.removeHighlight();
              confirmBtn.style.display = "none";
              cancelBtn.style.display = "none";
            });

            // 옵션에 마우스 오버 시 경로 하이라이트
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

            // 옵션에서 마우스 아웃 시 하이라이트 제거
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
    },

    // 경로 옵션 HTML 생성
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

    // 경로 하이라이트 애니메이션
    highlightRoute(routeId) {
      console.log("animation invoke:", routeId);

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
            text: `${index + 1}`,
            fill: new Fill({
              color: "#ffffff",
            }),
            font: `bold ${14 * this.markerScale}px Arial`,
            textAlign: "center",
            textBaseline: "middle",
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
