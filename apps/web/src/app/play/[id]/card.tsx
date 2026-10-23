// The share page's link preview (1200×630): the game's own start screen on the site's flat dusk
// desert, its name, "Made with TypePlay" and the one hot button. Drawn with next/og (Satori:
// flexbox only, inline styles). Fonts are the site's own, from assets/fonts (SIL OFL, licences there).
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import type { PublicGame } from "@typeplay/shared";
import { publicGame, UNAVAILABLE } from "@/lib/public";
import { posterUrl } from "@/lib/urls";

const size = { width: 1200, height: 630 };

const fonts = Promise.all([
  readFile(join(process.cwd(), "assets/fonts/Gabarito-Black.ttf")),
  readFile(join(process.cwd(), "assets/fonts/Onest-SemiBold.ttf")),
]);

const C = {
  sky: ["#1c1240", "#2a1858", "#3d206b", "#572877", "#6a2c7a"],
  dune1: "#a63e68",
  dune2: "#d9645a",
  sand: "#f3a35c",
  sun: "#ffb347",
  hot: "#ff5a36",
  ink: "#170d33",
  ink2: "#251948",
};

/** The poster as a data URL (Satori draws only what it is handed), or null without one. */
async function posterData(game: PublicGame): Promise<string | null> {
  if (!game.poster) return null;
  try {
    const res = await fetch(posterUrl(game.buildId), { cache: "no-store" });
    if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/png")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length < 8 << 20 ? `data:image/png;base64,${buf.toString("base64")}` : null;
  } catch {
    return null;
  }
}

export async function renderCard(id: string) {
  const game = await publicGame(id);
  if (!game) notFound();
  // The API gave no answer: 503, so a link preview is tried again later rather than cached empty.
  if (game === UNAVAILABLE) return new Response("The games service is not answering right now.", { status: 503, headers: { "cache-control": "no-store" } });
  const [[gabarito, onest], poster] = await Promise.all([fonts, posterData(game)]);
  const portrait = game.orientation === "portrait";
  // The screen as big as the card allows: a phone held upright, or a wide screen.
  const screen = portrait ? { width: 300, height: 534 } : { width: 528, height: 297 };
  // Long names get smaller, and smaller still beside a wide screen: up to 60 letters fit in 3 lines.
  const room = portrait ? 1 : 0.82;
  const nameSize = Math.round((game.name.length > 40 ? 52 : game.name.length > 24 ? 64 : 80) * room);
  const letter = (game.name.trim().match(/[\p{L}\p{N}]/u)?.[0] ?? "?").toUpperCase();

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: C.sky[0], fontFamily: "Onest" }}>
        {/* The wallpaper: five flat sky bands, then the dunes and the sand. */}
        <div style={{ position: "absolute", left: 0, top: 0, width: 1200, height: 630, display: "flex", flexDirection: "column" }}>
          {C.sky.map((c, i) => (
            <div key={c} style={{ display: "flex", width: 1200, height: i === 4 ? 210 : 105, background: c }} />
          ))}
        </div>
        <svg width="1200" height="630" viewBox="0 0 1200 630" style={{ position: "absolute", left: 0, top: 0 }}>
          <path d="M0 470 C260 420 520 500 820 455 C980 432 1100 448 1200 440 V630 H0Z" fill={C.dune1} />
          <path d="M0 530 C300 500 640 560 1200 512 V630 H0Z" fill={C.dune2} />
          <path d="M0 585 C380 566 820 600 1200 578 V630 H0Z" fill={C.sand} />
        </svg>

        <div style={{ position: "absolute", left: 0, top: 0, width: 1200, height: 630, display: "flex", alignItems: "center", padding: "0 64px", gap: 56 }}>
          {/* The game's screen in an ink bezel: a device lying on the wallpaper (depth by overlap). */}
          <div
            style={{
              display: "flex",
              width: screen.width + 28,
              height: screen.height + 28,
              padding: 14,
              borderRadius: 40,
              background: C.ink,
              flexShrink: 0,
            }}
          >
          <div
            style={{
              display: "flex",
              width: screen.width,
              height: screen.height,
              borderRadius: 26,
              overflow: "hidden",
              background: C.ink2,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={poster} width={screen.width} height={screen.height} style={{ objectFit: "cover", borderRadius: 26 }} alt="" />
            ) : (
              <div style={{ display: "flex", width: "100%", height: "100%", position: "relative", alignItems: "center", justifyContent: "center", background: C.sky[2] }}>
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "34%", background: C.dune1, display: "flex" }} />
                <div style={{ fontFamily: "Gabarito", fontSize: portrait ? 200 : 180, color: "#ffffff", lineHeight: 1 }}>{letter}</div>
              </div>
            )}
          </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: "Gabarito, Onest",
                fontSize: nameSize,
                lineHeight: 0.95,
                letterSpacing: "-0.03em",
                color: "#ffffff",
                display: "flex",
                flexWrap: "wrap",
              }}
            >
              {game.name}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", marginTop: 26, fontSize: 30, color: "rgba(255,255,255,0.86)" }}>
              <span>Made with</span>
              <span style={{ fontFamily: "Gabarito", marginLeft: 10, color: "#ffffff", fontSize: 34 }}>Type</span>
              <span style={{ fontFamily: "Gabarito", color: C.sun, fontSize: 34 }}>Play</span>
            </div>
            <div style={{ display: "flex", marginTop: 40 }}>
              <div style={{ display: "flex", background: C.hot, color: C.ink, fontSize: 30, padding: "16px 30px", borderRadius: 999 }}>Play it free</div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Gabarito", data: gabarito, weight: 900, style: "normal" },
        { name: "Onest", data: onest, weight: 600, style: "normal" },
      ],
    },
  );
}
