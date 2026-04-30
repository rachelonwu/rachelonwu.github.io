import { createApp, reactive, watch } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";

import Home from "./pages/Home.js";
import Chat from "./pages/Chat.js";
import Digest from "./pages/Digest.js";
import ChatDigest from "./pages/ChatDigest.js";

const savedState = localStorage.getItem("chat-app-state");

const store = reactive(
  savedState
    ? JSON.parse(savedState)
    : {
        chats: [
          {
            id: "friends",
            title: "Hayley, Ava, Nicole, and Carolina",
            members: ["Rachel", "Hayley", "Ava", "Nicole", "Carolina"],
            messages: [
              {
                id: "m1",
                sender: "Nicole",
                text: "we are at the Cheesecake Factory rn",
                important: true,
                time: "6:12 PM",
              },
              {
                id: "m2",
                sender: "Rachel",
                text: "omg wait for me",
                important: false,
                time: "6:15 PM",
              },
            ],
          },
          {
            id: "project",
            title: "Project Group",
            members: ["Rachel", "Maya", "Chris"],
            messages: [
              {
                id: "m3",
                sender: "Maya",
                text: "meeting at 9 now!",
                important: true,
                time: "9:00 AM",
              },
            ],
          },
          {
            id: "roommates",
            title: "Roommates",
            members: ["Rachel", "Jada", "Sam"],
            messages: [
              {
                id: "m4",
                sender: "Sam",
                text: "Can someone grab paper towels?",
                important: false,
                time: "2:30 PM",
              },
            ],
          },
        ],
      }
);

watch(
  store,
  () => {
    localStorage.setItem("chat-app-state", JSON.stringify(store));
  },
  { deep: true }
);

const routes = [
  { path: "/", component: Home, props: { store } },
  { path: "/chat/:chatId", component: Chat, props: route => ({ store, chatId: route.params.chatId }) },
  { path: "/chat/:chatId/digest", component: ChatDigest, props: route => ({ store, chatId: route.params.chatId }) },
  { path: "/digest", component: Digest, props: { store } },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

createApp({
  template: `<router-view></router-view>`,
})
  .use(router)
  .mount("#app");
