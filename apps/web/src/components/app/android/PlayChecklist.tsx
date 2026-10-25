"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
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
    <Card className="droid__play" aria-labelledby="droid-play">
      <div className="droid__play-head">
        <CardTitle id="droid-play">{t.title}</CardTitle>
        <Button look="quiet" size="small" aria-expanded={open} aria-controls="droid-play-steps" onClick={toggle}>
          {open ? t.hide : t.show}
        </Button>
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
                <Segmented
                  name="play-account"
                  legend={t.account.title}
                  legendLook="hint"
                  value={account}
                  onChange={pick}
                  options={t.account.options.map((o) => ({ value: o.id, label: o.label }))}
                  size="small"
                  className="playlist__account"
                >
                  <p className="playlist__rule" aria-live="polite">
                    {t.account[account]}
                  </p>
                </Segmented>
              )}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
