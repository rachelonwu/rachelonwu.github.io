import {
  useGraffiti,
  useGraffitiSession,
  useGraffitiDiscover,
} from "@graffiti-garden/wrapper-vue";

import { computed, ref } from "vue";

import { CHAT_INDEX_CHANNEL } from "../constants.js";

import StarButton from "../components/StarButton.js";
import ActorName from "../components/ActorName.js";

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

      required: [
        "activity",
        "type",
        "title",
        "channel",
        "members",
        "published",
      ],
    },
  },
};

const chatEventSchema = {
  properties: {
    value: {
      properties: {
        activity: {
          enum: [
            "Send",
            "Star",
            "Unstar",
            "Remind",
            "CancelReminder",
          ],
        },
      },

      required: ["activity"],
    },
  },
};

export default {
  components: {
    StarButton,
    ActorName,
  },

  props: ["chatId"],

  setup(props) {
    const graffiti = useGraffiti();

    const session = useGraffitiSession();

    const draftMessage = ref("");
    const draftImportant = ref(false);

    const statusMessage = ref("");

    const sendingMessage = ref(false);

    const busyMessageTarget = ref("");

    const { objects: chatObjects } = useGraffitiDiscover(
      [CHAT_INDEX_CHANNEL],
      chatSchema,
      session
    );

    const { objects: chatEvents, poll: pollEvents } =
      useGraffitiDiscover(
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

    const starEvents = computed(() => {
      return chatEvents.value.filter(
        (object) =>
          object.value.activity === "Star" ||
          object.value.activity === "Unstar"
      );
    });

    const reminderEvents = computed(() => {
      return chatEvents.value.filter(
        (object) =>
          (object.value.activity === "Remind" ||
            object.value.activity === "CancelReminder") &&
          object.actor === session.value?.actor
      );
    });

    function hasLatestEvent(events, target, activeActivity) {
      const matching = events
        .filter((event) => event.value.target === target)
        .sort((a, b) => a.value.published - b.value.published);

      if (matching.length === 0) {
        return false;
      }

      return matching[matching.length - 1].value.activity === activeActivity;
    }

    const messages = computed(() => {
      return chatEvents.value
        .filter((object) => object.value.activity === "Send")

        .map((object) => ({
          url: object.url,

          actor: object.actor,

          content: object.value.content,

          published: object.value.published,

          important: hasLatestEvent(
            starEvents.value,
            object.url,
            "Star"
          ),

          reminded: hasLatestEvent(
            reminderEvents.value,
            object.url,
            "Remind"
          ),
        }))

        .sort((a, b) => a.published - b.published);
    });

    async function sendMessage() {
      statusMessage.value = "";

      if (!session.value || !chat.value) {
        statusMessage.value =
          "You must be logged in and inside a valid chat.";

        return;
      }

      if (!draftMessage.value.trim()) {
        statusMessage.value = "Write a message first.";
        return;
      }

      try {
        sendingMessage.value = true;

        statusMessage.value = "Sending message...";

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
          statusMessage.value =
            "Sending and starring message...";

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

        statusMessage.value = "Message sent.";
      } catch (error) {
        console.error(error);

        statusMessage.value =
          "Message failed to send.";
      } finally {
        sendingMessage.value = false;
      }
    }

    async function toggleImportant(message) {
      if (
        !session.value ||
        !chat.value ||
        busyMessageTarget.value
      ) {
        return;
      }

      const nextActivity = message.important
        ? "Unstar"
        : "Star";

      const nextType = message.important
        ? "ImportantUnmark"
        : "ImportantMark";

      try {
        busyMessageTarget.value = message.url;

        statusMessage.value = message.important
          ? "Removing from starred messages..."
          : "Adding to starred messages...";

        await graffiti.post(
          {
            value: {
              activity: nextActivity,

              type: nextType,

              target: message.url,

              published: Date.now(),
            },

            channels: [props.chatId],

            allowed: chat.value.value.members,
          },

          session.value
        );

        await pollEvents();

        statusMessage.value = message.important
          ? "Removed from starred messages."
          : "Added to starred messages.";
      } catch (error) {
        console.error(error);

        statusMessage.value =
          "Could not update starred message.";
      } finally {
        busyMessageTarget.value = "";
      }
    }

    async function toggleReminder(message) {
      if (
        !session.value ||
        !chat.value ||
        busyMessageTarget.value
      ) {
        return;
      }

      const nextActivity = message.reminded
        ? "CancelReminder"
        : "Remind";

      const nextType = message.reminded
        ? "MessageReminderCancel"
        : "MessageReminder";

      try {
        busyMessageTarget.value = message.url;

        statusMessage.value = message.reminded
          ? "Canceling reminder..."
          : "Saving reminder...";

        await graffiti.post(
          {
            value: {
              activity: nextActivity,

              type: nextType,

              target: message.url,

              chatChannel: props.chatId,

              chatTitle: chat.value.value.title,

              messagePreview: message.content,

              remindAt:
                Date.now() +
                24 * 60 * 60 * 1000,

              published: Date.now(),
            },

            channels: [
              props.chatId,
              session.value.actor + "/reminders",
            ],

            allowed: [session.value.actor],
          },

          session.value
        );

        await pollEvents();

        statusMessage.value = message.reminded
          ? "Reminder canceled."
          : "Reminder saved for tomorrow.";
      } catch (error) {
        console.error(error);

        statusMessage.value =
          "Could not update reminder.";
      } finally {
        busyMessageTarget.value = "";
      }
    }

    return {
      session,

      chat,

      messages,

      draftMessage,

      draftImportant,

      statusMessage,

      sendingMessage,

      busyMessageTarget,

      sendMessage,

      toggleImportant,

      toggleReminder,
    };
  },

  template: `
    <main class="phone-shell chat-page">

      <section v-if="session === undefined" class="loading-state">
        <p>Loading chat...</p>
      </section>

      <section
        v-else-if="session === null"
        class="signed-out-state"
      >
        <p>You must log in to view this chat.</p>

        <router-link to="/">
          Back home
        </router-link>
      </section>

      <section
        v-else-if="!chat"
        class="empty-state"
      >
        <p>
          Chat not found, or you do not have access to it.
        </p>

        <router-link to="/">
          Back home
        </router-link>
      </section>

      <section v-else class="chat-layout">

        <header class="chat-header">

          <router-link
            to="/"
            class="back-link"
            title="Back to home"
          >
            ‹
          </router-link>

          <div class="chat-title-area">
            <h1>{{ chat.value.title }}</h1>

            <p>
              {{ chat.value.members.length }} members
            </p>
          </div>

          <router-link
            class="primary-nav-pill"
            :to="'/chat/' + encodeURIComponent(chat.value.channel) + '/digest'"
            title="View starred messages from this chat"
          >
            Starred
          </router-link>

        </header>

        <section class="messages">

          <transition-group name="message-list">

            <article
              v-for="message in messages"
              :key="message.url"
              class="message-row"
              :class="{ mine: message.actor === session.actor }"
            >
              <div
                class="message-bubble"
                :class="{ important: message.important }"
              >
                <p>{{ message.content }}</p>

                <div class="message-meta">

                  <small>

                    <span
                      v-if="message.actor === session.actor"
                    >
                      You
                    </span>

                    <ActorName
                      v-else
                      :actor="message.actor"
                      fallback="Member"
                    />

                  </small>

                  <div class="message-actions">

                    <StarButton
                      :active="message.important"
                      :disabled="busyMessageTarget === message.url"
                      :label="message.important
                        ? 'Remove from starred messages'
                        : 'Mark as starred'"
                      @toggle="toggleImportant(message)"
                    />

                    <button
                      type="button"
                      class="reminder-button"
                      :class="{ reminded: message.reminded }"
                      :disabled="busyMessageTarget === message.url"
                      @click="toggleReminder(message)"
                      :aria-label="message.reminded
                        ? 'Cancel reminder'
                        : 'Remind me later'"
                      :title="message.reminded
                        ? 'Cancel reminder'
                        : 'Remind me tomorrow'"
                    >
                      {{ message.reminded ? "⏰" : "🕘" }}
                    </button>

                  </div>

                </div>

              </div>

            </article>

          </transition-group>

          <p
            v-if="messages.length === 0"
            class="empty-state"
          >
            No messages yet.
          </p>

        </section>

        <form
          class="composer"
          @submit.prevent="sendMessage"
        >

          <StarButton
            :active="draftImportant"
            label="Send this message as starred"
            :disabled="sendingMessage"
            @toggle="draftImportant = !draftImportant"
          />

          <input
            v-model="draftMessage"
            placeholder="Write your message"
            :disabled="sendingMessage"
          />

          <button
            type="submit"
            class="send-button"
            :disabled="sendingMessage"
          >
            {{ sendingMessage ? "..." : "Send" }}
          </button>

        </form>

        <p
          v-if="statusMessage"
          class="status-message"
          role="status"
          aria-live="polite"
        >
          {{ statusMessage }}
        </p>

      </section>

    </main>
  `,
};
