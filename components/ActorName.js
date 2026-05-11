import { computed } from "vue";
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

    const displayName = computed(() => {
      const name = handle.value || props.actor || props.fallback;

      if (name.startsWith("did:")) {
        return props.fallback;
      }

      return name
        .replace(".graffiti.actor", "")
        .replace("https://", "")
        .replace("http://", "");
    });

    return {
      displayName,
    };
  },

  template: `
    <span>
      {{ displayName }}
    </span>
  `,
};
