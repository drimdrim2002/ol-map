<template>
  <div id="app">
    <div v-if="routes.length > 0">
      <RouteFilter :routes="routes" @filter-change="handleFilterChange" />
      <div class="route-summary">
        <h3>Route Summary</h3>
        <div
          v-for="route in displayedRoutes"
          :key="route.id"
          class="route-item"
        >
          <span
            class="route-color"
            :style="{ backgroundColor: route.color }"
          ></span>
          Vehicle {{ route.vehicle_id }} ({{ route.vehicle_type }}) -
          {{ route.path.length }} stops
        </div>
      </div>
      <MapView :routes="displayedRoutes" @update:routes="updateRoutes" />
    </div>
    <div v-else>Loading route data...</div>
  </div>
</template>

<script>
import routeData from "./assets/route-input.json";
import MapView from "./components/MapView.vue";
import RouteFilter from "./components/RouteFilter.vue";

export default {
  name: "App",
  components: {
    MapView,
    RouteFilter,
  },
  data() {
    return {
      routes: [],
      displayedRoutes: [],
    };
  },
  created() {
    this.loadRouteData();
  },
  methods: {
    loadRouteData() {
      try {
        this.routes = routeData.routes;
        this.displayedRoutes = [...this.routes];
        console.log("Route data loaded:", this.routes);
      } catch (error) {
        console.error("Error loading route data:", error);
      }
    },
    updateRoutes(newRoutes) {
      this.routes = newRoutes;
      this.displayedRoutes = [...newRoutes];
    },
    handleFilterChange(filteredRoutes) {
      this.displayedRoutes = filteredRoutes;
    },
  },
};
</script>

<style>
#app {
  font-family: Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  padding: 20px;
}

.route-summary {
  max-width: 800px;
  margin: 0 auto 20px;
  padding: 20px;
  background-color: #f5f5f5;
  border-radius: 8px;
}

.route-summary h3 {
  margin-top: 0;
  color: #333;
}

.route-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.route-color {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  margin-right: 10px;
  border: 2px solid #fff;
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.3);
}
</style>
