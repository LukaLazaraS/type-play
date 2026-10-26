/**
 * The 8px hot dot that breathes while something runs (a build, a payment landing); still under reduced motion.
 * `still`: the waiting dot, in the text's own colour and never breathing: a build waiting for its turn, where nothing
 * runs yet (the dot starts breathing when it starts).
 */
export function Pulse({ still = false }: { still?: boolean }) {
  return <span className={still ? "pulse pulse--still" : "pulse"} aria-hidden="true" />;
}
