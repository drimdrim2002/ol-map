<template>
  <div id="popup" ref="popupRef" class="map-view-popup">
    <a href="#" ref="popupCloserRef" class="map-view-popup-closer"></a>
    <div ref="popupContentRef"></div>
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
  },
  data() {
    return {
      popup: null,
      popupCloser: null,
      popupContent: null,
    };
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
      this.popupCloser = this.$refs.popupCloserRef;
      this.popupContent = this.$refs.popupContentRef;

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

      this.popupCloser.onclick = () => {
        this.$emit("close");
        this.popup.setPosition(undefined);
        this.popupCloser.blur();
        return false;
      };
    },
    setPosition(coordinates) {
      if (this.popup) {
        this.popup.setPosition(coordinates);
      }
    },
    setContent(content) {
      if (this.popupContent) {
        this.popupContent.innerHTML = content;
      }
    },
  },
};
</script>

<style>
.map-view-popup {
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

.map-view-popup-content {
  padding: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.map-view-popup-header {
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

.map-view-header-text {
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: calc(100% - 48px);
  text-align: center;
}

.map-view-popup-body {
  padding: 0 24px;
  background-color: #fcfcfc;
  flex: 1;
  overflow-y: auto;
  border-radius: 8px;
}

.map-view-info-table {
  width: 100%;
  border-collapse: collapse;
  border: 2px solid #000000;
  background-color: #ffffff;
}

.map-view-info-row {
  line-height: 1.2;
  border-bottom: 2px solid #000000;
  min-height: 20px;
  max-height: 70px;
}

.map-view-info-row:last-child {
  border-bottom: none;
}

.map-view-info-label {
  font-size: 13px;
  font-weight: 600;
  color: #4a4a4a;
  letter-spacing: 0;
  vertical-align: top;
  padding: 6px 12px;
  border-right: 2px solid #000000;
  background-color: #fafafa;
  width: 150px;
}

.map-view-info-value {
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

.map-view-route-change {
  margin-top: 8px;
  background-color: #ffffff;
  border-radius: 8px;
  padding: 4px;
  margin: 8px 0 0 0;
}

.map-view-route-select {
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

.map-view-route-select:hover {
  border-color: #999;
}

.map-view-route-select:focus {
  border-color: #2196f3;
  box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
}

.map-view-popup-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 10px;
  padding: 20px 4px 0;
}

.map-view-popup-actions button {
  padding: 12px 24px;
  border-radius: 6px;
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.map-view-confirm-btn {
  background-color: #2196f3;
  color: white;
}

.map-view-confirm-btn:hover {
  background-color: #1976d2;
}

.map-view-cancel-btn {
  background-color: #f5f5f5;
  color: #4a4a4a;
  border: 1px solid #e0e0e0;
}

.map-view-cancel-btn:hover {
  background-color: #eeeeee;
}

.map-view-popup-closer {
  text-decoration: none;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
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

.map-view-popup-closer:hover {
  opacity: 1;
  color: #333;
  background-color: rgba(0, 0, 0, 0.05);
}

.map-view-popup-closer:after {
  content: "×";
  font-weight: bold;
}

/* 스크롤바 스타일 */
.map-view-route-select::-webkit-scrollbar {
  width: 8px;
}

.map-view-route-select::-webkit-scrollbar-track {
  background: #f5f5f5;
  border-radius: 4px;
}

.map-view-route-select::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 4px;
}

.map-view-route-select::-webkit-scrollbar-thumb:hover {
  background: #999;
}

/* Firefox */
.map-view-route-select {
  scrollbar-width: thin;
  scrollbar-color: #ccc #f5f5f5;
}

/* OpenLayers specific overrides that need to be global */
.ol-popup:after,
.ol-popup:before {
  display: none;
}
</style>
