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

      if (matching.length === 0) return false;
      return matching[matching.length - 1].value.activity === "Star";
    }

    const importantMessages = computed(() => {
      return objects.value
        .filter((object) => object.value.activity === "Send")
        .filter((message) => isCurrentlyStarred(message.url))
        .sort((a, b) => b.value.published - a.value.published);
    });

    function readableActor(actor) {
      if (!actor) return "Unknown sender";
      if (actor === session.value?.actor) return "You";
      return "Member " + actor.slice(-8);
    }

    return {
      session,
      importantMessages,
      readableActor,
    };
  },

  template: `
    <main class="phone-shell">
      <header class="chat-topbar digest-topbar">
        <router-link
          :to="'/chat/' + encodeURIComponent(chatId)"
          class="back-link"
          title="Back to chat"
        >
          ‹
        </router-link>

        <h1>Chat Starred</h1>
      </header>

      <p class="page-note">Starred messages from this chat only.</p>

      <section v-if="session === undefined" class="loading-state">
        <p>Loading starred messages...</p>
      </section>

      <section v-else-if="session === null" class="signed-out-state">
        <p>Log in to view this chat's starred messages.</p>
      </section>

      <section v-else>
        <article
          v-for="message in importantMessages"
          :key="message.url"
          class="digest-card"
        >
          <p>{{ message.value.content }}</p>
          <small>
  <span v-if="message.actor === session.actor">You</span>
  <ActorName
    v-else
    :actor="message.actor"
    fallback="Member"
  />
</small>
        </article>

        <p v-if="importantMessages.length === 0" class="empty-state">
          No starred messages in this chat yet.
        </p>
      </section>
    </main>
  `,
};
