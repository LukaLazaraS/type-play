// Numbers and times as the app's screens say them.

const one = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/** 20, 12.4, 0.3, 1,300. Credits have one decimal at most. */
export const credits = (n: number) => one.format(Math.round(n * 10) / 10);

/** "1 credit", "0.4 credits", "20 credits". */
export const creditsWord = (n: number) => `${credits(n)} ${Math.round(n * 10) === 10 ? "credit" : "credits"}`;

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** "1 play", "940 plays", "1.2K plays", "10M plays": a play count as the gallery and the Share menu say it. */
export const playsWord = (n: number) => `${n < 1000 ? n : compact.format(n)} ${n === 1 ? "play" : "plays"}`;

/** "just now", "5 min ago", "2 h ago", "yesterday", "3 days ago", then the date. */
export function ago(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d} days ago`;
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: d > 300 ? "numeric" : undefined });
}

/** "in about 6 hours", "in about an hour", "in less than an hour": until the free credits' day
 * turns over (midnight UTC), said as a wait rather than a clock time in a zone the player may not know. */
export function untilUtcMidnight(now = Date.now()): string {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  const h = Math.round((next.getTime() - now) / 3_600_000);
  return h < 1 ? "in less than an hour" : h === 1 ? "in about an hour" : `in about ${h} hours`;
}

/** Words that stay on one line ("37 builds ahead", "about 1 h 35 min"): a line breaks only between them. */
const unbroken = (s: string) => s.replace(/ /g, "\u00a0");

/** "next in line", "1 build ahead", "12 builds ahead": a build's place while it waits for its turn (QueuePlace.ahead);
 * "in line" when the number is missing. */
export const aheadWord = (n: number) =>
  !Number.isFinite(n) ? "in line" : unbroken(n <= 0 ? "next in line" : n === 1 ? "1 build ahead" : `${n.toLocaleString("en-US")} builds ahead`);

/**
 * "any minute now", "about 6 min", "about 1 h", "about 1 h 20 min": the rough wait until a build in line starts
 * (QueuePlace.waitMin). A minute or less is "any minute now": the API's floor while the build ahead runs past its usual length.
 */
export function waitWord(min: number): string {
  if (!Number.isFinite(min)) return "";
  // Past an hour, to the nearest 5 minutes: a rough guess shouldn't look exact ("about 1 h 1 min").
  const m = Math.max(1, Math.round(min) < 60 ? Math.round(min) : Math.round(min / 5) * 5);
  const h = Math.floor(m / 60);
  return unbroken(m <= 1 ? "any minute now" : m < 60 ? `about ${m} min` : m % 60 ? `about ${h} h ${m % 60} min` : `about ${h} h`);
}

/** A rough wait that runs past the moment the build would leave the line (QueuePlace.leavesAt): the line is too long for it. */
export const tooLong = (q: { waitMin: number; leavesAt: string }, now = Date.now()) => now + q.waitMin * 60_000 > Date.parse(q.leavesAt);

/** "2 builds ahead · about 6 min": a waiting build's place and wait, as one figures line (the dot keeps to the part
 * before it, so a narrow line never starts with it). */
export const placeWords = (q: { ahead: number; waitMin: number }) => [aheadWord(q.ahead), waitWord(q.waitMin)].filter(Boolean).join("\u00a0· ");

/** 0:42, 3:05, 12:00: how long a build has been running. */
export function clock(fromIso: string, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - Date.parse(fromIso)) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "$20", "$14.50", "$1,300": US dollars, with cents only when there are some. */
export const usd = (n: number) => {
  const cents = Math.round(n * 100);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(cents / 100);
};

/** "$14.00": always with cents (what a card is charged). */
export const usdCents = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.round(n * 100) / 100);

/** "17 Nov" (with the year when it isn't this year). */
export const dayOf = (iso: string) => whenParts(iso).day;

/** "17 Oct" and "14:05" ("3 Mar 2025" before this year): a line in the credit history. */
export function whenParts(iso: string, now = Date.now()): { day: string; time: string } {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return { day: "", time: "" };
  const year = d.getFullYear() !== new Date(now).getFullYear();
  return {
    day: d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: year ? "numeric" : undefined }),
    time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  };
}
