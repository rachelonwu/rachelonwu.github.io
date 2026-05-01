import {
  useGraffitiSession,
  useGraffitiDiscover,
} from "@graffiti-garden/wrapper-vue";

import { computed } from "vue";

const eventSchema = {
  properties: {
    value: {
      properties: {
        activity: {
          enum: ["Send", "Star"],
        },
      },
      required: ["activity"],
    },
  },
};

export default {
  props: ["chatId"],

  setup(props) {
    const session = useGraffitiSession();

    const { objects } = useGraffitiDiscover(
      [props.chatId],
      eventSchema,
      session,
      true
    );

    const importantMessages = computed(() => {
      const stars = objects.value.filter(
        (object) => object.value.activity === "Star"
      );

      return objects.value
        .filter((object) => object.value.activity === "Send")
        .filter((message) =>
          stars.some((star) => star.value.target === message.url)
        )
        .sort((a, b) => b.value.published - a.value.published);
    });

    return {
      session,
      importantMessages,
    };
  },

  template: `
    <main class="phone-shell">
      <header class="chat-topbar digest-topbar">
        <router-link :to="'/chat/' + encodeURIComponent(chatId)" class="back-link">‹</router-link>
        <h1>Chat Digest</h1>
      </header>

      <p class="page-note">Important messages from this chat only.</p>

      <section v-if="session === undefined">
        <p>Loading Graffiti...</p>
      </section>

      <section v-else-if="session === null">
        <p>Log in to view this digest.</p>
      </section>

      <section v-else>
        <article
          v-for="message in importantMessages"
          :key="message.url"
          class="digest-card"
        >
          <p>{{ message.value.content }}</p>
          <small><code>{{ message.actor }}</code></small>
        </article>

        <p v-if="importantMessages.length === 0" class="empty-state">
          No important messages in this chat yet.
        </p>
      </section>
    </main>
  `,
};
