import {
  useGraffiti,
  useGraffitiSession,
  useGraffitiDiscover,
} from "@graffiti-garden/wrapper-vue";

import { computed, ref } from "vue";
import { CHAT_INDEX_CHANNEL } from "../constants.js";
import StarButton from "../components/StarButton.js";

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

const chatEventSchema = {
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
  components: {
    StarButton,
  },

  props: ["chatId"],

  setup(props) {
    const graffiti = useGraffiti();
    const session = useGraffitiSession();

    const draftMessage = ref("");
    const draftImportant = ref(false);
    const statusMessage = ref("");

    const { objects: chatObjects } = useGraffitiDiscover(
      [CHAT_INDEX_CHANNEL],
      chatSchema,
      session
    );

    const { objects: chatEvents, poll: pollEvents } = useGraffitiDiscover(
      [props.chatId],
      chatEventSchema,
      session,
      true
    );

    const chat = computed(() => {
      return chatObjects.value.find(
        (object) => object.value.channel === props.chatId
      );
    });

    const stars = computed(() => {
      return chatEvents.value.filter((object) => object.value.activity === "Star");
    });

    const messages = computed(() => {
      return chatEvents.value
        .filter((object) => object.value.activity === "Send")
        .map((object) => ({
          url: object.url,
          actor: object.actor,
          content: object.value.content,
          published: object.value.published,
          important: stars.value.some((star) => star.value.target === object.url),
        }))
        .sort((a, b) => a.published - b.published);
    });

    async function sendMessage() {
      statusMessage.value = "";

      if (!session.value || !chat.value) {
        statusMessage.value = "You must be logged in and inside a valid chat.";
        return;
      }

      if (!draftMessage.value.trim()) {
        statusMessage.value = "Write a message first.";
        return;
      }

      try {
        const messageObject = await graffiti.post(
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

        if (draftImportant.value) {
          await graffiti.post(
            {
              value: {
                activity: "Star",
                type: "ImportantMark",
                target: messageObject.url,
                published: Date.now(),
              },
              channels: [props.chatId],
              allowed: chat.value.value.members,
            },
            session.value
          );
        }

        draftMessage.value = "";
        draftImportant.value = false;
        await pollEvents();
      } catch (error) {
        console.error(error);
        statusMessage.value = "Message failed to send.";
      }
    }

    async function markImportant(message) {
      if (!session.value || !chat.value || message.important) return;

      try {
        await graffiti.post(
          {
            value: {
              activity: "Star",
              type: "ImportantMark",
              target: message.url,
              published: Date.now(),
            },
            channels: [props.chatId],
            allowed: chat.value.value.members,
          },
          session.value
        );

        await pollEvents();
      } catch (error) {
        console.error(error);
        statusMessage.value = "Could not mark message as important.";
      }
    }

    return {
      session,
      chat,
      messages,
      draftMessage,
      draftImportant,
      statusMessage,
      sendMessage,
      markImportant,
    };
  },

  template: `
    <main class="phone-shell chat-page">
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

      <section v-else class="chat-layout">
        <header class="chat-header">
          <router-link to="/" class="back-link">‹</router-link>

          <div class="chat-title-area">
            <h1>{{ chat.value.title }}</h1>
            <p>{{ chat.value.members.length }} members</p>
          </div>

          <router-link
            class="digest-link"
            :to="'/chat/' + encodeURIComponent(chat.value.channel) + '/digest'"
          >
            Digest
          </router-link>
        </header>

        <section class="messages">
          <article
            v-for="message in messages"
            :key="message.url"
            class="message-row"
            :class="{ mine: message.actor === session.actor }"
          >
            <div class="message-bubble">
              <p>{{ message.content }}</p>

              <div class="message-meta">
                <small><code>{{ message.actor }}</code></small>

                <StarButton
                  :active="message.important"
                  label="Mark message as important"
                  @toggle="markImportant(message)"
                />
              </div>
            </div>
          </article>

          <p v-if="messages.length === 0" class="empty-state">
            No messages yet.
          </p>
        </section>

        <form class="composer" @submit.prevent="sendMessage">
          <StarButton
            :active="draftImportant"
            label="Mark next message as important"
            @toggle="draftImportant = !draftImportant"
          />

          <input
            v-model="draftMessage"
            placeholder="Write your message"
          />

          <button type="submit" class="send-button">Send</button>
        </form>

        <p v-if="statusMessage" class="status-message">
          {{ statusMessage }}
        </p>
      </section>
    </main>
  `,
};
