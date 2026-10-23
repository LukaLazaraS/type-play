"use client";

import { useState } from "react";
import type { AndroidState, Project } from "@typeplay/shared";
import { android } from "@/content/android";
import { api } from "@/lib/api";
import { IdentityForm, type Identity } from "./IdentityForm";

/** The first visit: the app's name, package name and icon, then "Set up Android" makes the key and the hub appears. */
export function Setup({ project, onDone }: { project: Project; onDone: (state: AndroidState, notice: string | null, iconPreview: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setup = async (v: Identity) => {
    setBusy(true);
    setError(null);
    try {
      let state = await api.android.setup(project.id, { appName: v.appName, packageName: v.packageName });
      let notice: string | null = null;
      if (v.iconPng) {
        // Set up either way: an icon that is refused can be uploaded again from the identity card.
        try {
          state = await api.android.update(project.id, { iconPng: v.iconPng });
        } catch (e) {
          notice = e instanceof Error ? e.message : String(e);
        }
      }
      onDone(state, notice, state.app?.hasIcon ? (v.iconPreview ?? null) : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <section className="widget acct__card droid__setup" aria-labelledby="droid-setup">
      <h2 id="droid-setup" className="title droid__h2">
        {android.setup.title}
      </h2>
      <p className="acct__note">{android.setup.lead}</p>
      <p className="acct__note">{android.formats.line}</p>
      <IdentityForm project={project} app={null} busy={busy} error={error} submitLabel={android.setup.go} busyLabel={android.setup.busy} onSubmit={(v) => void setup(v)} />
    </section>
  );
}
