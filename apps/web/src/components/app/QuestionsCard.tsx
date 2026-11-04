"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { Estimate, Questions } from "@typeplay/shared";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ChipChoice } from "@/components/ui/ChipChoice";
import { ErrorLine } from "@/components/ui/ErrorLine";
import { TextArea } from "@/components/ui/Field";
import { questions as words } from "@/content/app";
import { ApiFailure } from "@/lib/api";
import { creditsWord } from "@/lib/format";

/** A pick per question: an answer's place ("0".."3"), You decide, or the player's own words. */
const DECIDE = "decide";
const OWN = "own";
const MAX_OWN = 120;
/** The API's answers that mean "no credits for this": the card offers the way to more. */
const CREDITS = ["no_credits", "daily_limit"];

/** Where "Answer them" (the stage, a phone's Play tab) sends the keyboard: the first question's picked pill. */
export const QUESTIONS_FORM = "questions-form";
export function focusQuestions() {
  document.querySelector<HTMLInputElement>(`#${QUESTIONS_FORM} input[type="radio"]:checked`)?.focus();
}

/** The answers as the picks say them: an answer's words, the player's own (empty: You decide), or null for You decide. */
function answersOf(q: Questions, picks: string[], own: string[]): (string | null)[] {
  return q.items.map((item, i) => {
    if (picks[i] === DECIDE) return null;
    if (picks[i] === OWN) return own[i].trim() || null;
    return item.options[Number(picks[i])] ?? null;
  });
}

/**
 * The questions the AI asked before a build, while open (2026-11-04; Message.questions): each a ChipChoice of its 2-4
 * answers, then on a row of their own You decide (picked at first: Build it as it is leaves every point to the AI) and
 * Type my own, which opens a box under the pills (the keyboard goes there when a finger or a mouse picked it; Enter there
 * moves to the next question, never builds). One hot Build it, described by the AI it builds on and its usual cost (the
 * price agreed when the idea was sent: the API asks no second time). Build it sends the answers in order (null: You
 * decide, or an own answer left empty); a refusal shows the API's sentence, with the way to more credits when that is
 * what stands in the way. `onDraft` hears the answers as they are picked (the composer's Send carries them). The card
 * and its words take the questions' language (`lang`). `labelledBy`: the AI's line before the questions.
 */
export function QuestionsCard({
  messageId,
  questions,
  model,
  cost,
  labelledBy,
  onAnswer,
  onDraft,
  ownCredits = true,
}: {
  messageId: string;
  questions: Questions;
  /** "Smart", or "Smart, high effort". */
  model: string;
  cost: Estimate | null;
  labelledBy: string;
  onAnswer: (answers: (string | null)[]) => Promise<void>;
  onDraft?: (answers: (string | null)[]) => void;
  /** False in someone else's game (pair developing): its owner's credits pay, so a refusal for credits offers no checkout. */
  ownCredits?: boolean;
}) {
  const count = questions.items.length;
  const [picks, setPicks] = useState<string[]>(() => Array.from({ length: count }, () => DECIDE));
  const [own, setOwn] = useState<string[]>(() => Array.from({ length: count }, () => ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; credits: boolean } | null>(null);
  // A box opened by a finger or a mouse takes the keyboard as it comes onto the page; the arrow keys never move it there.
  const focusNext = useRef<number | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const costId = `${QUESTIONS_FORM}-cost`;

  const update = (nextPicks: string[], nextOwn: string[]) => {
    setPicks(nextPicks);
    setOwn(nextOwn);
    onDraft?.(answersOf(questions, nextPicks, nextOwn));
  };
  const pick = (i: number, value: string, byPointer: boolean) => {
    update(
      picks.map((v, j) => (j === i ? value : v)),
      own,
    );
    if (error) setError(null);
    focusNext.current = value === OWN && byPointer ? i : null;
  };
  // Enter in an own answer: on to the next question's pick (or to Build it after the last), never a build by accident.
  const onOwnKey = (i: number) => (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    const next = form.current?.querySelectorAll<HTMLFieldSetElement>("fieldset")[i + 1];
    (next?.querySelector<HTMLInputElement>('input[type="radio"]:checked') ?? form.current?.querySelector<HTMLButtonElement>('button[type="submit"]'))?.focus();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onAnswer(answersOf(questions, picks, own));
      // Sent: the chat moves on (this card closes with the next message).
    } catch (err) {
      setError({ text: err instanceof Error ? err.message : String(err), credits: err instanceof ApiFailure && CREDITS.includes(err.code) });
      setBusy(false);
    }
  };

  return (
    <form ref={form} id={QUESTIONS_FORM} className="questions" lang={questions.lang} aria-labelledby={labelledBy} onSubmit={submit} noValidate>
      {questions.items.map((q, i) => (
        <div key={`${messageId}-${i}`} className="questions__one">
          <ChipChoice
            name={`answer-${messageId}-${i}`}
            legend={
              <>
                {count > 1 && (
                  <span className="sr-only" lang="en">
                    {words.count(i + 1, count)}
                  </span>
                )}
                {q.text}
              </>
            }
            value={picks[i]}
            onChange={(v, byPointer) => pick(i, v, byPointer)}
            disabled={busy}
            breakBefore={q.options.length}
            options={[...q.options.map((o, n) => ({ value: String(n), label: o })), { value: DECIDE, label: questions.decide }, { value: OWN, label: questions.own ?? words.own }]}
          />
          {picks[i] === OWN && (
            <TextArea
              id={`own-${messageId}-${i}`}
              ref={(el) => {
                if (el && focusNext.current === i) {
                  focusNext.current = null;
                  el.focus();
                }
              }}
              label={words.ownLabel(q.text)}
              labelHidden
              line
              boxClassName="questions__own"
              grow={96}
              rows={1}
              value={own[i]}
              maxLength={MAX_OWN}
              placeholder={words.ownPlaceholder}
              enterKeyHint={i === count - 1 ? "done" : "next"}
              disabled={busy}
              onKeyDown={onOwnKey(i)}
              onChange={(e) => {
                const v = e.target.value.replace(/\s*\n\s*/g, " ");
                update(
                  picks,
                  own.map((x, j) => (j === i ? v : x)),
                );
              }}
            />
          )}
        </div>
      ))}
      <div className="questions__go" lang="en">
        <Button type="submit" size="small" busy={busy} busyLabel={words.building} aria-describedby={costId}>
          {words.build}
        </Button>
        <span id={costId} className="questions__cost figures">
          {words.buildsOn(model, cost ? creditsWord(cost.typical) : null)}
        </span>
      </div>
      {error && (
        <div className="questions__error" lang="en">
          <ErrorLine>{error.text}</ErrorLine>
          {error.credits && ownCredits && (
            <ButtonLink href="/billing?change=1" size="small">
              {words.getCredits}
            </ButtonLink>
          )}
        </div>
      )}
    </form>
  );
}
