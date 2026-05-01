import { createApp } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";

import { GraffitiDecentralized } from "@graffiti-garden/implementation-decentralized";
import { GraffitiPlugin } from "@graffiti-garden/wrapper-vue";

import Home from "./pages/Home.js";
import Chat from "./pages/Chat.js";
import Digest from "./pages/Digest.js";
import ChatDigest from "./pages/ChatDigest.js";

const routes = [
  { path: "/", component: Home },
  { path: "/chat/:chatId", component: Chat, props: true },
  { path: "/chat/:chatId/digest", component: ChatDigest, props: true },
  { path: "/digest", component: Digest },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

createApp({
  template: `<router-view></router-view>`,
})
  .use(router)
  .use(GraffitiPlugin, { graffiti: new GraffitiDecentralized() })
  .mount("#app");
