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
      session
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
        .sort((a, b) => a.value.published - b.value.published);
    });

    return {
      session,
      importantMessages,
    };
  },

  template: `
    <main class="phone-shell">
      <router-link :to="'/chat/' + encodeURIComponent(chatId)">Back</router-link>

      <h1>Chat Digest</h1>
      <p>Important messages from this chat only.</p>

      <section v-if="session === undefined">
        Loading...
      </section>

      <section v-else-if="session === null">
        Log in to view this digest.
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

        <p v-if="importantMessages.length === 0">
          No important messages in this chat yet.
        </p>
      </section>
    </main>
  `,
};
