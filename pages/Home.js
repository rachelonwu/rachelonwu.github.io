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

export default {
  setup() {
    const graffiti = useGraffiti();
    const session = useGraffitiSession();

    const title = ref("");
    const memberActors = ref("");
    const statusMessage = ref("");

    const {
      objects: chatObjects,
      isFirstPoll,
      poll,
    } = useGraffitiDiscover([CHAT_INDEX_CHANNEL], chatSchema, session);

    const chats = computed(() => {
      return chatObjects.value
        .map((object) => ({
          url: object.url,
          title: object.value.title,
          channel: object.value.channel,
          members: object.value.members,
          published: object.value.published,
        }))
        .sort((a, b) => b.published - a.published);
    });

    async function login() {
      await graffiti.login();
    }

    async function logout() {
      if (session.value) {
        await graffiti.logout(session.value);
      }
    }

    function parseMemberActors() {
      return memberActors.value
        .split(",")
        .map((actor) => actor.trim())
        .filter((actor) => actor.length > 0);
    }

    async function createChat() {
      statusMessage.value = "";

      if (!session.value) {
        statusMessage.value = "Log in before creating a chat.";
        return;
      }

      if (!title.value.trim()) {
        statusMessage.value = "Enter a chat name.";
        return;
      }

      const members = Array.from(
        new Set([session.value.actor, ...parseMemberActors()])
      );

      try {
        await graffiti.post(
          {
            value: {
              activity: "Create",
              type: "Chat",
              title: title.value.trim(),
              channel: crypto.randomUUID(),
              members,
              published: Date.now(),
            },
            channels: [CHAT_INDEX_CHANNEL],
            allowed: members,
          },
          session.value
        );

        title.value = "";
        memberActors.value = "";
        statusMessage.value = "Chat created.";
        await poll();
      } catch (error) {
        console.error(error);
        statusMessage.value = "Could not create chat.";
      }
    }

    return {
      session,
      title,
      memberActors,
      statusMessage,
      chats,
      isFirstPoll,
      login,
      logout,
      createChat,
    };
  },

  template: `
    <main class="phone-shell">
      <header class="home-header">
  <h1>Messages</h1>

  <div class="home-links">
    <router-link to="/digest" class="digest-link">All Digest</router-link>
    <router-link to="/reminders" class="digest-link">Reminders</router-link>
  </div>
</header>

      <section v-if="session === undefined">
        <p>Loading Graffiti...</p>
      </section>

      <section v-else-if="session === null">
        <p>You are not logged in.</p>
        <button @click="login">Log in / Create Graffiti Actor</button>
      </section>

      <section v-else>
        <p class="actor-box">
          Your actor ID:
          <code>{{ session.actor }}</code>
        </p>

        <button @click="logout">Log out</button>

        <section class="new-chat">
          <h2>Create Chat</h2>

          <label>
            Chat name:
            <input v-model="title" placeholder="Example: Project Group" />
          </label>

          <label>
            Other members:
            <textarea
              v-model="memberActors"
              placeholder="Paste other Graffiti actor IDs, separated by commas"
            ></textarea>
          </label>

          <button @click="createChat">Create Chat</button>

          <p v-if="statusMessage" class="status-message">{{ statusMessage }}</p>
        </section>

        <section>
          <h2>Your Chats</h2>

          <p v-if="isFirstPoll">Loading chats...</p>
          <p v-else-if="chats.length === 0">No chats yet.</p>

          <router-link
            v-for="chat in chats"
            :key="chat.url"
            class="chat-card"
            :to="'/chat/' + encodeURIComponent(chat.channel)"
          >
            <h3>{{ chat.title }}</h3>
            <p>{{ chat.members.length }} member(s)</p>
          </router-link>
        </section>
      </section>
    </main>
  `,
};
