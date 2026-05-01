import {
  useGraffitiSession,
  useGraffitiDiscover,
} from "@graffiti-garden/wrapper-vue";

import { computed } from "vue";

const reminderSchema = {
  properties: {
    value: {
      properties: {
        activity: { const: "Remind" },
        type: { const: "MessageReminder" },
        target: { type: "string" },
        chatChannel: { type: "string" },
        chatTitle: { type: "string" },
        messagePreview: { type: "string" },
        remindAt: { type: "number" },
        published: { type: "number" },
      },
      required: [
        "activity",
        "type",
        "target",
        "chatChannel",
        "chatTitle",
        "messagePreview",
        "remindAt",
        "published",
      ],
    },
  },
};

export default {
  setup() {
    const session = useGraffitiSession();

    const reminderChannel = computed(() => {
      return session.value ? [session.value.actor + "/reminders"] : ["no-reminders"];
    });

    const { objects: reminderObjects } = useGraffitiDiscover(
      reminderChannel,
      reminderSchema,
      session,
      true
    );

    const reminders = computed(() => {
      return reminderObjects.value
        .filter((object) => object.actor === session.value?.actor)
        .map((object) => ({
          url: object.url,
          chatTitle: object.value.chatTitle,
          chatChannel: object.value.chatChannel,
          messagePreview: object.value.messagePreview,
          remindAt: object.value.remindAt,
        }))
        .sort((a, b) => a.remindAt - b.remindAt);
    });

    function formatTime(timestamp) {
      return new Date(timestamp).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    }

    return {
      session,
      reminders,
      formatTime,
    };
  },

  template: `
    <main class="phone-shell">
      <header class="home-header">
        <h1>Reminders</h1>
        <router-link to="/" class="digest-link">Home</router-link>
      </header>

      <section v-if="session === undefined">
        <p>Loading Graffiti...</p>
      </section>

      <section v-else-if="session === null">
        <p>Log in to view your reminders.</p>
      </section>

      <section v-else>
        <p class="page-note">
          Messages you saved to revisit later.
        </p>

        <article
          v-for="reminder in reminders"
          :key="reminder.url"
          class="digest-card"
        >
          <strong>{{ reminder.chatTitle }}</strong>
          <p>{{ reminder.messagePreview }}</p>
          <small>Reminder: {{ formatTime(reminder.remindAt) }}</small>
          <br />
          <router-link :to="'/chat/' + encodeURIComponent(reminder.chatChannel)">
            Open chat
          </router-link>
        </article>

        <p v-if="reminders.length === 0" class="empty-state">
          No reminders yet.
        </p>
      </section>
    </main>
  `,
};
