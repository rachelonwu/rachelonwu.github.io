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

    const { objects: chatObjects, isFirstPoll } = useGraffitiDiscover(
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

    async function createChat(session) {
  if (!session || !title.value.trim()) return;

  const members = Array.from(
    new Set([session.actor, ...parseActors()])
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
    session
  );

  title.value = "";
  memberActors.value = "";
}

    return {
      session,
      isFirstPoll,
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
      <router-link to="/digest">All Chats Digest</router-link>
    </header>

    <graffiti-session v-slot="{ session, login, logout }">
      <section v-if="session === undefined">
        Loading Graffiti...
      </section>

      <section v-else-if="session === null">
        <p>You need to log in before using the chat app.</p>
        <button @click="login">Log in / Create Graffiti Actor</button>
      </section>

      <section v-else>
        <p class="actor-box">
          Your Graffiti actor ID:
          <code>{{ session.actor }}</code>
        </p>

        <button @click="logout(session)">Log out</button>

        <section class="new-chat">
          <h2>Create a Chat</h2>

          <input
            v-model="title"
            placeholder="Chat name"
          />

          <textarea
            v-model="memberActors"
            placeholder="Other members' Graffiti actor IDs, separated by commas"
          ></textarea>

          <button @click="createChat(session)">Create Chat</button>
        </section>

        <p v-if="isFirstPoll">Loading chats...</p>

        <section class="chat-list">
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
    </graffiti-session>
  </main>

  `,
};
