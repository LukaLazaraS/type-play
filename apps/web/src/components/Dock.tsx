import { AndroidLogo, DeviceMobile, Globe, Monitor } from "@phosphor-icons/react/dist/ssr";
import { platforms } from "@/content/site";

const icons = {
  Web: Globe,
  Android: AndroidLogo,
  iOS: DeviceMobile,
  Steam: Monitor,
} as const;

/** The platform slots: where a game ships, labelled by availability. */
export function PlatformSlots() {
  return (
    <div className="dock__slots">
      {platforms.map((p) => {
        const Icon = icons[p.name as keyof typeof icons];
        return (
          <div key={p.name} className={`slot${p.status === "now" ? " slot--live" : ""}`}>
            <Icon size={36} weight="regular" aria-hidden="true" />
            <div>
              <b>{p.name}</b>
              <small>{p.status}</small>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Dock() {
  return (
    <div className="dock" aria-label="Where your game ships">
      <div className="dock__cap">
        One game.
        <br />
        Every screen.
      </div>
      <PlatformSlots />
    </div>
  );
}
