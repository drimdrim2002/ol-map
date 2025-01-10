<template>
  <div class="route-filter">
    <div class="filter-group">
      <label>차량 ID:</label>
      <select v-model="selectedVehicleId" @change="applyFilters">
        <option value="">전체</option>
        <option v-for="id in vehicleIds" :key="id" :value="id">
          {{ id }}
        </option>
      </select>
    </div>
    <div class="filter-group">
      <label>차량 유형:</label>
      <select v-model="selectedVehicleType" @change="applyFilters">
        <option value="">전체</option>
        <option v-for="type in vehicleTypes" :key="type" :value="type">
          {{ type }}
        </option>
      </select>
    </div>
  </div>
</template>

<script>
export default {
  name: "RouteFilter",
  props: {
    routes: {
      type: Array,
      required: true,
    },
  },
  data() {
    return {
      selectedVehicleId: "",
      selectedVehicleType: "",
    };
  },
  computed: {
    vehicleIds() {
      return [...new Set(this.routes.map((route) => route.vehicle_id))];
    },
    vehicleTypes() {
      return [...new Set(this.routes.map((route) => route.vehicle_type))];
    },
  },
  methods: {
    applyFilters() {
      const filteredRoutes = this.routes.filter((route) => {
        const matchesId =
          !this.selectedVehicleId ||
          route.vehicle_id === this.selectedVehicleId;
        const matchesType =
          !this.selectedVehicleType ||
          route.vehicle_type === this.selectedVehicleType;
        return matchesId && matchesType;
      });

      this.$emit("filter-change", filteredRoutes);
    },
  },
};
</script>

<style scoped>
.route-filter {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  padding: 15px;
  background-color: #f5f5f5;
  border-radius: 8px;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

label {
  font-weight: bold;
  color: #333;
}

select {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  min-width: 120px;
}

select:focus {
  outline: none;
  border-color: #4285f4;
}
</style>
