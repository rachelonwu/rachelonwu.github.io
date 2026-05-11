import {
  useGraffitiSession,
  useGraffitiDiscover,
} from "@graffiti-garden/wrapper-vue";

import { computed } from "vue";
import ActorName from "../components/ActorName.js";

const eventSchema = {
  properties: {
    value: {
      properties: {
        activity: {
          enum: ["Send", "Star", "Unstar"],
        },
      },
      required: ["activity"],
    },
  },
};

export default {
  components: {
    ActorName,
  },

  props: ["chatId"],

  setup(props) {
    const session = useGraffitiSession();

    const { objects } = useGraffitiDiscover(
      [props.chatId],
      eventSchema,
      session,
      true
    );

    function isCurrentlyStarred(messageUrl) {
      const matching = objects.value
        .filter(
          (object) =>
            (object.value.activity === "Star" ||
              object.value.activity === "Unstar") &&
            object.value.target === messageUrl
        )
        .sort((a, b) => a.value.published - b.value.published);

      if (matching.length === 0) {
        return false;
      }

      return matching[matching.length - 1].value.activity === "Star";
    }

    const importantMessages = computed(() => {
      return objects.value
        .filter((object) => object.value.activity === "Send")
        .filter((message) => isCurrentlyStarred(message.url))
        .sort((a, b) => b.value.published - a.value.published);
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
      importantMessages,
      formatTime,
    };
  },

  template: `
    <main class="phone-shell">

      <header class="digest-header">

  <router-link
    :to="'/chat/' + encodeURIComponent(chatId)"
    class="home-button"
    title="Back to chat"
  >
    Back to Chat
  </router-link>

  <h1>Starred Messages</h1>

  <router-link
    to="/"
    class="home-button"
  >
    Home
  </router-link>

</header>

      <p class="page-note">
        Starred messages from this chat only.
      </p>

      <section v-if="session === undefined" class="loading-state">
        <p>Loading starred messages...</p>
      </section>

      <section v-else-if="session === null" class="signed-out-state">
        <p>Log in to view this chat's starred messages.</p>

        <router-link
          to="/"
          class="home-button"
        >
          Home
        </router-link>
      </section>

      <section v-else>

        <article
          v-for="message in importantMessages"
          :key="message.url"
          class="digest-card"
        >

          <p>{{ message.value.content }}</p>

          <small>
            <span v-if="message.actor === session.actor">
              You
            </span>

            <ActorName
              v-else
              :actor="message.actor"
              fallback="Member"
            />

            · {{ formatTime(message.value.published) }}
          </small>

        </article>

        <p
          v-if="importantMessages.length === 0"
          class="empty-state"
        >
          No starred messages in this chat yet.
        </p>

      </section>

    </main>
  `,
};
