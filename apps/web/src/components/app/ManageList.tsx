"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { DownloadSimple, PencilSimple, Trash } from "@phosphor-icons/react";
import type { Project, ProjectSummary } from "@typeplay/shared";
import { posterUrl } from "@/lib/urls";
import { api, saveFile } from "@/lib/api";
import { ago, playsWord } from "@/lib/format";
import { GameTile } from "./GameTile";

const summaryOf = (p: Project): ProjectSummary => ({
  id: p.id,
  name: p.name,
  orientation: p.orientation,
  platform: p.platform,
  buildId: p.buildId,
  status: p.status,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
  shared: p.shared,
  poster: p.poster,
  listed: p.listed,
  galleryHidden: p.galleryHidden,
  plays: p.plays,
});

/** /games, "Manage": every game as a row with Rename, Download and Delete (which asks first). */
export function ManageList({
  games,
  onChange,
  onRemoved,
}: {
  games: ProjectSummary[];
  onChange: (g: ProjectSummary) => void;
  onRemoved: (id: string) => void;
}) {
  return (
    <ul className="widget manage" aria-label="Manage your games">
      {games.map((g) => (
        <Row key={g.id} game={g} onChange={onChange} onRemoved={onRemoved} />
      ))}
    </ul>
  );
}

function Row({ game, onChange, onRemoved }: { game: ProjectSummary; onChange: (g: ProjectSummary) => void; onRemoved: (id: string) => void }) {
  const [mode, setMode] = useState<"idle" | "rename" | "delete">("idle");
  const [busy, setBusy] = useState<"rename" | "download" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(game.name);
  const running = game.status === "running";
  const meta = [
    running ? "building…" : game.buildId ? `changed ${ago(game.updatedAt)}` : "not built yet",
    game.shared ? (game.listed && !game.galleryHidden ? "shared, in the gallery" : "shared") : null,
    game.plays > 0 ? playsWord(game.plays) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const run = async (what: "rename" | "download" | "delete", work: () => Promise<void>) => {
    setBusy(what);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const rename = (e: FormEvent) => {
    e.preventDefault();
    const next = name.replace(/\s+/g, " ").trim();
    if (!next || next === game.name) {
      setName(game.name);
      setMode("idle");
      return;
    }
    void run("rename", async () => {
      onChange(summaryOf(await api.update(game.id, { name: next })));
      setMode("idle");
    });
  };

  return (
    <li className="manage__row" data-mode={mode}>
      <span className="app__icon manage__icon" aria-hidden="true">
        <GameTile id={game.id} name={game.name} building={running && !game.buildId} poster={game.buildId && game.poster ? posterUrl(game.buildId) : null} />
      </span>

      <div className="manage__text">
        {mode === "rename" ? (
          <form className="manage__rename" onSubmit={rename} noValidate>
            <label htmlFor={`name-${game.id}`} className="sr-only">
              New name for {game.name}
            </label>
            <div className="field manage__field">
              <input
                id={`name-${game.id}`}
                value={name}
                maxLength={60}
                autoFocus
                enterKeyHint="done"
                autoComplete="off"
                spellCheck={false}
                disabled={busy === "rename"}
                onChange={(e) => setName(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setName(game.name);
                    setMode("idle");
                  }
                }}
              />
            </div>
            <div className="manage__buttons">
              <button type="submit" className="button button--small" disabled={busy === "rename"}>
                {busy === "rename" ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="button button--quiet button--small"
                disabled={busy === "rename"}
                onClick={() => {
                  setName(game.name);
                  setError(null);
                  setMode("idle");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <Link href={`/games/${game.id}`} className="manage__name" prefetch={false}>
              {game.name}
            </Link>
            <span className="figures manage__meta">{meta}</span>
          </>
        )}
        {mode === "delete" && (
          <p className="manage__ask" id={`ask-${game.id}`}>
            Delete it for good? Every version goes, and its share page{running ? ", and the build that is running now" : ""}. You can&apos;t undo this.
          </p>
        )}
        {error && (
          <p className="composer__error" role="alert">
            {error}
          </p>
        )}
      </div>

      {mode === "delete" ? (
        <div className="manage__buttons manage__actions" role="group" aria-labelledby={`ask-${game.id}`}>
          <button
            type="button"
            className="button button--ink button--small"
            disabled={busy === "delete"}
            onClick={() => void run("delete", async () => {
              await api.remove(game.id);
              onRemoved(game.id);
            })}
          >
            {busy === "delete" ? "Deleting…" : "Delete game"}
          </button>
          <button type="button" className="button button--quiet button--small" disabled={busy === "delete"} onClick={() => setMode("idle")}>
            Keep it
          </button>
        </div>
      ) : (
        mode === "idle" && (
          <div className="manage__buttons manage__actions">
            <button
              type="button"
              className="button button--quiet button--small"
              onClick={() => {
                setName(game.name); // a build may have renamed it since this row was made
                setError(null);
                setMode("rename");
              }}
              aria-label={`Rename ${game.name}`}
            >
              <PencilSimple size={16} weight="bold" aria-hidden="true" />
              Rename
            </button>
            <button
              type="button"
              className="button button--quiet button--small"
              disabled={!game.buildId || running || busy === "download"}
              title={!game.buildId ? "There is nothing to download yet." : running ? "When this build is done." : "A .zip to open in Godot 4.7"}
              onClick={() => void run("download", async () => saveFile(await api.download(game.id)))}
              aria-label={`Download ${game.name}`}
            >
              <DownloadSimple size={16} weight="bold" aria-hidden="true" />
              {busy === "download" ? "Preparing…" : "Download"}
            </button>
            <button
              type="button"
              className="button button--quiet button--small"
              onClick={() => {
                setError(null);
                setMode("delete");
              }}
              aria-label={`Delete ${game.name}`}
            >
              <Trash size={16} weight="bold" aria-hidden="true" />
              Delete
            </button>
          </div>
        )
      )}
    </li>
  );
}
