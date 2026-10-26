"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { DownloadSimple, PencilSimple, Trash } from "@phosphor-icons/react";
import type { Project, ProjectSummary } from "@typeplay/shared";
import { AppTile } from "@/components/ui/AppIcon";
import { Button } from "@/components/ui/Button";
import { ErrorLine } from "@/components/ui/ErrorLine";
import { TextField } from "@/components/ui/Field";
import { inLine } from "@/content/app";
import { posterUrl } from "@/lib/urls";
import { api, saveFile } from "@/lib/api";
import { ago, playsWord } from "@/lib/format";
import { GameTile } from "./GameTile";

const summaryOf = (p: Project): ProjectSummary => ({
  id: p.id,
  name: p.name,
  orientation: p.orientation,
  platform: p.platform,
  pickedGenre: p.pickedGenre,
  tags: p.tags,
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
  const queued = game.status === "queued"; // its build waits for its turn
  const meta = [
    running ? "building…" : queued ? inLine.tile : game.buildId ? `changed ${ago(game.updatedAt)}` : "not built yet",
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
      <AppTile className="manage__icon" waiting={queued && !game.buildId}>
        <GameTile id={game.id} name={game.name} building={(running || queued) && !game.buildId} poster={game.buildId && game.poster ? posterUrl(game.buildId) : null} />
      </AppTile>

      <div className="manage__text">
        {mode === "rename" ? (
          <form className="manage__rename" onSubmit={rename} noValidate>
            <TextField
              id={`name-${game.id}`}
              label={<>New name for {game.name}</>}
              labelHidden
              boxClassName="manage__field"
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
            <div className="manage__buttons">
              <Button type="submit" size="small" busy={busy === "rename"} busyLabel="Saving…">
                Save
              </Button>
              <Button
                look="quiet"
                size="small"
                disabled={busy === "rename"}
                onClick={() => {
                  setName(game.name);
                  setError(null);
                  setMode("idle");
                }}
              >
                Cancel
              </Button>
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
            Delete it for good? Every version goes, and its share page{running ? ", and the build that is running now" : queued ? ", and the build waiting for its turn" : ""}. You
            can&apos;t undo this.
          </p>
        )}
        {error && <ErrorLine>{error}</ErrorLine>}
      </div>

      {mode === "delete" ? (
        <div className="manage__buttons manage__actions" role="group" aria-labelledby={`ask-${game.id}`}>
          <Button
            look="ink"
            size="small"
            busy={busy === "delete"}
            busyLabel="Deleting…"
            onClick={() => void run("delete", async () => {
              await api.remove(game.id);
              onRemoved(game.id);
            })}
          >
            Delete game
          </Button>
          <Button look="quiet" size="small" disabled={busy === "delete"} onClick={() => setMode("idle")}>
            Keep it
          </Button>
        </div>
      ) : (
        mode === "idle" && (
          <div className="manage__buttons manage__actions">
            <Button
              look="quiet"
              size="small"
              onClick={() => {
                setName(game.name); // a build may have renamed it since this row was made
                setError(null);
                setMode("rename");
              }}
              aria-label={`Rename ${game.name}`}
            >
              <PencilSimple size={16} weight="bold" aria-hidden="true" />
              Rename
            </Button>
            <Button
              look="quiet"
              size="small"
              disabled={!game.buildId || running}
              busy={busy === "download"}
              title={!game.buildId ? "There is nothing to download yet." : running ? "When this build is done." : "A .zip to open in Godot 4.7"}
              onClick={() => void run("download", async () => saveFile(await api.download(game.id)))}
              aria-label={`Download ${game.name}`}
            >
              <DownloadSimple size={16} weight="bold" aria-hidden="true" />
              {busy === "download" ? "Preparing…" : "Download"}
            </Button>
            <Button
              look="quiet"
              size="small"
              onClick={() => {
                setError(null);
                setMode("delete");
              }}
              aria-label={`Delete ${game.name}`}
            >
              <Trash size={16} weight="bold" aria-hidden="true" />
              Delete
            </Button>
          </div>
        )
      )}
    </li>
  );
}
