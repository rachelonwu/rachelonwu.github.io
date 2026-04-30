export default {
  props: ["store", "chatId"],

  computed: {
    chat() {
      return this.store.chats.find(chat => chat.id === this.chatId);
    },

    importantMessages() {
      if (!this.chat) return [];
      return this.chat.messages.filter(message => message.important);
    },
  },

  template: `
    <main class="phone-shell" v-if="chat">
      <header class="topbar">
        <router-link :to="'/chat/' + chat.id">Back</router-link>
        <h1>{{ chat.title }} Digest</h1>
      </header>

      <p class="page-note">
        Important messages from this chat only.
      </p>

      <section>
        <article
          v-for="message in importantMessages"
          :key="message.id"
          class="digest-card"
        >
          <p>{{ message.text }}</p>
          <small>{{ message.sender }} · {{ message.time }}</small>
        </article>

        <p v-if="importantMessages.length === 0">
          No important messages in this chat yet.
        </p>
      </section>
    </main>
  `,
};
