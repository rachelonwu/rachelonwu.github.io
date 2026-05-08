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
    const showCreateChat = ref(false);
    const isCreating = ref(false);

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

    const recentMembers = computed(() => {
      if (!session.value) return [];

      const members = new Set();

      for (const chat of chats.value) {
        for (const member of chat.members) {
          if (member !== session.value.actor) {
            members.add(member);
          }
        }
      }

      return Array.from(members).slice(0, 5);
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

    function addRecentMember(actor) {
      const currentMembers = parseMemberActors();

      if (!currentMembers.includes(actor)) {
        currentMembers.push(actor);
      }

      memberActors.value = currentMembers.join(", ");
      showCreateChat.value = true;
    }

    function readableActor(actor) {
      if (!actor) return "Unknown member";
      if (actor === session.value?.actor) return "You";
      return "Member " + actor.slice(-8);
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
        isCreating.value = true;
        statusMessage.value = "Creating chat...";

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
        showCreateChat.value = false;
        statusMessage.value = "Chat created.";
        await poll();
      } catch (error) {
        console.error(error);
        statusMessage.value = "Could not create chat.";
      } finally {
        isCreating.value = false;
      }
    }

    return {
      session,
      title,
      memberActors,
      statusMessage,
      chats,
      recentMembers,
      isFirstPoll,
      showCreateChat,
      isCreating,
      login,
      logout,
      createChat,
      addRecentMember,
      readableActor,
    };
  },

  template: `
    <main class="phone-shell">
      <header class="home-header">
        <div>
          <h1>Messages</h1>
          <p class="page-note compact-note">
            Keep track of starred messages and reminders.
          </p>
        </div>

        <div class="home-links">
          <router-link
            to="/digest"
            class="primary-nav-pill"
            title="View starred messages across all chats"
          >
            Starred
          </router-link>

          <router-link
            to="/reminders"
            class="primary-nav-pill reminder-pill"
            title="View messages you saved for later"
          >
            Reminders
          </router-link>
        </div>
      </header>

      <section v-if="session === undefined" class="loading-state">
        <p>Loading account...</p>
      </section>

      <section v-else-if="session === null" class="signed-out-state">
        <p>You are not logged in.</p>
        <button @click="login">Log in / Create Account</button>
      </section>

      <section v-else>
        <p class="actor-box">
          Signed in as <strong>{{ readableActor(session.actor) }}</strong>
        </p>

        <button @click="logout">Log out</button>

        <section class="new-chat">
          <button
            type="button"
            class="create-toggle"
            @click="showCreateChat = !showCreateChat"
          >
            {{ showCreateChat ? "Close Create Chat" : "+ Create Chat" }}
          </button>

          <transition name="form-drop">
            <div v-if="showCreateChat" class="create-chat-form">
              <h2>Create Chat</h2>

              <label>
                Chat name:
                <input v-model="title" placeholder="Example: Project Group" />
              </label>

              <label>
                Members:
                <textarea
                  v-model="memberActors"
                  placeholder="Paste member IDs, separated by commas"
                ></textarea>
              </label>

              <section v-if="recentMembers.length > 0" class="recent-members">
                <p>Recent members:</p>

                <button
                  v-for="actor in recentMembers"
                  :key="actor"
                  type="button"
                  class="member-chip"
                  @click="addRecentMember(actor)"
                  :title="'Add ' + readableActor(actor)"
                >
                  {{ readableActor(actor) }}
                </button>
              </section>

              <button @click="createChat" :disabled="isCreating">
                {{ isCreating ? "Creating..." : "Create Chat" }}
              </button>
            </div>
          </transition>

          <p
            v-if="statusMessage"
            class="status-message"
            role="status"
            aria-live="polite"
          >
            {{ statusMessage }}
          </p>
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
