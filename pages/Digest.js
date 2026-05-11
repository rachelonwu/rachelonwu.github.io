import {
  useGraffitiSession,
  useGraffitiDiscover,
} from "@graffiti-garden/wrapper-vue";

import { computed } from "vue";
import { CHAT_INDEX_CHANNEL } from "../constants.js";
import ActorName from "../components/ActorName.js";

const chatSchema = {
  properties: {
    value: {
      properties: {
        activity: {
          enum: ["Create", "AddMember", "RemoveMember", "DeleteChat"],
        },
      },
      required: ["activity"],
    },
  },
};

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

  setup() {
    const session = useGraffitiSession();

    const { objects: chatObjects } = useGraffitiDiscover(
      [CHAT_INDEX_CHANNEL],
      chatSchema,
      session,
      true
    );

    const activeChats = computed(() => {
      const deletedChannels = new Set(
        chatObjects.value
          .filter((object) => object.value.activity === "DeleteChat")
          .map((object) => object.value.channel)
      );

      return chatObjects.value
        .filter((object) => object.value.activity === "Create")
        .filter((object) => !deletedChannels.has(object.value.channel));
    });

    const chatChannels = computed(() => {
      const channels = activeChats.value.map((chat) => chat.value.channel);
      return channels.length > 0 ? channels : ["empty-digest-placeholder"];
    });

    const { objects: allEvents } = useGraffitiDiscover(
      chatChannels,
      eventSchema,
      session,
      true
    );

    function isCurrentlyStarred(messageUrl) {
      const matching = allEvents.value
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

    const digestItems = computed(() => {
      return allEvents.value
        .filter((object) => object.value.activity === "Send")
        .filter((message) => isCurrentlyStarred(message.url))
        .map((message) => {
          const chat = activeChats.value.find((chatObject) =>
            message.channels?.includes(chatObject.value.channel)
          );

          return {
            url: message.url,
            chatTitle: chat?.value.title ?? "Unknown chat",
            chatChannel: chat?.value.channel ?? "",
            content: message.value.content,
            actor: message.actor,
            published: message.value.published,
          };
        })
        .sort((a, b) => b.published - a.published);
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
      digestItems,
      formatTime,
    };
  },

  template: `
    <main class="phone-shell">

      <header class="home-header">

        <h1>Starred Messages</h1>

        <router-link
          to="/"
          class="home-button"
        >
          Home
        </router-link>

      </header>

      <p class="page-note">
        Important messages from all chats you can access.
      </p>

      <section v-if="session === undefined" class="loading-state">
        <p>Loading starred messages...</p>
      </section>

      <section v-else-if="session === null" class="signed-out-state">
        <p>Log in to view your starred messages.</p>

        <router-link
          to="/"
          class="home-button"
        >
          Home
        </router-link>
      </section>

      <section v-else>

        <article
          v-for="item in digestItems"
          :key="item.url"
          class="digest-card"
        >

          <strong>{{ item.chatTitle }}</strong>

          <p>{{ item.content }}</p>

          <small>
            <span v-if="item.actor === session.actor">
              You
            </span>

            <ActorName
              v-else
              :actor="item.actor"
              fallback="Member"
            />

            · {{ formatTime(item.published) }}
          </small>

          <br />

          <router-link
            v-if="item.chatChannel"
            :to="'/chat/' + encodeURIComponent(item.chatChannel)"
          >
            Open chat
          </router-link>

        </article>

        <p
          v-if="digestItems.length === 0"
          class="empty-state"
        >
          No starred messages yet.
        </p>

      </section>

    </main>
  `,
};
