import {
  useGraffitiSession,
  useGraffitiDiscover,
} from "@graffiti-garden/wrapper-vue";

import { computed } from "vue";
import { CHAT_INDEX_CHANNEL } from "../constants.js";

const chatSchema = {
  properties: {
    value: {
      properties: {
        activity: { const: "Create" },
        type: { const: "Chat" },
        title: { type: "string" },
        channel: { type: "string" },
        members: {
          type: "array",
          items: { type: "string" },
        },
        published: { type: "number" },
      },
      required: ["activity", "type", "title", "channel", "members", "published"],
    },
  },
};

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
  setup() {
    const session = useGraffitiSession();

    const { objects: chatObjects } = useGraffitiDiscover(
      [CHAT_INDEX_CHANNEL],
      chatSchema,
      session
    );

    const chatChannels = computed(() => {
      return chatObjects.value.map((chat) => chat.value.channel);
    });

    const { objects: allEvents } = useGraffitiDiscover(
      chatChannels,
      eventSchema,
      session
    );

    const digestItems = computed(() => {
      const stars = allEvents.value.filter(
        (object) => object.value.activity === "Star"
      );

      return allEvents.value
        .filter((object) => object.value.activity === "Send")
        .filter((message) =>
          stars.some((star) => star.value.target === message.url)
        )
        .map((message) => {
          const chat = chatObjects.value.find((chatObject) =>
            chatObject.value.channel === message.channels?.[0]
          );

          return {
            url: message.url,
            chatTitle: chat?.value.title ?? "Unknown chat",
            chatChannel: chat?.value.channel ?? message.channels?.[0],
            content: message.value.content,
            actor: message.actor,
            published: message.value.published,
          };
        })
        .sort((a, b) => b.published - a.published);
    });

    return {
      session,
      digestItems,
    };
  },

  template: `
    <main class="phone-shell">
      <header class="topbar">
        <router-link to="/">Back</router-link>
        <h1>All Chats Digest</h1>
      </header>

      <p class="page-note">
        Important messages from all chats you can access.
      </p>

      <section v-if="session === undefined">
        Loading...
      </section>

      <section v-else-if="session === null">
        Log in to view your digest.
      </section>

      <section v-else>
        <article
          v-for="item in digestItems"
          :key="item.url"
          class="digest-card"
        >
          <strong>{{ item.chatTitle }}</strong>
          <p>{{ item.content }}</p>
          <small><code>{{ item.actor }}</code></small>
          <br />
          <router-link :to="'/chat/' + encodeURIComponent(item.chatChannel)">
            Open chat
          </router-link>
        </article>

        <p v-if="digestItems.length === 0">
          No important messages yet.
        </p>
      </section>
    </main>
  `,
};
