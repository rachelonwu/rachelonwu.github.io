import {
  useGraffiti,
  useGraffitiSession,
  useGraffitiDiscover,
} from "@graffiti-garden/wrapper-vue";

import { computed, ref } from "vue";
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

const messageSchema = {
  properties: {
    value: {
      properties: {
        activity: { const: "Send" },
        type: { const: "Message" },
        content: { type: "string" },
        published: { type: "number" },
      },
      required: ["activity", "type", "content", "published"],
    },
  },
};

export default {
  props: ["chatId"],

  setup(props) {
    const graffiti = useGraffiti();
    const session = useGraffitiSession();

    const draftMessage = ref("");
    const statusMessage = ref("");

    const { objects: chatObjects } = useGraffitiDiscover(
      [CHAT_INDEX_CHANNEL],
      chatSchema,
      session
    );

    const {
      objects: messageObjects,
      poll: pollMessages,
    } = useGraffitiDiscover(
      [props.chatId],
      messageSchema,
      session,
      true
    );

    const chat = computed(() => {
      return chatObjects.value.find(
        (object) => object.value.channel === props.chatId
      );
    });

    const messages = computed(() => {
      return messageObjects.value
        .map((object) => ({
          url: object.url,
          actor: object.actor,
          content: object.value.content,
          published: object.value.published,
        }))
        .sort((a, b) => a.published - b.published);
    });

    async function sendMessage() {
      statusMessage.value = "";

      if (!session.value) {
        statusMessage.value = "You must log in to send a message.";
        return;
      }

      if (!chat.value) {
        statusMessage.value = "Chat not found.";
        return;
      }

      if (!draftMessage.value.trim()) {
        statusMessage.value = "Write a message first.";
        return;
      }

      try {
        await graffiti.post(
          {
            value: {
              activity: "Send",
              type: "Message",
              content: draftMessage.value.trim(),
              published: Date.now(),
            },
            channels: [props.chatId],
            allowed: chat.value.value.members,
          },
          session.value
        );

        draftMessage.value = "";
        await pollMessages();
      } catch (error) {
        console.error(error);
        statusMessage.value = "Message failed to send. Check the console.";
      }
    }

    return {
      session,
      chat,
      messages,
      draftMessage,
      statusMessage,
      sendMessage,
    };
  },

  template: `
    <main class="phone-shell">
      <section v-if="session === undefined">
        <p>Loading Graffiti...</p>
      </section>

      <section v-else-if="session === null">
        <p>You must log in to view this chat.</p>
        <router-link to="/">Back home</router-link>
      </section>

      <section v-else-if="!chat">
        <p>Chat not found, or you do not have access to it.</p>
        <router-link to="/">Back home</router-link>
      </section>

      <section v-else>
        <header class="topbar">
          <router-link to="/">Back</router-link>
          <h1>{{ chat.value.title }}</h1>
        </header>

        <section class="members">
          <strong>Members:</strong>
          <ul>
            <li v-for="member in chat.value.members" :key="member">
              <code>{{ member }}</code>
            </li>
          </ul>
        </section>

        <section class="messages">
          <article
            v-for="message in messages"
            :key="message.url"
            class="message"
          >
            <p>{{ message.content }}</p>
            <small><code>{{ message.actor }}</code></small>
          </article>

          <p v-if="messages.length === 0">No messages yet.</p>
        </section>

        <form class="composer" @submit.prevent="sendMessage">
          <input
            v-model="draftMessage"
            placeholder="Write your message"
          />
          <button type="submit">Send</button>
        </form>

        <p v-if="statusMessage">{{ statusMessage }}</p>
      </section>
    </main>
  `,
};
