// The one continuous field: dusk sky bands drawn flat, like the agent draws its 2D games.
// Fixed to the viewport so every section slides over the same sky. The ground (dunes, sun)
// belongs to a section, see Ground.tsx, so white text never scrolls over the sand.
export function Wallpaper() {
  return (
    <svg
      className="wallpaper"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <rect width="1440" height="900" fill="#1c1240" />
      <rect y="250" width="1440" height="650" fill="#2a1858" />
      <rect y="400" width="1440" height="500" fill="#3d206b" />
      <rect y="520" width="1440" height="380" fill="#572877" />
      <rect y="640" width="1440" height="260" fill="#6a2c7a" />
      <g fill="#fff" opacity=".12">
        <rect x="1150" y="98" width="190" height="34" rx="17" />
        <rect x="1200" y="80" width="90" height="40" rx="20" />
      </g>
      <g fill="#fff" opacity=".7">
        <circle cx="420" cy="120" r="1.6" />
        <circle cx="980" cy="80" r="1.4" />
        <circle cx="1300" cy="150" r="1.8" />
        <circle cx="640" cy="60" r="1.2" />
        <circle cx="80" cy="260" r="1.4" />
      </g>
    </svg>
  );
}
