// <model-viewer> (Google's web component for glTF models, @google/model-viewer) in JSX: the attributes ui/ModelView.tsx
// sets. React 19 passes them to the element as written.
import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        poster?: string;
        alt?: string;
        class?: string;
        "camera-controls"?: string;
        "auto-rotate"?: string;
        "auto-rotate-delay"?: string;
        "rotation-per-second"?: string;
        "interaction-prompt"?: string;
        "shadow-intensity"?: string;
        exposure?: string;
        "environment-image"?: string;
        "touch-action"?: string;
        "disable-pan"?: string;
      };
    }
  }
}
