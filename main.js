import { createApp, computed, ref, watch, onMounted, onUnmounted } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";

import { GraffitiDecentralized } from "@graffiti-garden/implementation-decentralized";
import {
  GraffitiPlugin,
  useGraffitiSession,
  useGraffitiDiscover,
} from "@graffiti-garden/wrapper-vue";

import Home from "./pages/Home.js";
import Chat from "./pages/Chat.js";
import ChatDigest from "./pages/ChatDigest.js";
import Digest from "./pages/Digest.js";
import Reminders from "./pages/Reminders.js";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", component: Home },
    { path: "/chat/:chatId", component: Chat, props: true },
    { path: "/chat/:chatId/digest", component: ChatDigest, props: true },
    { path: "/digest", component: Digest },
    { path: "/reminders", component: Reminders },
  ],
});

const reminderSchema = {
  properties: {
    value: {
      properties: {
        activity: {
          enum: ["Remind", "CancelReminder"],
        },
      },
      required: ["activity"],
    },
  },
};

const ReminderWatcher = {
  setup() {
    const session = useGraffitiSession();

    const firedReminderUrls = ref(
      new Set(
        JSON.parse(
          localStorage.getItem("important-message-fired-reminders") || "[]"
        )
      )
    );

    const reminderChannels = computed(() => {
      return session.value
        ? [session.value.actor + "/reminders"]
        : ["no-reminder-channel"];
    });

    const { objects: reminderObjects } = useGraffitiDiscover(
      reminderChannels,
      reminderSchema,
      session,
      true
    );

    function isCanceled(reminder) {
      const cancelEvents = reminderObjects.value.filter(
        (object) =>
          object.value.activity === "CancelReminder" &&
          object.value.target === reminder.value.target &&
          object.value.published > reminder.value.published
      );

      return cancelEvents.length > 0;
    }

    function checkReminders() {
      if (!session.value) return;

      const now = Date.now();

      const dueReminders = reminderObjects.value
        .filter((object) => object.value.activity === "Remind")
        .filter((object) => object.actor === session.value.actor)
        .filter((object) => object.value.remindAt <= now)
        .filter((object) => !isCanceled(object))
        .filter((object) => !firedReminderUrls.value.has(object.url));

      for (const reminder of dueReminders) {
        window.alert(`Reminder: ${reminder.value.messagePreview}`);

        firedReminderUrls.value.add(reminder.url);

        localStorage.setItem(
          "important-message-fired-reminders",
          JSON.stringify(Array.from(firedReminderUrls.value))
        );
      }
    }

    let timer = undefined;

    onMounted(() => {
      timer = window.setInterval(checkReminders, 1000);
    });

    onUnmounted(() => {
      if (timer !== undefined) {
        window.clearInterval(timer);
      }
    });

    watch(reminderObjects, checkReminders, { deep: true });

    return {};
  },

  template: `<span></span>`,
};

createApp({
  components: {
    ReminderWatcher,
  },

  template: `
    <ReminderWatcher />
    <router-view></router-view>
  `,
})
  .use(router)
  .use(GraffitiPlugin, {
    graffiti: new GraffitiDecentralized(),
  })
  .mount("#app");
