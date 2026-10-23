/** The empty slot: a game assembling itself from flat layers (sky, dune, sun, robot). */
export function BuildingIcon() {
  return (
    <a href="#prompt" className="app" aria-label="Your game: start one in the prompt box">
      <span className="app__icon build" aria-hidden="true">
        <BuildLayers />
      </span>
      <span className="app__name">Your game</span>
      <span className="app__stat build__label">
        <span className="build__building">building…</span>
        <span className="build__ready">ready</span>
      </span>
    </a>
  );
}

/** The four layers that paste in on the 6-second clock; also the app's "building" picture. */
export function BuildLayers() {
  return (
    <>
      <svg className="build__layer" viewBox="0 0 112 112">
        <rect width="112" height="112" fill="#2a1858" />
        <rect y="44" width="112" height="68" fill="#572877" />
      </svg>
      <svg className="build__layer" viewBox="0 0 112 112">
        <path d="M0 86 C30 74 62 92 112 78 V112 H0Z" fill="#a63e68" />
        <path d="M0 98 C40 92 80 100 112 94 V112 H0Z" fill="#f3a35c" />
      </svg>
      <svg className="build__layer" viewBox="0 0 112 112">
        <circle cx="80" cy="60" r="15" fill="#ffb347" />
      </svg>
      <svg className="build__layer" viewBox="0 0 112 112">
        <rect x="26" y="66" width="18" height="16" rx="3" fill="#8fd3ff" />
        <rect x="30" y="70" width="4" height="4" fill="#170d33" />
        <rect x="37" y="70" width="4" height="4" fill="#170d33" />
        <rect x="28" y="84" width="5" height="8" fill="#170d33" />
        <rect x="37" y="84" width="5" height="8" fill="#170d33" />
        <rect x="34" y="58" width="2" height="8" fill="#170d33" />
        <circle cx="35" cy="57" r="2.5" fill="#ff5a36" />
      </svg>
    </>
  );
}
