import { createApp } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";

import { GraffitiDecentralized } from "@graffiti-garden/implementation-decentralized";
import { GraffitiPlugin } from "@graffiti-garden/wrapper-vue";

import Home from "./pages/Home.js";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", component: Home },
  ],
});

createApp({
  template: `
    <router-view></router-view>
  `,
})
  .use(router)
  .use(GraffitiPlugin, {
    graffiti: new GraffitiDecentralized(),
  })
  .mount("#app");
