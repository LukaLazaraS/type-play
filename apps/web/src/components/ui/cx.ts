/** Class names joined with a space, the empty and false ones left out. */
export const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
