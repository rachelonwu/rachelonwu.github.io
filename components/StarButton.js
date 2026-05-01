export default {
  props: {
    active: {
      type: Boolean,
      required: true,
    },
    label: {
      type: String,
      default: "Toggle important message",
    },
  },

  emits: ["toggle"],

  template: `
    <button
      type="button"
      class="star-button"
      :class="{ starred: active }"
      :aria-label="label"
      @click="$emit('toggle')"
    >
      {{ active ? "★" : "☆" }}
    </button>
  `,
};
