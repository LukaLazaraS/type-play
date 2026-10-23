// Addresses on the games origin (typeplay.dev live), for server and client code alike.
import { site } from "@/content/site";

/** A user's build's picture of its start screen (published with the build when the check made one). */
export const posterUrl = (buildId: string) => `${site.gamesOrigin}/builds/${encodeURIComponent(buildId)}/poster.png`;
