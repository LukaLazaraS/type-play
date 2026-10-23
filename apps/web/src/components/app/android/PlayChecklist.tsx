"use client";

import { useState } from "react";
import { android } from "@/content/android";

type Account = "before" | "after" | "unsure";
const ACCOUNT_KEY = "typeplay.playAccount";
const OPEN_KEY = "typeplay.playSteps";
const kept = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const keep = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* not kept */
  }
};

/**
 * The Google Play checklist, static (§12 of the design): read once by someone who has never
 * published. Open on the first visit, then folded until asked (remembered on this device).
 */
export function PlayChecklist({ packageName }: { packageName: string }) {
  const t = android.play;
  const [open, setOpen] = useState(() => kept(OPEN_KEY) !== "closed");
  const [account, setAccount] = useState<Account>(() => {
    const a = kept(ACCOUNT_KEY);
    return a === "before" || a === "after" ? a : "unsure";
  });
  const toggle = () => {
    keep(OPEN_KEY, open ? "closed" : "open");
    setOpen(!open);
  };
  const pick = (a: Account) => {
    setAccount(a);
    keep(ACCOUNT_KEY, a);
  };

  return (
    <section className="widget acct__card droid__play" aria-labelledby="droid-play">
      <div className="droid__play-head">
        <h2 id="droid-play" className="acct__h">
          {t.title}
        </h2>
        <button type="button" className="button button--quiet button--small" aria-expanded={open} aria-controls="droid-play-steps" onClick={toggle}>
          {open ? t.hide : t.show}
        </button>
      </div>
      <p className="acct__note">{t.lead}</p>
      {open && (
        <ol id="droid-play-steps" className="playlist">
          {t.steps.map((s) => (
            <li key={s.title} className="playlist__step">
              <h3>{s.title}</h3>
              <p>
                {s.text}
                {s.link && (
                  <>
                    {" "}
                    <span className="figures playlist__link">{t.testersLink(packageName)}</span> {t.testersRule}
                  </>
                )}
              </p>
              {s.list && (
                <ul className="playlist__sub">
                  {s.list.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
              {s.account && (
                <fieldset className="playlist__account">
                  <legend className="field-hint">{t.account.title}</legend>
                  <div className="switch switch--small">
                    {t.account.options.map((o) => (
                      <label key={o.id} className="switch__opt" data-on={account === o.id || undefined}>
                        <input type="radio" name="play-account" value={o.id} checked={account === o.id} onChange={() => pick(o.id)} className="sr-only" />
                        {o.label}
                      </label>
                    ))}
                  </div>
                  <p className="playlist__rule" aria-live="polite">
                    {t.account[account]}
                  </p>
                </fieldset>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
