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
          enum: ["Send", "Star", "AddMember"],
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
    const newMemberActor = ref("");

    const { objects: chatObjects } = useGraffitiDiscover(
      [CHAT_INDEX_CHANNEL],
      chatSchema,
      session
    );

    const { objects: chatEvents } = useGraffitiDiscover(
      [props.chatId],
      chatEventSchema,
      session,
      true
    );

    const chat = computed(() => {
      const createObject = chatObjects.value.find(
        (object) => object.value.channel === props.chatId
      );

      if (!createObject) return null;

      const members = new Set(createObject.value.members);

      for (const event of chatEvents.value) {
        if (event.value.activity === "AddMember") {
          members.add(event.value.actor);
        }
      }

      return {
        title: createObject.value.title,
        channel: createObject.value.channel,
        members: Array.from(members),
      };
    });

    const starObjects = computed(() => {
      return chatEvents.value.filter(
        (object) => object.value.activity === "Star"
      );
    });

    const messages = computed(() => {
      return chatEvents.value
        .filter((object) => object.value.activity === "Send")
        .map((object) => {
          const important = starObjects.value.some(
            (star) => star.value.target === object.url
          );

          return {
            url: object.url,
            actor: object.actor,
            content: object.value.content,
            published: object.value.published,
            important,
          };
        })
        .sort((a, b) => a.published - b.published);
    });

    async function sendMessage() {
      if (!session.value || !chat.value || !draftMessage.value.trim()) return;

      const messageObject = await graffiti.post(
        {
          value: {
            activity: "Send",
            type: "Message",
            content: draftMessage.value.trim(),
            published: Date.now(),
          },
          channels: [chat.value.channel],
          allowed: chat.value.members,
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
            channels: [chat.value.channel],
            allowed: chat.value.members,
          },
          session.value
        );
      }

      draftMessage.value = "";
      draftImportant.value = false;
    }

    async function toggleImportant(message) {
      if (!session.value || !chat.value) return;

      await graffiti.post(
        {
          value: {
            activity: "Star",
            type: "ImportantMark",
            target: message.url,
            published: Date.now(),
          },
          channels: [chat.value.channel],
          allowed: chat.value.members,
        },
        session.value
      );
    }

    async function addMember() {
      if (!session.value || !chat.value || !newMemberActor.value.trim()) return;

      const actor = newMemberActor.value.trim();
      const updatedMembers = Array.from(new Set([...chat.value.members, actor]));

      await graffiti.post(
        {
          value: {
            activity: "AddMember",
            type: "ChatMembership",
            actor,
            channel: chat.value.channel,
            published: Date.now(),
          },
          channels: [CHAT_INDEX_CHANNEL, chat.value.channel],
          allowed: updatedMembers,
        },
        session.value
      );

      newMemberActor.value = "";
    }

    return {
      session,
      chat,
      messages,
      draftMessage,
      draftImportant,
      newMemberActor,
      sendMessage,
      toggleImportant,
      addMember,
    };
  },

  template: `
    <main class="phone-shell">
      <section v-if="session === undefined">Loading...</section>

      <section v-else-if="session === null">
        <p>You need to log in to view this chat.</p>
        <router-link to="/">Back</router-link>
      </section>

      <section v-else-if="!chat">
        <p>Chat not found, or you do not have permission to view it.</p>
        <router-link to="/">Back</router-link>
      </section>

      <section v-else>
        <header class="topbar">
          <router-link to="/">Back</router-link>
          <h1>{{ chat.title }}</h1>
          <router-link :to="'/chat/' + encodeURIComponent(chat.channel) + '/digest'">
            Chat Digest
          </router-link>
        </header>

        <section class="members">
          <strong>Members:</strong>
          <ul>
            <li v-for="member in chat.members" :key="member">
              <code>{{ member }}</code>
            </li>
          </ul>

          <input
            v-model="newMemberActor"
            placeholder="Add member by Graffiti actor ID"
          />
          <button @click="addMember">Add Member</button>
        </section>

        <section class="messages">
          <article
            v-for="message in messages"
            :key="message.url"
            class="message"
          >
            <p>{{ message.content }}</p>
            <small>
              <code>{{ message.actor }}</code>
            </small>

            <StarButton
              :active="message.important"
              label="Mark message as important"
              @toggle="toggleImportant(message)"
            />
          </article>

          <p v-if="messages.length === 0">No messages yet.</p>
        </section>

        <form class="composer" @submit.prevent="sendMessage">
          <StarButton
            :active="draftImportant"
            label="Mark next message as important"
            @toggle="draftImportant = !draftImportant"
          />

          <input v-model="draftMessage" placeholder="Write your message" />
          <button type="submit">Send</button>
        </form>
      </section>
    </main>
  `,
};
