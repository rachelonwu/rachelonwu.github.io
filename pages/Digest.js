export default {
  props: ["store"],

  computed: {
    digestItems() {
      const items = [];

      for (const chat of this.store.chats) {
        for (const message of chat.messages) {
          if (message.important) {
            items.push({
              chatId: chat.id,
              chatTitle: chat.title,
              text: message.text,
              sender: message.sender,
              time: message.time,
            });
          }
        }
      }

      return items;
    },
  },

  template: `
    <main class="phone-shell">
      <header class="topbar">
        <router-link to="/">Back</router-link>
        <h1>All Chats Digest</h1>
      </header>

      <p class="page-note">
        Important messages from all chats.
      </p>

      <section>
        <article
          v-for="item in digestItems"
          :key="item.chatTitle + item.text"
          class="digest-card"
        >
          <strong>{{ item.chatTitle }}</strong>
          <p>{{ item.text }}</p>
          <small>{{ item.sender }} · {{ item.time }}</small>
          <br />
          <router-link :to="'/chat/' + item.chatId">Open chat</router-link>
        </article>

        <p v-if="digestItems.length === 0">
          No important messages yet.
        </p>
      </section>
    </main>
  `,
};
