<template>
  <div id="popup" ref="popupRef" class="map-view-popup">
    <div class="map-view-popup-header" :style="headerStyle">
      <span class="map-view-header-text" :style="{ color: headerColor }">{{
        (point && point.vehicle_id) || "위치 정보"
      }}</span>
      <button class="map-view-popup-closer" @click="closePopup"></button>
    </div>
    <div class="map-view-popup-content">
      <!-- 위치 정보 섹션 -->
      <h3 class="map-view-section-title">위치 정보</h3>
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

      <!-- 주문 목록 섹션 -->
      <div v-if="point && point.orderList && point.orderList.length > 0">
        <h3 class="map-view-section-title">주문 목록</h3>

        <!-- 주문 선택 드롭다운 -->
        <div class="map-view-order-select-container">
          <select
            class="map-view-order-select"
            v-model="selectedOrderId"
            @change="handleOrderChange"
          >
            <option value="" disabled>주문을 선택하세요</option>
            <option
              v-for="order in point.orderList"
              :key="order.order_id"
              :value="order.order_id"
            >
              주문 ID: {{ order.order_id }}
            </option>
          </select>
        </div>

        <!-- 선택된 주문 상세 정보 -->
        <div v-if="selectedOrder" class="map-view-order-details-container">
          <div class="map-view-order-item">
            <div class="map-view-order-header">
              <strong>주문 ID: {{ selectedOrder.order_id }}</strong>
            </div>
            <div class="map-view-order-details">
              <div class="map-view-order-detail">
                <span class="map-view-order-label">중량:</span>
                <span class="map-view-order-value"
                  >{{ selectedOrder.wt }}kg</span
                >
              </div>
              <div class="map-view-order-detail">
                <span class="map-view-order-label">부피:</span>
                <span class="map-view-order-value"
                  >{{ selectedOrder.vol }}㎥</span
                >
              </div>
              <div class="map-view-order-detail" v-if="selectedOrderDetails">
                <span class="map-view-order-label">도착:</span>
                <span class="map-view-order-value">{{
                  formatDateTime(selectedOrderDetails.arrDtm)
                }}</span>
              </div>
              <div class="map-view-order-detail" v-if="selectedOrderDetails">
                <span class="map-view-order-label">출발:</span>
                <span class="map-view-order-value">{{
                  formatDateTime(selectedOrderDetails.depDtm)
                }}</span>
              </div>
              <div class="map-view-order-detail" v-if="selectedOrderDetails">
                <span class="map-view-order-label">차량:</span>
                <span class="map-view-order-value">{{
                  selectedOrderDetails.vhclId
                }}</span>
              </div>
            </div>
          </div>
        </div>
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
      selectedOrderId: "",
    };
  },
  computed: {
    headerStyle() {
      return {
        borderBottom: `3px solid ${this.headerColor}`,
        backgroundColor: `${this.headerColor}20`,
      };
    },
    selectedOrder() {
      if (!this.point || !this.point.orderList || !this.selectedOrderId) {
        return null;
      }
      return this.point.orderList.find(
        (order) => order.order_id === this.selectedOrderId
      );
    },
    selectedOrderDetails() {
      if (
        !this.point ||
        !this.point.routeDetailObject ||
        !this.selectedOrderId
      ) {
        return null;
      }
      return this.point.routeDetailObject[this.selectedOrderId];
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
    point: {
      handler(newPoint) {
        if (newPoint && newPoint.orderList && newPoint.orderList.length > 0) {
          // 기본적으로 첫 번째 주문 선택
          this.selectedOrderId = newPoint.orderList[0].order_id;
        } else {
          this.selectedOrderId = "";
        }
      },
      immediate: true,
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
    handleOrderChange() {
      // 주문 변경 시 필요한 작업이 있다면 여기에 추가
    },
    formatDateTime(dateTimeStr) {
      if (!dateTimeStr) return "";

      try {
        // 날짜 형식 "2025-04-23 11:00:00" 파싱
        const [datePart, timePart] = dateTimeStr.split(" ");
        const [year, month, day] = datePart.split("-");
        const [hours, minutes] = timePart.split(":");

        return `${year}/${month}/${day} ${hours}:${minutes}`;
      } catch (e) {
        return dateTimeStr; // 파싱 실패 시 원본 문자열 반환
      }
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
  height: 400px; /* 높이 증가 */
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

.map-view-section-title {
  font-size: 15px;
  font-weight: 600;
  color: #343a40;
  margin: 0 0 8px 0;
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

.map-view-order-select-container {
  margin-bottom: 16px;
}

.map-view-order-select {
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

.map-view-order-select:hover {
  border-color: #adb5bd;
}

.map-view-order-select:focus {
  border-color: #86b7fe;
  box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
}

.map-view-orders-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 200px;
  overflow-y: auto;
}

.map-view-order-item {
  border: 1px solid #dee2e6;
  border-radius: 8px;
  background-color: #ffffff;
  overflow: hidden;
}

.map-view-order-header {
  background-color: #f8f9fa;
  padding: 8px 12px;
  border-bottom: 1px solid #dee2e6;
  font-size: 14px;
}

.map-view-order-details {
  padding: 10px 12px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.map-view-order-detail {
  display: flex;
  flex-direction: column;
  font-size: 13px;
}

.map-view-order-label {
  color: #6c757d;
  margin-bottom: 2px;
}

.map-view-order-value {
  font-weight: 500;
  color: #212529;
}

/* 스크롤바 스타일 */
.map-view-popup-content::-webkit-scrollbar,
.map-view-orders-container::-webkit-scrollbar {
  width: 8px;
}

.map-view-popup-content::-webkit-scrollbar-track,
.map-view-orders-container::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.map-view-popup-content::-webkit-scrollbar-thumb,
.map-view-orders-container::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

.map-view-popup-content::-webkit-scrollbar-thumb:hover,
.map-view-orders-container::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* Firefox */
.map-view-popup-content,
.map-view-orders-container {
  scrollbar-width: thin;
  scrollbar-color: #c1c1c1 #f1f1f1;
}

/* OpenLayers specific overrides that need to be global */
.ol-popup:after,
.ol-popup:before {
  display: none;
}
</style>
