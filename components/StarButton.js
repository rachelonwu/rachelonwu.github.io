export default {
  props: {
    active: {
      type: Boolean,
      required: true,
    },

    label: {
      type: String,
      default: "Mark as starred",
    },

    disabled: {
      type: Boolean,
      default: false,
    },
  },

  emits: ["toggle"],

  template: `
    <button
      type="button"
      class="star-button"
      :class="{ starred: active }"
      :aria-label="label"
      :title="label"
      :disabled="disabled"
      @click="$emit('toggle')"
    >
      {{ active ? "★" : "☆" }}
    </button>
  `,
};
