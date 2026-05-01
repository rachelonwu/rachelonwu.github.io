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

    const { objects: chatObjects } = useGraffitiDiscover(
      [CHAT_INDEX_CHANNEL],
      chatSchema,
      session
    );

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

    function parseActors() {
      return memberActors.value
        .split(",")
        .map((actor) => actor.trim())
        .filter((actor) => actor.length > 0);
    }

    async function createChat() {
      if (!session.value || !title.value.trim()) return;

      const members = Array.from(
        new Set([session.value.actor, ...parseActors()])
      );

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
    }

    return {
      session,
      chats,
      title,
      memberActors,
      login,
      logout,
      createChat,
    };
  },

  template: `
    <main class="phone-shell">
      <header class="topbar">
        <h1>Messages</h1>
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

          <input
            v-model="title"
            placeholder="Chat name"
          />

          <textarea
            v-model="memberActors"
            placeholder="Other members' actor IDs, separated by commas"
          ></textarea>

          <button @click="createChat">Create Chat</button>
        </section>

        <section class="chat-list">
          <h2>Your Chats</h2>

          <p v-if="chats.length === 0">No chats yet.</p>

          <router-link
            v-for="chat in chats"
            :key="chat.url"
            class="chat-row"
            :to="'/chat/' + encodeURIComponent(chat.channel)"
          >
            <strong>{{ chat.title }}</strong>
            <span>{{ chat.members.length }} members</span>
          </router-link>
        </section>
      </section>
    </main>
  `,
};
