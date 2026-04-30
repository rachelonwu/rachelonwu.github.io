export default {
  props: ["store"],

  data() {
    return {
      newChatTitle: "",
      newMembers: "",
    };
  },

  methods: {
    latestPreview(chat) {
      if (chat.messages.length === 0) {
        return "No messages yet";
      }

      return chat.messages[chat.messages.length - 1].text;
    },

    createChat() {
      if (!this.newChatTitle.trim()) return;

      const members = this.newMembers
        .split(",")
        .map(member => member.trim())
        .filter(member => member.length > 0);

      this.store.chats.push({
        id: crypto.randomUUID(),
        title: this.newChatTitle,
        members: ["Rachel", ...members],
        messages: [],
      });

      this.newChatTitle = "";
      this.newMembers = "";
    },
  },

  template: `
    <main class="phone-shell">
      <header class="topbar">
        <h1>Messages</h1>
        <router-link to="/digest">All Chats Digest</router-link>
      </header>

      <section class="new-chat">
        <input v-model="newChatTitle" placeholder="New chat name" />
        <input v-model="newMembers" placeholder="Members, separated by commas" />
        <button @click="createChat">Create Chat</button>
      </section>

      <section class="chat-list">
        <router-link
          v-for="chat in store.chats"
          :key="chat.id"
          class="chat-row"
          :to="'/chat/' + chat.id"
        >
          <strong>{{ chat.title }}</strong>
          <span>{{ latestPreview(chat) }}</span>
          <small>Members: {{ chat.members.join(", ") }}</small>
        </router-link>
      </section>
    </main>
  `,
};
