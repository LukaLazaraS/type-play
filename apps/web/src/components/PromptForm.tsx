"use client";

import { useEffect, useRef, useState, type AnimationEvent, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Field";
import { cx } from "@/components/ui/cx";

const example =
  "Make an endless runner where a little robot jumps over cactuses and it gets faster over time.";

/** Event the launcher fires with a sentence to put in the box ("Make my own"). */
export const DRAFT_EVENT = "typeplay:draft";

/** Event that brings the visitor to the box ("Your game"): fired by callPrompt(). */
export const CALL_EVENT = "typeplay:call";
export const callPrompt = () => window.dispatchEvent(new Event(CALL_EVENT));

/** The live prompt box. Submitting hands the sentence to the builder (/create). */
export function PromptForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [called, setCalled] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onDraft = (e: Event) => {
      const sentence = (e as CustomEvent<string>).detail;
      setText(sentence);
      setError(null);
    };
    window.addEventListener(DRAFT_EVENT, onDraft);
    return () => window.removeEventListener(DRAFT_EVENT, onDraft);
  }, []);

  // Called: the cursor goes in the box, the page scrolls to it if it is not all on the screen (smoothly, unless reduced
  // motion), and once it is there the focus ring lands on the box (globals.css .prompt__field--called).
  useEffect(() => {
    let stop = () => {};
    const onCall = () => {
      const area = box.current;
      const field = area?.parentElement;
      if (!area || !field) return;
      stop();
      area.focus({ preventScroll: true });
      const land = () => {
        stop();
        setCalled(false);
        requestAnimationFrame(() => setCalled(true));
      };
      const { top, bottom } = field.getBoundingClientRect();
      if (top >= 0 && bottom <= window.innerHeight) return land();
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      field.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      if (reduce) return land();
      // The scroll's end: 100 ms without a scroll event (Safari has no scrollend).
      let timer = window.setTimeout(land, 200);
      const onScroll = () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(land, 100);
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      stop = () => {
        window.clearTimeout(timer);
        window.removeEventListener("scroll", onScroll);
        stop = () => {};
      };
    };
    window.addEventListener(CALL_EVENT, onCall);
    return () => {
      stop();
      window.removeEventListener(CALL_EVENT, onCall);
    };
  }, []);
  const onLanded = (e: AnimationEvent) => {
    if (e.animationName.startsWith("prompt-called")) setCalled(false);
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const sentence = text.trim();
    if (sentence.length < 8) {
      setError("Say a little more: what kind of game, and what you do in it.");
      box.current?.focus();
      return;
    }
    router.push(`/create?prompt=${encodeURIComponent(sentence)}`);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form className="prompt" onSubmit={submit} onAnimationEnd={onLanded} noValidate>
      <TextArea
        id="prompt"
        ref={box}
        label="What do you want to play?"
        boxClassName={cx("prompt__field", called && "prompt__field--called")}
        grow={160}
        name="prompt"
        rows={1}
        value={text}
        placeholder={example}
        onChange={(e) => {
          setText(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={onKey}
        hint="Free to start. No code. It plays right here in the browser."
        error={error}
        action={<Button type="submit">Make my game</Button>}
      />
    </form>
  );
}
