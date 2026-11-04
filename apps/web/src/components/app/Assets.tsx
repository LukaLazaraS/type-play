"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChatCircleText, Cube, MusicNotes, TextAa, Waveform } from "@phosphor-icons/react";
import type { AssetKind, GameAsset } from "@typeplay/shared";
import { AssetTile } from "@/components/ui/AssetTile";
import type { DialogHandle } from "@/components/ui/Dialog";
import { ErrorLine } from "@/components/ui/ErrorLine";
import { InkPill } from "@/components/ui/InkPill";
import { PillChoice } from "@/components/ui/PillBar";
import { Pulse } from "@/components/ui/Pulse";
import { SearchField } from "@/components/ui/SearchField";
import { TextButton } from "@/components/ui/TextButton";
import { assets as t } from "@/content/app";
import { assetUrl, playSound, stopSound, useAssetFont, useAssetList, useAssetUrl, useSeen, useSoundPlaying } from "@/lib/assets";
import { AssetViewer } from "./AssetViewer";

type Filter = "all" | AssetKind;
const KINDS: AssetKind[] = ["picture", "model", "sound", "font"];
/** A search box once the list is longer than this. */
const SEARCH_FROM = 12;

/** A tile's one measured line: "4 frames", "40 × 40", "3D model", "Sound · 0.13 s", "Font · TTF". */
export function metaOf(a: GameAsset): string {
  if (a.kind === "picture") return a.frames ? t.frames(a.frames) : a.width && a.height ? `${a.width} × ${a.height}` : a.format.toUpperCase();
  if (a.kind === "model") return t.model;
  if (a.kind === "sound") return a.seconds === undefined ? t.sound : `${a.seconds >= 15 ? t.music : t.sound} · ${t.seconds(a.seconds)}`;
  return `${t.font} · ${a.format.toUpperCase()}`;
}

type Props = {
  projectId: string;
  /** The version's build (the game's current version); null before the first build. */
  buildId: string | null;
  /** Its number, said above the list on a phone (a computer's bar says it). */
  version: number | null;
  /** The tab is showing: the list loads the first time it shows, and tiles fetch their pictures only while it shows. */
  active: boolean;
  /** Change it: puts the asset into the chat box (GameClient). */
  onChange: (asset: GameAsset, buildId: string) => Promise<void>;
  /** The way to the chat box from a list with nothing in it (a phone opens the Chat tab). */
  onAsk?: () => void;
};

/**
 * The Assets tab (2026-11-04, docs/design/assets.md): every picture, 3D model, sound and font the game's current version
 * uses, on the ink stage. Chips by kind with their counts, a search box for a long list, a grid of tiles (the arrow keys
 * move between them; one tab stop), and the viewer for one asset with Change it and Download.
 */
export function Assets({ projectId, buildId, version, active, onChange, onAsk }: Props) {
  // Nothing is asked until the tab is first opened; from then on the list follows the game's current version.
  const [opened, setOpened] = useState(active);
  if (active && !opened) setOpened(true);
  const { state, retry } = useAssetList(projectId, opened ? buildId : null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [at, setAt] = useState(0); // the tile in the Tab order
  const [open, setOpen] = useState(0); // the viewer's asset, in `shown`
  const viewer = useRef<DialogHandle>(null);
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);
  const list = useMemo(() => (state?.status === "ready" ? state.list.assets : []), [state]);
  const kinds = KINDS.filter((k) => list.some((a) => a.kind === k));
  const kind: Filter = filter !== "all" && !kinds.includes(filter) ? "all" : filter;
  const q = query.trim().toLocaleLowerCase();
  const shown = useMemo(
    () =>
      list.filter(
        (a) =>
          (kind === "all" || a.kind === kind) &&
          (!q || a.name.toLocaleLowerCase().includes(q) || (a.key ?? "").toLocaleLowerCase().includes(q) || (a.file ?? "").toLocaleLowerCase().includes(q)),
      ),
    [list, kind, q],
  );
  const focusAt = Math.min(at, Math.max(0, shown.length - 1));

  // A sound stops when the tab goes (and with the page).
  useEffect(() => {
    if (!active) stopSound();
  }, [active]);
  useEffect(() => () => stopSound(), []);

  /** The grid's keys: arrows move by one or by a row, Home and End to the ends (the grid is one tab stop). */
  const move = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const grid = e.currentTarget.closest("ul");
    const columns = grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length : 1;
    const to = ({ ArrowRight: i + 1, ArrowLeft: i - 1, ArrowDown: i + columns, ArrowUp: i - columns, Home: 0, End: shown.length - 1 } as Record<string, number>)[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const n = Math.max(0, Math.min(shown.length - 1, to));
    setAt(n);
    tiles.current[n]?.focus();
  };

  if (!buildId) {
    return (
      <section id="ws-assets" className="assets" aria-label={t.list} hidden={!active}>
        <p className="assets__lead">{t.noGame}</p>
      </section>
    );
  }
  return (
    <section id="ws-assets" className="assets" aria-label={t.list} hidden={!active}>
      {state?.status === "loading" && (
        <p className="assets__lead" role="status">
          <Pulse />
          {t.loading}
        </p>
      )}
      {state?.status === "failed" && (
        <div className="assets__lead">
          <ErrorLine tone="sky">{state.busy ? state.message : `${t.failed} ${state.message}`}</ErrorLine>
          <TextButton look="sky" onClick={retry}>
            {t.retry}
          </TextButton>
        </div>
      )}
      {state?.status === "ready" && (
        <>
          {version !== null && <p className="figures assets__version">{t.version(version)}</p>}
          <p id="assets-keys" className="sr-only">
            {t.keys}
          </p>
          {list.length > 0 && (
            <div className="assets__bar">
              {kinds.length > 1 && (
                <PillChoice
                  apart
                  tone="recess"
                  label={t.filter}
                  value={kind}
                  onChange={(k) => {
                    setFilter(k);
                    setAt(0);
                  }}
                  options={[
                    { value: "all" as Filter, label: <Count word={t.kinds.all} n={list.length} /> },
                    ...kinds.map((k) => ({ value: k as Filter, label: <Count word={t.kinds[k]} n={list.filter((a) => a.kind === k).length} /> })),
                  ]}
                  className="assets__kinds"
                />
              )}
              {list.length > SEARCH_FROM && (
                <SearchField
                  id="assets-search"
                  tone="recess"
                  label={t.search}
                  placeholder={t.searchHint}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setAt(0);
                  }}
                  onClear={() => setQuery("")}
                  className="assets__search"
                />
              )}
            </div>
          )}
          {state.list.source === "files" && <p className="assets__note">{t.files}</p>}
          {state.list.source === "none" && <p className="assets__lead">{t.none}</p>}
          {state.list.source === "build" && list.length === 0 && (
            <div className="assets__lead">
              <p>{t.empty}</p>
              {onAsk && (
                <InkPill size="small" icon={<ChatCircleText size={16} weight="bold" aria-hidden="true" />} onClick={onAsk}>
                  {t.ask}
                </InkPill>
              )}
            </div>
          )}
          {list.length > 0 && shown.length === 0 && (
            <p className="assets__lead" role="status">
              {t.noMatch(query.trim())}
            </p>
          )}
          {shown.length > 0 && (
            <ul className="assets__grid" aria-label={t.count(shown.length)}>
              {shown.map((a, i) => (
                <Tile
                  key={a.id}
                  projectId={projectId}
                  buildId={buildId}
                  asset={a}
                  active={active}
                  tabIndex={i === focusAt ? 0 : -1}
                  tileRef={(el) => {
                    tiles.current[i] = el;
                  }}
                  onKeyDown={(e) => move(e, i)}
                  onOpen={(tile) => {
                    setAt(i);
                    setOpen(i);
                    viewer.current?.open(tile);
                  }}
                  onPlayFailed={() => {
                    // A sound that won't play from its tile opens in the viewer, which says so and can try again.
                    setAt(i);
                    setOpen(i);
                    viewer.current?.open(tiles.current[i]);
                  }}
                />
              ))}
            </ul>
          )}
          <AssetViewer
            ref={viewer}
            projectId={projectId}
            buildId={buildId}
            assets={shown}
            index={Math.min(open, Math.max(0, shown.length - 1))}
            onMove={(n) => {
              setOpen(n);
              setAt(n);
            }}
            onChange={(a) => onChange(a, buildId)}
          />
        </>
      )}
    </section>
  );
}

/** A chip's words and its count ("Pictures 34"), the count in figures. */
function Count({ word, n }: { word: string; n: number }) {
  return (
    <>
      {word}
      <span className="figures assets__count">{n}</span>
    </>
  );
}

function Tile({
  projectId,
  buildId,
  asset,
  active,
  tabIndex,
  tileRef,
  onKeyDown,
  onOpen,
  onPlayFailed,
}: {
  projectId: string;
  buildId: string;
  asset: GameAsset;
  active: boolean;
  tabIndex: number;
  tileRef: (el: HTMLButtonElement | null) => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
  onOpen: (tile: HTMLButtonElement) => void;
  onPlayFailed: () => void;
}) {
  // Its picture comes once the tile nears the screen, and only while the tab shows.
  const [item, seen] = useSeen<HTMLLIElement>();
  const thumb = useAssetUrl(projectId, buildId, asset.picture ? asset.id : null, "thumb", active && seen);
  const family = useAssetFont(projectId, buildId, asset.kind === "font" ? asset : null, active && seen);
  const key = `tile:${buildId}/${asset.id}`;
  const playing = useSoundPlaying(key);
  const mark =
    asset.kind === "sound" ? (
      (asset.seconds ?? 0) >= 15 ? <MusicNotes size={34} weight="regular" /> : <Waveform size={34} weight="regular" />
    ) : asset.kind === "font" ? (
      family ? (
        <span className="assettile__font" style={{ fontFamily: `"${family}", var(--font-ui)` }}>
          Aa
        </span>
      ) : (
        <TextAa size={34} weight="regular" />
      )
    ) : (
      <Cube size={34} weight="regular" />
    );
  return (
    <AssetTile
      itemRef={item}
      ref={tileRef}
      name={asset.name}
      meta={metaOf(asset)}
      label={t.tileLabel(asset)}
      picture={thumb}
      light={asset.light}
      width={asset.width}
      height={asset.height}
      mark={mark}
      wave={asset.peaks}
      describedBy={tabIndex === 0 ? "assets-keys" : undefined}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      onOpen={onOpen}
      sound={
        asset.kind === "sound"
          ? {
              playing,
              playLabel: t.playSound(asset.name),
              stopLabel: t.stopSound(asset.name),
              onToggle: () => {
                if (playing) return stopSound();
                assetUrl(projectId, buildId, asset.id, "file").then((url) => playSound(key, url, onPlayFailed), onPlayFailed);
              },
            }
          : undefined
      }
    />
  );
}
