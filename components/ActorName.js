import { useGraffitiActorToHandle } from "@graffiti-garden/wrapper-vue";

export default {
  props: {
    actor: {
      type: String,
      required: true,
    },

    fallback: {
      type: String,
      default: "Member",
    },
  },

  setup(props) {
    const { handle } = useGraffitiActorToHandle(() => props.actor);

    return {
      handle,
    };
  },

  template: `
    <span>
      {{ handle || fallback }}
    </span>
  `,
};
