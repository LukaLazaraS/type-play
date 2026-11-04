"use client";

import { useEffect, useId, useImperativeHandle, useRef, useState, type CSSProperties, type Ref } from "react";
import { DownloadSimple, Pause, Play } from "@phosphor-icons/react";
import type { GameAsset } from "@typeplay/shared";
import { Button } from "@/components/ui/Button";
import type { DialogHandle } from "@/components/ui/Dialog";
import { ErrorLine } from "@/components/ui/ErrorLine";
import { IconButton } from "@/components/ui/IconButton";
import { InkPill } from "@/components/ui/InkPill";
import { ModelView } from "@/components/ui/ModelView";
import { Viewer } from "@/components/ui/Viewer";
import { Waveform } from "@/components/ui/Waveform";
import { assets as t } from "@/content/app";
import { assetUrl, downloadAsset, playSound, soundProgress, stopSound, useAssetFont, useAssetUrl, useSoundPlaying } from "@/lib/assets";
import { figuresLine, sizeWord } from "@/lib/format";

type Props = {
  ref?: Ref<DialogHandle>;
  projectId: string;
  buildId: string;
  /** The list as it is filtered: Previous and Next move through it. */
  assets: GameAsset[];
  index: number;
  onMove: (index: number) => void;
  /** Change it: the asset into the chat box; the viewer closes once it is there. */
  onChange: (asset: GameAsset) => Promise<void>;
};

const REDUCED = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * One asset at a time, large (2026-11-04, the Assets tab), in the viewer's frame (ui/Viewer.tsx): the asset as large as the
 * screen allows (a picture never more than four times its own size; an animated look plays its frames; a model turns; a
 * sound plays with its progress; a font shows itself), then its name, how it was made, its measures, where it is used and
 * its handle; Change it (the one hot button) and Download.
 */
export function AssetViewer({ ref, projectId, buildId, assets, index, onMove, onChange }: Props) {
  const viewer = useRef<DialogHandle>(null);
  const title = useId();
  useImperativeHandle(ref, () => ({ open: (from) => viewer.current?.open(from), close: () => viewer.current?.close() }), []);
  const asset = assets[index] as GameAsset | undefined;
  const [busy, setBusy] = useState<"change" | "download" | null>(null);
  const [error, setError] = useState<{ id: string; text: string } | null>(null);
  const change = async () => {
    if (!asset || busy) return;
    setBusy("change");
    setError(null);
    try {
      await onChange(asset);
      viewer.current?.close();
    } catch {
      setError({ id: asset.id, text: t.changeFailed });
    } finally {
      setBusy(null);
    }
  };
  const download = async () => {
    if (!asset || busy) return;
    setBusy("download");
    setError(null);
    try {
      await downloadAsset(projectId, buildId, asset);
    } catch (e) {
      setError({ id: asset.id, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };
  const facts = asset
    ? figuresLine([
        asset.width && asset.height ? `${asset.width} × ${asset.height} px` : null,
        asset.frames ? t.frames(asset.frames) : null,
        asset.seconds !== undefined ? t.seconds(asset.seconds) : null,
        asset.made === "code" ? null : asset.format.toUpperCase(),
        asset.made === "code" ? null : sizeWord(asset.bytes),
      ])
    : "";
  return (
    <Viewer
      ref={viewer}
      size="asset"
      labelledBy={title}
      index={index}
      count={assets.length}
      onMove={(n) => {
        setError(null);
        stopSound();
        onMove(n);
      }}
      said={asset ? `${asset.name}, ${t.of(index + 1, assets.length)}` : ""}
      labels={{ previous: t.previous, next: t.next, close: t.close }}
      closeFirst={asset?.kind !== "sound"}
      onClose={() => {
        stopSound();
        setError(null);
      }}
    >
      {asset && (
        <>
          <Preview key={asset.id} projectId={projectId} buildId={buildId} asset={asset} />
          <div className="assetview__info">
            <h2 id={title} className="assetview__name">
              {asset.name}
            </h2>
            <p className="assetview__made">{t.made(asset)}</p>
            <p className="figures assetview__facts">{facts}</p>
            {asset.where.length > 0 && <p className="assetview__where">{t.used(asset.where)}</p>}
            {(asset.file || asset.key) && <p className="figures assetview__file">{asset.file ? t.inFile(asset.file) : t.inCode(asset.key ?? "")}</p>}
            {error?.id === asset.id && <ErrorLine tone="sky">{error.text}</ErrorLine>}
            <div className="assetview__actions">
              <Button busy={busy === "change"} onClick={() => void change()}>
                {t.change}
              </Button>
              <InkPill icon={<DownloadSimple size={18} weight="bold" aria-hidden="true" />} aria-busy={busy === "download" || undefined} onClick={() => void download()}>
                {busy === "download" ? t.downloading : t.download}
              </InkPill>
            </div>
            <p className="assetview__note">{t.changeNote}</p>
          </div>
        </>
      )}
    </Viewer>
  );
}

/** The asset itself, as large as there is room for: a picture, its frames, a turning model, a sound, a font. */
function Preview({ projectId, buildId, asset }: { projectId: string; buildId: string; asset: GameAsset }) {
  const picture = useAssetUrl(projectId, buildId, asset.picture ? asset.id : null, "picture");
  const thumb = useAssetUrl(projectId, buildId, asset.picture ? asset.id : null, "thumb");
  const animated = asset.kind === "picture" && !!asset.frames;
  const needsFile = animated || (asset.kind === "model" && !!asset.turnable);
  const file = useAssetUrl(projectId, buildId, needsFile ? asset.id : null, "file");
  const family = useAssetFont(projectId, buildId, asset.kind === "font" ? asset : null);
  const [frames, setFrames] = useState(!REDUCED);

  if (asset.kind === "model") {
    return (
      <div className="assetview__stage">
        {asset.turnable ? (
          <ModelView src={file} poster={picture ?? thumb} alt={asset.name} />
        ) : (
          <ModelView src={null} poster={picture ?? thumb} alt={asset.name} />
        )}
        <p className="assetview__hint">{asset.turnable ? t.turn : t.noTurn}</p>
      </div>
    );
  }
  if (asset.kind === "sound") return <SoundPreview projectId={projectId} buildId={buildId} asset={asset} />;
  if (asset.kind === "font") {
    return (
      <div className="assetview__stage">
        <div className="assetview__font" style={family ? { fontFamily: `"${family}", var(--font-ui)` } : undefined} aria-busy={!family || undefined}>
          <p className="assetview__font-big">{t.fontSample}</p>
          <p className="assetview__font-small">{t.fontLetters}</p>
        </div>
      </div>
    );
  }
  const w = asset.width ?? 1;
  const h = asset.height ?? 1;
  const frame = { "--ratio": w / h, "--w": w } as CSSProperties;
  if (animated && file) {
    return (
      <div className="assetview__stage">
        <div
          className="assetview__frame assetview__frames"
          data-light={asset.light || undefined}
          style={{ ...frame, "--frames": asset.frames, backgroundImage: `url("${file}")` } as CSSProperties}
          data-playing={frames || undefined}
          role="img"
          aria-label={asset.name}
        />
        <InkPill size="small" aria-pressed={frames} onClick={() => setFrames(!frames)} icon={frames ? <Pause size={14} weight="fill" aria-hidden="true" /> : <Play size={14} weight="fill" aria-hidden="true" />}>
          {frames ? t.stopFrames : t.playFrames}
        </InkPill>
      </div>
    );
  }
  const shown = picture ?? thumb;
  return (
    <div className="assetview__stage">
      <div className="assetview__frame" style={frame} data-light={asset.light || undefined} aria-busy={!picture || undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {shown && <img src={shown} alt={asset.name} draggable={false} />}
      </div>
    </div>
  );
}

/** A sound: one big play button, how far it has got, and how long it is. The keyboard starts here. */
function SoundPreview({ projectId, buildId, asset }: { projectId: string; buildId: string; asset: GameAsset }) {
  const key = `viewer:${buildId}/${asset.id}`;
  const playing = useSoundPlaying(key);
  const bar = useRef<HTMLSpanElement>(null);
  const [failed, setFailed] = useState(false);
  // The progress bar follows the sound frame by frame while it plays (a style change, nothing re-rendered).
  useEffect(() => {
    if (!playing) {
      bar.current?.style.setProperty("--at", "0");
      return;
    }
    let raf = requestAnimationFrame(function step() {
      bar.current?.style.setProperty("--at", String(soundProgress()));
      raf = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  const toggle = async () => {
    if (playing) return stopSound();
    setFailed(false);
    try {
      playSound(key, await assetUrl(projectId, buildId, asset.id, "file"), () => setFailed(true));
    } catch {
      setFailed(true);
    }
  };
  return (
    <div className="assetview__stage">
      <div className="assetview__sound">
        <IconButton look="scrim" className="assetview__playbig" label={playing ? t.stopSound(asset.name) : t.playSound(asset.name)} aria-pressed={playing} autoFocus onClick={() => void toggle()}>
          {playing ? <Pause size={30} weight="fill" aria-hidden="true" /> : <Play size={30} weight="fill" aria-hidden="true" />}
        </IconButton>
        {asset.peaks?.length ? (
          <span ref={bar} className="assetview__wave" aria-hidden="true">
            <Waveform peaks={asset.peaks} />
            <Waveform peaks={asset.peaks} className="assetview__wave-played" />
          </span>
        ) : (
          <span ref={bar} className="assetview__progress" aria-hidden="true" />
        )}
      </div>
      {failed && <ErrorLine tone="sky">{t.soundFailed}</ErrorLine>}
    </div>
  );
}
