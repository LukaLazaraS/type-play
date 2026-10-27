// The genre and tags a player picks for a new game on /create (2026-10-27): one genre at most (none: the game agent picks
// one from the idea), and any tags, but not both of a pair that contradicts itself (2d and 3d, cozy and hard; firstperson
// is always 3d, so not with 2d either). The game agent has a skill per genre (packages/agent/genres/) and a rule per tag
// (packages/agent/tags/); run.mjs refuses anything else too.
import type { GameTag, Genre } from "@typeplay/shared";
import { badRequest } from "../common/api-error.js";
import { GENRES } from "../gallery/gallery.service.js";

/** In the order /create shows them; a build's tags keep this order. */
export const TAGS: GameTag[] = ["2d", "3d", "firstperson", "retro", "cute", "scifi", "fantasy", "cozy", "hard", "roguelike", "turnbased", "2players"];

export interface Picks {
  genre: Genre | null;
  tags: GameTag[];
}

const isGenre = (g: unknown): g is Genre => (GENRES as unknown[]).includes(g);
const isTag = (t: unknown): t is GameTag => (TAGS as unknown[]).includes(t);

/** The new-game body's genre and tags; left out: no genre (the agent picks one) and no tags. */
export function parsePicks(body: unknown): Picks {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const genre = b.genre ?? null;
  if (genre !== null && !isGenre(genre)) throw badRequest("Pick one of the genres, or none.");
  const tags = b.tags ?? [];
  if (!Array.isArray(tags) || !tags.every(isTag) || new Set(tags).size !== tags.length) throw badRequest("Pick tags from the list, each once.");
  if (tags.includes("2d") && tags.includes("3d")) throw badRequest("Pick 2D or 3D, not both.");
  if (tags.includes("cozy") && tags.includes("hard")) throw badRequest("Pick Cozy or Hard, not both.");
  if (tags.includes("firstperson") && tags.includes("2d")) throw badRequest("First-person is 3D: pick it without 2D.");
  return { genre, tags: TAGS.filter((t) => tags.includes(t)) };
}

/** A project's or a waiting build's stored picks, read back through the same lists. */
export function picksOf(stored: { genre: string | null; tags: string[] }): Picks {
  return { genre: isGenre(stored.genre) ? stored.genre : null, tags: TAGS.filter((t) => stored.tags.includes(t)) };
}
