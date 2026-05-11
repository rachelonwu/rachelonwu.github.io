import {
  useGraffiti,
  useGraffitiSession,
  useGraffitiDiscover,
} from "@graffiti-garden/wrapper-vue";

import { computed, ref, watch } from "vue";
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

export default {
  components: {
    ActorName,
  },

  setup() {
    const graffiti = useGraffiti();
    const session = useGraffitiSession();

    const title = ref("");
    const statusMessage = ref("");
    const showCreateChat = ref(false);
    const isCreating = ref(false);

    const showTutorial = ref(false);
    const tutorialStep = ref(0);

    const tutorialSlides = [
      {
        title: "Welcome!",
        body: "This app helps you keep important messages from getting buried in group chats.",
      },
      {
        title: "Star messages",
        body: "Tap the star next to a message to mark it as important.",
      },
      {
        title: "Review starred messages",
        body: "Use the Starred page to quickly review important messages across your chats.",
      },
      {
        title: "Set reminders",
        body: "Tap the clock icon on a message to choose a time to revisit it.",
      },
      {
        title: "Invite people",
        body: "Copy a chat invite link and send it to someone. When they open it, they can join the chat.",
      },
    ];

    const tutorialStorageKey = computed(() => {
      return session.value
        ? `important-message-chat-tutorial-seen-${session.value.actor}`
        : "important-message-chat-tutorial-seen";
    });

    const {
      objects: chatObjects,
      isFirstPoll,
      poll,
    } = useGraffitiDiscover(
      [CHAT_INDEX_CHANNEL],
      chatSchema,
      session,
      true
    );

    watch(
      session,
      (currentSession) => {
        if (
          currentSession &&
          !localStorage.getItem(
            `important-message-chat-tutorial-seen-${currentSession.actor}`
          )
        ) {
          tutorialStep.value = 0;
          showTutorial.value = true;
        }
      },
      { immediate: true }
    );

    function closeTutorial() {
      showTutorial.value = false;

      localStorage.setItem(
        tutorialStorageKey.value,
        "true"
      );
    }

    function nextTutorialStep() {
      if (tutorialStep.value < tutorialSlides.length - 1) {
        tutorialStep.value += 1;
      } else {
        closeTutorial();
      }
    }

    function membersForChannel(channel) {
      const createEvent = chatObjects.value.find(
        (object) =>
          object.value.activity === "Create" &&
          object.value.channel === channel
      );

      if (!createEvent) {
        return [];
      }

      let members = [...createEvent.value.members];

      const memberEvents = chatObjects.value
        .filter(
          (object) =>
            object.value.channel === channel &&
            (object.value.activity === "AddMember" ||
              object.value.activity === "RemoveMember")
        )
        .sort((a, b) => a.value.published - b.value.published);

      for (const event of memberEvents) {
        if (event.value.activity === "AddMember") {
          members = Array.from(
            new Set([...members, event.value.member])
          );
        }

        if (event.value.activity === "RemoveMember") {
          members = members.filter(
            (member) => member !== event.value.member
          );
        }
      }

      return members;
    }

    const chats = computed(() => {
      const deletedChannels = new Set(
        chatObjects.value
          .filter(
            (object) =>
              object.value.activity === "DeleteChat"
          )
          .map((object) => object.value.channel)
      );

      return chatObjects.value
        .filter(
          (object) =>
            object.value.activity === "Create"
        )
        .filter(
          (object) =>
            !deletedChannels.has(object.value.channel)
        )
        .map((object) => ({
          url: object.url,
          title: object.value.title,
          channel: object.value.channel,
          members: membersForChannel(
            object.value.channel
          ),
          published: object.value.published,
        }))
        .filter((chat) =>
          chat.members.includes(session.value?.actor)
        )
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

    function inviteLink(chat) {
      return `${window.location.origin}${window.location.pathname}#/chat/${encodeURIComponent(chat.channel)}`;
    }

    async function copyInviteLink(chat) {
      await navigator.clipboard.writeText(
        inviteLink(chat)
      );

      statusMessage.value = "Invite link copied.";
    }

    async function createChat() {
      statusMessage.value = "";

      if (!session.value) {
        statusMessage.value =
          "Log in before creating a chat.";

        return;
      }

      if (!title.value.trim()) {
        statusMessage.value =
          "Enter a chat name.";

        return;
      }

      const members = [session.value.actor];

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
          },

          session.value
        );

        title.value = "";

        showCreateChat.value = false;

        statusMessage.value = "Chat created.";

        await poll();
      } catch (error) {
        console.error(error);

        statusMessage.value =
          "Could not create chat.";
      } finally {
        isCreating.value = false;
      }
    }

    async function deleteChat(chat) {
      if (!session.value) {
        return;
      }

      const confirmed = window.confirm(
        `Delete "${chat.title}"?`
      );

      if (!confirmed) {
        return;
      }

      await graffiti.post(
        {
          value: {
            activity: "DeleteChat",
            type: "Chat",
            channel: chat.channel,
            published: Date.now(),
          },

          channels: [CHAT_INDEX_CHANNEL],
          allowed: chat.members,
        },

        session.value
      );

      statusMessage.value = "Chat deleted.";

      await poll();
    }

    return {
      session,
      title,
      statusMessage,
      chats,
      isFirstPoll,
      showCreateChat,
      isCreating,
      showTutorial,
      tutorialStep,
      tutorialSlides,
      login,
      logout,
      createChat,
      inviteLink,
      copyInviteLink,
      deleteChat,
      nextTutorialStep,
      closeTutorial,
    };
  },

  template: `
    <main class="phone-shell">

      <section
        v-if="showTutorial"
        class="tutorial-backdrop"
      >
        <article class="tutorial-modal">

          <button
            type="button"
            class="tutorial-close"
            @click="closeTutorial"
          >
            ×
          </button>

          <p class="tutorial-progress">
            {{ tutorialStep + 1 }} / {{ tutorialSlides.length }}
          </p>

          <h2>
            {{ tutorialSlides[tutorialStep].title }}
          </h2>

          <p>
            {{ tutorialSlides[tutorialStep].body }}
          </p>

          <button
            type="button"
            class="create-toggle"
            @click="nextTutorialStep"
          >
            {{
              tutorialStep === tutorialSlides.length - 1
                ? "Start using app"
                : "Next"
            }}
          </button>

        </article>
      </section>

      <header class="home-header">

        <div>

          <h1>Messages</h1>

          

        </div>

        <div class="home-links">

          <router-link
            to="/digest"
            class="primary-nav-pill"
          >
            Starred
          </router-link>

          <router-link
            to="/reminders"
            class="primary-nav-pill reminder-pill"
          >
            Reminders
          </router-link>

        </div>

      </header>

      <section
        v-if="session === undefined"
        class="loading-state"
      >
        <p>Loading account...</p>
      </section>

      <section
        v-else-if="session === null"
        class="signed-out-state"
      >
        <p>You are not logged in.</p>

        <button @click="login">
          Log in / Create Account
        </button>
      </section>

      <section v-else>

        <p class="actor-box">
          Signed in as
          <strong>

            <ActorName
              :actor="session.actor"
              fallback="You"
            />

          </strong>
        </p>

        <button @click="logout">
          Log out
        </button>

        <section class="new-chat">

          <button
            type="button"
            class="create-toggle"
            @click="showCreateChat = !showCreateChat"
          >
            {{
              showCreateChat
                ? "Close Create Chat"
                : "+ Create Chat"
            }}
          </button>

          <transition name="form-drop">

            <div
              v-if="showCreateChat"
              class="create-chat-form"
            >

              <h2>Create Chat</h2>

              <label>
                Chat name:

                <input
                  v-model="title"
                  placeholder="Example: Project Group"
                />
              </label>

              <p class="page-note">
                After creating the chat, copy its invite link and send it to anyone you want to join.
              </p>

              <button
                @click="createChat"
                :disabled="isCreating"
              >
                {{
                  isCreating
                    ? "Creating..."
                    : "Create Chat"
                }}
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

          <p v-if="isFirstPoll">
            Loading chats...
          </p>

          <p
            v-else-if="chats.length === 0"
          >
            No chats yet.
          </p>

          <article
            v-for="chat in chats"
            :key="chat.url"
            class="chat-card"
          >

            <router-link
              :to="'/chat/' + encodeURIComponent(chat.channel)"
            >

              <h3>{{ chat.title }}</h3>

              <p>
                {{ chat.members.length }} member(s)
              </p>

            </router-link>

            <div class="card-actions">

              <button
                type="button"
                class="small-copy-button"
                @click="copyInviteLink(chat)"
              >
                Copy invite link
              </button>

              <button
                type="button"
                class="small-danger-button"
                @click="deleteChat(chat)"
              >
                Delete chat
              </button>

            </div>

          </article>

        </section>

      </section>

    </main>
  `,
};
