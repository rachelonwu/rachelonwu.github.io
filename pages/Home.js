import {
  useGraffiti,
  useGraffitiSession,
} from "@graffiti-garden/wrapper-vue";

export default {
  setup() {
    const graffiti = useGraffiti();
    const session = useGraffitiSession();

    async function login() {
      await graffiti.login();
    }

    async function logout() {
      if (session.value) {
        await graffiti.logout(session.value);
      }
    }

    return {
      session,
      login,
      logout,
    };
  },

  template: `
    <main class="phone-shell">
      <h1>Important Messages Chat App</h1>

      <section v-if="session === undefined">
        <p>Loading Graffiti...</p>
      </section>

      <section v-else-if="session === null">
        <p>You are not logged in.</p>
        <button @click="login">Log in / Create Graffiti Actor</button>
      </section>

      <section v-else>
        <p>You are logged in.</p>

        <p>
          Your Graffiti actor ID:
          <code>{{ session.actor }}</code>
        </p>

        <button @click="logout">Log out</button>
      </section>
    </main>
  `,
};
