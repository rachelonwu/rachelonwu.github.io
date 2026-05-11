import {
  useGraffiti,
  useGraffitiSession,
  useGraffitiDiscover,
} from "@graffiti-garden/wrapper-vue";

import { computed, ref, watch } from "vue";
import { CHAT_INDEX_CHANNEL } from "../constants.js";
import StarButton from "../components/StarButton.js";
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

const chatEventSchema = {
  properties: {
    value: {
      properties: {
        activity: {
          enum: ["Send", "Star", "Unstar", "Remind", "CancelReminder"],
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

    const reminderPickerTarget = ref("");
    const reminderDrafts = ref({});
    const localStarOverrides = ref({});

    const { objects: chatObjects, poll: pollChats } = useGraffitiDiscover(
      [CHAT_INDEX_CHANNEL],
      chatSchema,
      session,
      true
    );

    const { objects: chatEvents, poll: pollEvents } =
      useGraffitiDiscover(
        [props.chatId],
        chatEventSchema,
        session,
        true
      );

    const createChatObject = computed(() => {
      return chatObjects.value.find(
        (object) =>
          object.value.activity === "Create" &&
          object.value.channel === props.chatId
      );
    });

    const chatDeleted = computed(() => {
      return chatObjects.value.some(
        (object) =>
          object.value.activity === "DeleteChat" &&
          object.value.channel === props.chatId
      );
    });

    const chatMembers = computed(() => {
      if (!createChatObject.value) return [];

      let members = [...createChatObject.value.value.members];

      const memberEvents = chatObjects.value
        .filter(
          (object) =>
            object.value.channel === props.chatId &&
            (object.value.activity === "AddMember" ||
              object.value.activity === "RemoveMember")
        )
        .sort((a, b) => a.value.published - b.value.published);

      for (const event of memberEvents) {
        if (event.value.activity === "AddMember") {
          members = Array.from(new Set([...members, event.value.member]));
        }

        if (event.value.activity === "RemoveMember") {
          members = members.filter((member) => member !== event.value.member);
        }
      }

      return members;
    });

    const chat = computed(() => {
      if (!createChatObject.value || chatDeleted.value) return undefined;

      return {
        ...createChatObject.value,
        value: {
          ...createChatObject.value.value,
          members: chatMembers.value,
        },
      };
    });

    const isMember = computed(() => {
      return session.value && chatMembers.value.includes(session.value.actor);
    });

    watch([session, chat], async () => {
      if (!session.value || !chat.value || isMember.value) return;

      try {
        await graffiti.post(
          {
            value: {
              activity: "AddMember",
              type: "ChatMembership",
              channel: props.chatId,
              member: session.value.actor,
              published: Date.now(),
            },

            channels: [CHAT_INDEX_CHANNEL],
          },

          session.value
        );

        await pollChats();
      } catch (error) {
        console.error(error);
        statusMessage.value = "Could not join chat.";
      }
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

      if (matching.length === 0) return false;

      return matching[matching.length - 1].value.activity === activeActivity;
    }

    const messages = computed(() => {
      return chatEvents.value
        .filter((object) => object.value.activity === "Send")
        .map((object) => {
          const serverImportant = hasLatestEvent(
            starEvents.value,
            object.url,
            "Star"
          );

          return {
            url: object.url,
            actor: object.actor,
            content: object.value.content,
            published: object.value.published,

            important:
              localStarOverrides.value[object.url] ??
              serverImportant,

            reminded: hasLatestEvent(
              reminderEvents.value,
              object.url,
              "Remind"
            ),
          };
        })
        .sort((a, b) => a.published - b.published);
    });

    function formatTime(timestamp) {
      return new Date(timestamp).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    }

    function inviteLink() {
      return `${window.location.origin}${window.location.pathname}#/chat/${encodeURIComponent(props.chatId)}`;
    }

    async function copyInviteLink() {
      await navigator.clipboard.writeText(inviteLink());
      statusMessage.value = "Invite link copied.";
    }

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
        sendingMessage.value = true;
        statusMessage.value = "Sending message...";

        const messageContent = draftMessage.value.trim();

        const messageObject = await graffiti.post(
          {
            value: {
              activity: "Send",
              type: "Message",
              content: messageContent,
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
                messagePreview: messageContent,
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
        statusMessage.value = "Message failed to send.";
      } finally {
        sendingMessage.value = false;
      }
    }

    async function toggleImportant(message) {
      if (!session.value || !chat.value || busyMessageTarget.value) return;

      const nextImportant = !message.important;
      const nextActivity = nextImportant ? "Star" : "Unstar";
      const nextType = nextImportant ? "ImportantMark" : "ImportantUnmark";

      localStarOverrides.value = {
        ...localStarOverrides.value,
        [message.url]: nextImportant,
      };

      try {
        busyMessageTarget.value = message.url;

        await graffiti.post(
          {
            value: {
              activity: nextActivity,
              type: nextType,
              target: message.url,
              messagePreview: message.content,
              published: Date.now(),
            },

            channels: [props.chatId],
            allowed: chat.value.value.members,
          },

          session.value
        );

        await pollEvents();

        const copy = { ...localStarOverrides.value };
        delete copy[message.url];
        localStarOverrides.value = copy;

        statusMessage.value = nextImportant
          ? "Added to starred messages."
          : "Removed from starred messages.";
      } catch (error) {
        console.error(error);

        localStarOverrides.value = {
          ...localStarOverrides.value,
          [message.url]: message.important,
        };

        statusMessage.value = "Could not update starred message.";
      } finally {
        busyMessageTarget.value = "";
      }
    }

    async function cancelReminder(message) {
      await graffiti.post(
        {
          value: {
            activity: "CancelReminder",
            type: "MessageReminderCancel",
            target: message.url,
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
      statusMessage.value = "Reminder canceled.";
    }

    async function saveReminder(message) {
      if (!reminderDrafts.value[message.url]) {
        statusMessage.value = "Choose a reminder time first.";
        return;
      }

      const remindAt = new Date(reminderDrafts.value[message.url]).getTime();

      if (Number.isNaN(remindAt)) {
        statusMessage.value = "Choose a valid reminder time.";
        return;
      }

      await graffiti.post(
        {
          value: {
            activity: "Remind",
            type: "MessageReminder",
            target: message.url,
            chatChannel: props.chatId,
            chatTitle: chat.value.value.title,
            messagePreview: message.content,
            remindAt,
            notified: false,
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

      reminderPickerTarget.value = "";
      await pollEvents();

      statusMessage.value = "Reminder saved.";
    }

    async function toggleReminder(message) {
      if (!session.value || !chat.value || busyMessageTarget.value) return;

      try {
        busyMessageTarget.value = message.url;

        if (message.reminded) {
          await cancelReminder(message);
        } else {
          reminderPickerTarget.value =
            reminderPickerTarget.value === message.url ? "" : message.url;
        }
      } catch (error) {
        console.error(error);
        statusMessage.value = "Could not update reminder.";
      } finally {
        busyMessageTarget.value = "";
      }
    }

    async function removeMember(member) {
      if (!session.value || !chat.value) return;

      await graffiti.post(
        {
          value: {
            activity: "RemoveMember",
            type: "ChatMembership",
            channel: props.chatId,
            member,
            published: Date.now(),
          },

          channels: [CHAT_INDEX_CHANNEL],
          allowed: chat.value.value.members,
        },

        session.value
      );

      await pollChats();
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
      reminderPickerTarget,
      reminderDrafts,
      sendMessage,
      toggleImportant,
      toggleReminder,
      saveReminder,
      removeMember,
      formatTime,
      copyInviteLink,
    };
  },

  template: `
    <main class="phone-shell chat-page">

      <section v-if="session === undefined" class="loading-state">
        <p>Loading chat...</p>
      </section>

      <section v-else-if="session === null" class="signed-out-state">
        <p>You must log in to view this chat.</p>

        <router-link to="/">
          Back home
        </router-link>
      </section>

      <section v-else-if="!chat" class="empty-state">
        <p>
          Chat not found, or it may have been deleted.
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
          >
            Starred
          </router-link>

        </header>

        <section class="member-row">
          <span
            v-for="member in chat.value.members"
            :key="member"
            class="member-chip"
          >
            <ActorName
              :actor="member"
              fallback="Member"
            />

            <button
              v-if="member !== session.actor"
              type="button"
              class="remove-member-button"
              @click="removeMember(member)"
              title="Remove member"
            >
              ×
            </button>
          </span>

          <button
            type="button"
            class="small-copy-button"
            @click="copyInviteLink"
          >
            Copy chat link
          </button>
        </section>

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
                    <span v-if="message.actor === session.actor">
                      You
                    </span>

                    <ActorName
                      v-else
                      :actor="message.actor"
                      fallback="Member"
                    />

                    · {{ formatTime(message.published) }}
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
                        : 'Set reminder'"
                      :title="message.reminded
                        ? 'Cancel reminder'
                        : 'Set reminder'"
                    >
                      {{ message.reminded ? "⏰" : "🕘" }}
                    </button>

                  </div>
                </div>

                <div
                  v-if="reminderPickerTarget === message.url"
                  class="reminder-picker"
                >
                  <input
                    type="datetime-local"
                    v-model="reminderDrafts[message.url]"
                  />

                  <button
                    type="button"
                    @click="saveReminder(message)"
                  >
                    Save
                  </button>
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

          <textarea
            v-model="draftMessage"
            placeholder="Write your message"
            :disabled="sendingMessage"
            rows="1"
          ></textarea>

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
