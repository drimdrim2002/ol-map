<template>
  <div id="popup" ref="popupRef" class="map-view-popup">
    <div class="map-view-popup-header" :style="headerStyle">
      <span class="map-view-header-text" :style="{ color: headerColor }">{{
        (point && point.vehicle_id) || "위치 정보"
      }}</span>
      <button class="map-view-popup-closer" @click="closePopup"></button>
    </div>
    <div class="map-view-popup-content">
      <div v-if="point && !point.is_warehouse" class="map-view-route-change">
        <select
          class="map-view-route-select"
          @change="handleRouteChange"
          @mouseover="handleRouteHover"
          @mouseout="handleRouteOut"
        >
          <option value="" selected disabled>경로 선택</option>
          <option
            v-for="route in availableRoutes"
            :key="route.id"
            :value="route.id"
            :style="{ backgroundColor: route.color }"
          >
            {{ route.vehicle_id }} ({{ route.vehicle_type }})
          </option>
        </select>
      </div>

      <table class="map-view-info-table">
        <tr class="map-view-info-row">
          <td class="map-view-info-label">위치 ID:</td>
          <td class="map-view-info-value" :title="point && point.location_id">
            {{ point && point.location_id }}
          </td>
        </tr>
        <tr class="map-view-info-row">
          <td class="map-view-info-label">위치 이름:</td>
          <td class="map-view-info-value" :title="point && point.name">
            {{ point && point.name }}
          </td>
        </tr>
        <tr class="map-view-info-row">
          <td class="map-view-info-label">유형:</td>
          <td
            class="map-view-info-value"
            :title="point && point.is_warehouse ? '창고' : '고객'"
          >
            {{ point && point.is_warehouse ? "창고" : "고객" }}
          </td>
        </tr>
        <tr class="map-view-info-row">
          <td class="map-view-info-label">좌표:</td>
          <td
            class="map-view-info-value"
            :title="point && `${point.lat}, ${point.lng}`"
          >
            {{ point && point.lat }}, {{ point && point.lng }}
          </td>
        </tr>
      </table>

      <div v-if="point && !point.is_warehouse" class="map-view-popup-actions">
        <button
          class="map-view-confirm-btn"
          :style="{ display: showActions ? 'inline-block' : 'none' }"
          @click="handleConfirm"
        >
          확인
        </button>
        <button
          class="map-view-cancel-btn"
          :style="{ display: showActions ? 'inline-block' : 'none' }"
          @click="handleCancel"
        >
          취소
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import Overlay from "ol/Overlay";

export default {
  name: "MapPopup",
  props: {
    map: {
      type: [Object, null],
      required: false,
      default: null,
    },
    point: {
      type: Object,
      required: false,
      default: null,
    },
    headerColor: {
      type: String,
      required: false,
      default: "#2196f3",
    },
    availableRoutes: {
      type: Array,
      required: false,
      default: () => [],
    },
    currentRoute: {
      type: Object,
      required: false,
      default: null,
    },
  },
  data() {
    return {
      popup: null,
      selectedRouteId: null,
      showActions: false,
    };
  },
  computed: {
    headerStyle() {
      return {
        borderBottom: `3px solid ${this.headerColor}`,
        backgroundColor: `${this.headerColor}20`,
      };
    },
  },
  watch: {
    map: {
      immediate: true,
      handler(newMap) {
        if (newMap) {
          this.$nextTick(() => {
            this.initPopup();
          });
        }
      },
    },
  },
  methods: {
    initPopup() {
      if (!this.map) return;

      this.popup = new Overlay({
        element: this.$refs.popupRef,
        positioning: "bottom-center",
        stopEvent: true,
        offset: [0, -10],
      });

      this.map.addOverlay(this.popup);

      let isDragging = false;
      let startPosition = null;

      const onMouseDown = (e) => {
        if (e.target.closest(".map-view-popup-header")) {
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
    },
    closePopup() {
      this.$emit("close");
      this.setPosition(undefined);
    },
    setPosition(coordinates) {
      if (this.popup) {
        this.popup.setPosition(coordinates);
      }
    },
    handleRouteChange(e) {
      this.selectedRouteId = e.target.value;
      if (
        this.selectedRouteId &&
        this.currentRoute &&
        this.selectedRouteId !== this.currentRoute.id
      ) {
        this.$emit("route-hover", this.selectedRouteId);
        this.showActions = true;
      }
    },
    handleRouteHover(e) {
      const option = e.target;
      if (option.tagName === "OPTION" && option.value && option.value !== "") {
        this.$emit("route-hover", option.value);
      }
    },
    handleRouteOut(e) {
      const option = e.target;
      if (
        option.tagName === "OPTION" &&
        (!this.selectedRouteId || option.value !== this.selectedRouteId)
      ) {
        this.$emit("route-hover-out");
      }
    },
    handleConfirm() {
      if (
        this.selectedRouteId &&
        this.currentRoute &&
        this.selectedRouteId !== this.currentRoute.id
      ) {
        this.$emit("route-change", {
          point: this.point,
          oldRoute: this.currentRoute,
          newRouteId: this.selectedRouteId,
        });
        this.closePopup();
      }
    },
    handleCancel() {
      this.selectedRouteId = null;
      this.showActions = false;
      this.$emit("route-hover-out");
    },
  },
};
</script>

<style>
.map-view-popup {
  position: absolute;
  background-color: white;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  padding: 0;
  border-radius: 12px;
  border: none;
  min-width: 320px;
  height: 300px;
  user-select: none;
  z-index: 1000;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;
  letter-spacing: -0.2px;
  overflow: hidden;
}

.map-view-popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 48px;
  padding: 0 16px;
  border-radius: 12px 12px 0 0;
  position: relative;
}

.map-view-header-text {
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: calc(100% - 48px);
  text-align: center;
}

.map-view-popup-closer {
  text-decoration: none;
  position: absolute;
  top: 0px;
  right: 8px;
  color: #666;
  font-size: 24px;
  opacity: 0.7;
  transition: all 0.2s ease;
  height: 40px;
  width: 40px;
  line-height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  cursor: pointer;
  border-radius: 50%;
  margin: 0;
  background: none;
  border: none;
  padding: 0;
}

.map-view-popup-closer:hover {
  opacity: 1;
  color: #333;
  background-color: rgba(0, 0, 0, 0.05);
}

.map-view-popup-closer:after {
  content: "×";
  font-weight: bold;
  font-size: 28px;
}

.map-view-popup-content {
  padding: 16px;
  height: calc(100% - 48px);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.map-view-info-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  background-color: #ffffff;
  margin-bottom: 16px;
}

.map-view-info-row {
  line-height: 1.5;
  border-bottom: 1px solid #dee2e6;
}

.map-view-info-row:last-child {
  border-bottom: none;
}

.map-view-info-label {
  font-size: 14px;
  font-weight: 600;
  color: #495057;
  letter-spacing: 0;
  vertical-align: middle;
  padding: 12px 16px;
  border-right: 1px solid #dee2e6;
  background-color: #f8f9fa;
  width: 120px;
}

.map-view-info-value {
  font-size: 14px;
  color: #212529;
  font-weight: 400;
  padding: 12px 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
  min-height: 20px;
}

.map-view-route-change {
  margin-top: 16px;
  background-color: #ffffff;
  border-radius: 8px;
  padding: 8px;
  border: 1px solid #dee2e6;
}

.map-view-route-select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ced4da;
  border-radius: 6px;
  font-size: 14px;
  color: #212529;
  background-color: white;
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
}

.map-view-route-select:hover {
  border-color: #adb5bd;
}

.map-view-route-select:focus {
  border-color: #86b7fe;
  box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
}

.map-view-popup-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
  padding: 8px 0 0;
}

.map-view-popup-actions button {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.map-view-confirm-btn {
  background-color: #0d6efd;
  color: white;
  border: none;
}

.map-view-confirm-btn:hover {
  background-color: #0b5ed7;
}

.map-view-cancel-btn {
  background-color: #f8f9fa;
  color: #212529;
  border: 1px solid #dee2e6;
}

.map-view-cancel-btn:hover {
  background-color: #e9ecef;
}

/* 스크롤바 스타일 */
.map-view-popup-content::-webkit-scrollbar {
  width: 8px;
}

.map-view-popup-content::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.map-view-popup-content::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

.map-view-popup-content::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* Firefox */
.map-view-popup-content {
  scrollbar-width: thin;
  scrollbar-color: #c1c1c1 #f1f1f1;
}

/* OpenLayers specific overrides that need to be global */
.ol-popup:after,
.ol-popup:before {
  display: none;
}
</style>
