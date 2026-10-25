import type { ComponentPropsWithRef } from "react";

/**
 * A button whose look is the piece it makes clickable, not a button's: an app icon, a listing, the notice, a game card,
 * the Play pill over a poster. No look of its own (the class is the piece's); it is a <button type="button"> unless it
 * says submit, and takes a ref (motion.create(Pressable) animates it). A link-shaped piece is a plain Link.
 */
export function Pressable({ type = "button", ...rest }: ComponentPropsWithRef<"button">) {
  return <button {...rest} type={type} />;
}
