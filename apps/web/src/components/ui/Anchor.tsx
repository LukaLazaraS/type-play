import Link from "next/link";
import type { ComponentPropsWithRef } from "react";

export type AnchorProps = Omit<ComponentPropsWithRef<"a">, "href"> & {
  href: string;
  /** Opens in a new tab (target _blank, rel noopener), as a plain <a>. */
  newTab?: boolean;
  /** Next's prefetch, for a path on this site. */
  prefetch?: boolean | null;
};

/**
 * Every link of the site's pieces: a path on this site through Next's Link (client navigation), anything else (a
 * #place on the page, mailto:, the games origin) or a new tab as a plain <a>.
 */
export function Anchor({ href, newTab, prefetch, ...rest }: AnchorProps) {
  if (newTab || !href.startsWith("/")) return <a href={href} {...(newTab ? { target: "_blank", rel: "noopener" } : {})} {...rest} />;
  return <Link href={href} prefetch={prefetch} {...rest} />;
}
