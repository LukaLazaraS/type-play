"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

const example =
  "Make an endless runner where a little robot jumps over cactuses and it gets faster over time.";

/** Event the launcher fires with a sentence to put in the box ("Make my own"). */
export const DRAFT_EVENT = "typeplay:draft";

/** The live prompt box. Submitting hands the sentence to the builder (/create). */
export function PromptForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

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
    <form className="prompt" onSubmit={submit} noValidate>
      <label htmlFor="prompt">What do you want to play?</label>
      <div className="prompt__field">
        <textarea
          id="prompt"
          ref={box}
          name="prompt"
          rows={1}
          value={text}
          placeholder={example}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={onKey}
          aria-describedby="prompt-hint"
          aria-invalid={error ? true : undefined}
        />
        <button className="button" type="submit">
          Make my game
        </button>
      </div>
      <div id="prompt-hint" className="prompt__hint" role={error ? "alert" : undefined}>
        {error ?? "Free to start. No code. It plays right here in the browser."}
      </div>
    </form>
  );
}
