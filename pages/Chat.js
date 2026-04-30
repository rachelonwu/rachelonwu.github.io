export default {
  props: ["store", "chatId"],

  data() {
    return {
      draftMessage: "",
      draftImportant: false,
      newMember: "",
    };
  },

  computed: {
    chat() {
      return this.store.chats.find(chat => chat.id === this.chatId);
    },
  },

  methods: {
    sendMessage() {
      if (!this.draftMessage.trim() || !this.chat) return;

      this.chat.messages.push({
        id: crypto.randomUUID(),
        sender: "Rachel",
        text: this.draftMessage,
        important: this.draftImportant,
        time: new Date().toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        }),
      });

      this.draftMessage = "";
      this.draftImportant = false;
    },

    toggleImportant(message) {
      message.important = !message.important;
    },

    addMember() {
      if (!this.newMember.trim() || !this.chat) return;

      this.chat.members.push(this.newMember.trim());
      this.newMember = "";
    },
  },

  template: `
    <main class="phone-shell" v-if="chat">
      <header class="topbar">
        <router-link to="/">Back</router-link>
        <h1>{{ chat.title }}</h1>
        <router-link :to="'/chat/' + chat.id + '/digest'">Chat Digest</router-link>
      </header>

      <section class="members">
        <strong>Members:</strong> {{ chat.members.join(", ") }}

        <div class="add-member">
          <input v-model="newMember" placeholder="Add member" />
          <button @click="addMember">Add</button>
        </div>
      </section>

      <section class="messages">
        <article
          v-for="message in chat.messages"
          :key="message.id"
          class="message"
        >
          <p>{{ message.text }}</p>
          <small>{{ message.sender }} · {{ message.time }}</small>

          <button
            class="star-button"
            :class="{ starred: message.important }"
            @click="toggleImportant(message)"
          >
            {{ message.important ? "★" : "☆" }}
          </button>
        </article>

        <p v-if="chat.messages.length === 0">No messages yet.</p>
      </section>

      <form class="composer" @submit.prevent="sendMessage">
        <button
          type="button"
          class="star-button"
          :class="{ starred: draftImportant }"
          @click="draftImportant = !draftImportant"
        >
          ★
        </button>

        <input v-model="draftMessage" placeholder="Write your message" />
        <button type="submit">Send</button>
      </form>
    </main>

    <main class="phone-shell" v-else>
      <p>Chat not found.</p>
      <router-link to="/">Back home</router-link>
    </main>
  `,
};
