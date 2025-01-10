import Vue from "vue";
import App from "./App.vue";

Vue.config.productionTip = false;

// JSON 파일을 import할 수 있도록 설정
Vue.config.devtools = true;

new Vue({
  render: (h) => h(App),
}).$mount("#app");
