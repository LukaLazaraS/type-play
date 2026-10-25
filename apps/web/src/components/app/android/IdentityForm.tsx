"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AndroidLogo } from "@phosphor-icons/react";
import type { AndroidApp, Project } from "@typeplay/shared";
import { Ask } from "@/components/ui/Ask";
import { Button } from "@/components/ui/Button";
import { ErrorLine } from "@/components/ui/ErrorLine";
import { TextField } from "@/components/ui/Field";
import { FileButton } from "@/components/ui/FileButton";
import { TextButton } from "@/components/ui/TextButton";
import { android, APP_NAME_MAX, defaultPackageName, packageNameProblem } from "@/content/android";
import { posterUrl } from "@/lib/urls";

/**
 * What the form hands back: the names, and the icon when it changed (a PNG as base64 with a preview
 * address for this session; null = back to the game's picture).
 */
export type Identity = { appName: string; packageName: string; iconPng?: string | null; iconPreview?: string; confirmPackageChange?: boolean };
type Icon = { kind: "keep" } | { kind: "poster" } | { kind: "own"; base64: string; preview: string };

const MAX_BYTES = 1_048_576;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** The game's name as the app's: cut to 30 at a word, not mid-word ("Make an endless runner where a"). */
function startName(name: string): string {
  const chars = [...name.replace(/\s+/g, " ").trim()];
  if (chars.length <= APP_NAME_MAX) return chars.join("");
  const cut = chars.slice(0, APP_NAME_MAX).join("");
  const word = cut.lastIndexOf(" ");
  return (word > APP_NAME_MAX / 2 ? cut.slice(0, word) : cut).trim();
}

/** Reads the file once: a square PNG of 512 or more under 1 MB, given back as base64 with a preview address. */
async function readIcon(file: File): Promise<{ base64: string; preview: string } | string> {
  const t = android.identity.icon;
  if (file.size > MAX_BYTES) return t.tooBig;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length < 24 || PNG_MAGIC.some((b, i) => bytes[i] !== b)) return t.notPng;
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const w = view.getUint32(16);
  const h = view.getUint32(20);
  if (w !== h || w < 512) return t.notSquare;
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { base64: btoa(binary), preview: URL.createObjectURL(file) };
}

/**
 * The app's name, package name and icon: at setup (nothing saved yet) and from the identity card
 * later. The package name is the suggested one until "Use my own"; after the first Play package it
 * is fixed, and a change asks first (it makes a new app on Google Play).
 */
export function IdentityForm({
  project,
  app,
  iconPreview,
  busy,
  error,
  submitLabel,
  busyLabel,
  onSubmit,
  onCancel,
}: {
  project: Project;
  /** The saved identity (edit), or null at setup. */
  app: AndroidApp | null;
  /** The uploaded icon, to show it back: this visit's upload, or the PNG the API sent back on a later visit (`useAppIcon`). */
  iconPreview?: string | null;
  busy: boolean;
  /** The API's answer when the save failed. */
  error: string | null;
  submitLabel: string;
  busyLabel: string;
  onSubmit: (values: Identity) => void;
  onCancel?: () => void;
}) {
  const t = android.identity;
  const suggested = defaultPackageName(project.name, project.id);
  const [appName, setAppName] = useState(app?.appName ?? startName(project.name));
  const [own, setOwn] = useState(!!app && app.packageName !== suggested);
  const [packageName, setPackageName] = useState(app?.packageName ?? suggested);
  const [packageProblem, setPackageProblem] = useState<string | null>(null);
  const [icon, setIcon] = useState<Icon>(app ? { kind: "keep" } : { kind: "poster" });
  const [iconProblem, setIconProblem] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const handedOver = useRef(false); // the preview went to the card: it stays alive after this form
  const preview = icon.kind === "own" ? icon.preview : null;
  useEffect(
    () => () => {
      if (preview && !handedOver.current) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const chosenPackage = own ? packageName.trim() : suggested;
  const locked = !!app?.packageLocked && chosenPackage !== app.packageName;
  // What the icon tile shows: the upload, the game's start screen, or the neutral icon.
  const shows: "own" | "poster" | "placeholder" = icon.kind === "own" || (icon.kind === "keep" && app?.hasIcon) ? "own" : project.poster ? "poster" : "placeholder";
  const shownPreview = icon.kind === "own" ? icon.preview : icon.kind === "keep" ? (iconPreview ?? null) : null;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setIconProblem(null);
    const read = await readIcon(file);
    if (typeof read === "string") setIconProblem(read);
    else setIcon({ kind: "own", ...read });
  };

  const submit = (e?: FormEvent, confirm = false) => {
    e?.preventDefault();
    const problem = own ? packageNameProblem(chosenPackage) : null;
    setPackageProblem(problem);
    if (problem) return;
    if (locked && !confirm) {
      setAsking(true);
      return;
    }
    setAsking(false);
    const values: Identity = { appName: appName.replace(/\s+/g, " ").trim(), packageName: chosenPackage };
    if (icon.kind === "own") {
      values.iconPng = icon.base64;
      values.iconPreview = icon.preview;
      handedOver.current = true;
    } else if (icon.kind === "poster" && app?.hasIcon) {
      values.iconPng = null;
    }
    if (confirm) values.confirmPackageChange = true;
    onSubmit(values);
  };

  return (
    <form className="ident" onSubmit={(e) => submit(e)} noValidate>
      <div className="ident__field">
        <TextField
          id="droid-name"
          label={t.appName.label}
          hint={t.appName.hint}
          value={appName}
          maxLength={APP_NAME_MAX}
          autoComplete="off"
          spellCheck={false}
          autoFocus={!!app}
          disabled={busy}
          onChange={(e) => setAppName(e.target.value)}
        />
      </div>

      <div className="ident__field">
        <TextField
          id="droid-package"
          label={t.packageName.label}
          dim={!own}
          className="ident__package"
          value={own ? packageName : suggested}
          readOnly={!own}
          maxLength={80}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          disabled={busy}
          onChange={(e) => {
            setPackageName(e.target.value);
            if (packageProblem) setPackageProblem(null);
          }}
          onBlur={() => own && setPackageProblem(packageNameProblem(packageName.trim()))}
          error={packageProblem}
          hint={
            <>
              {app?.packageLocked ? t.packageName.locked : own ? t.packageName.ownHint : t.packageName.hint} {!app?.packageLocked && t.packageName.lock}
            </>
          }
        />
        <TextButton
          look="standalone"
          disabled={busy}
          onClick={() => {
            setPackageProblem(null);
            if (own) setPackageName(suggested);
            setOwn(!own);
          }}
        >
          {own ? t.packageName.suggested : t.packageName.own}
        </TextButton>
      </div>

      <div className="ident__field">
        <span className="field-label" id="droid-icon-label">
          {t.icon.label}
        </span>
        <div className="ident__icon" role="group" aria-labelledby="droid-icon-label">
          <span className="ident__tile" aria-hidden="true">
            {shows === "own" && shownPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shownPreview} alt="" />
            ) : shows === "poster" && project.buildId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={posterUrl(project.buildId)} alt="" />
            ) : (
              <AndroidLogo size={28} weight="fill" className={shows === "own" ? "ident__late" : undefined} />
            )}
          </span>
          <div className="ident__icon-text">
            <p className="field-hint">
              {shows === "own" ? t.icon.own : shows === "poster" ? t.icon.poster : t.icon.placeholder} {t.icon.rules}
            </p>
            <div className="ident__icon-actions">
              <FileButton accept="image/png,.png" disabled={busy} onFile={(file) => void pick(file)}>
                {shows === "own" ? t.icon.replace : t.icon.upload}
              </FileButton>
              {shows === "own" && (
                <TextButton look="standalone" disabled={busy} onClick={() => setIcon({ kind: "poster" })}>
                  {t.icon.usePoster}
                </TextButton>
              )}
            </div>
            {iconProblem && <ErrorLine>{iconProblem}</ErrorLine>}
          </div>
        </div>
      </div>

      {asking && (
        <Ask
          className="ident__ask"
          text={t.packageName.ask}
          actions={
            <>
              <Button look="ink" size="small" disabled={busy} autoFocus onClick={() => submit(undefined, true)}>
                {t.packageName.confirm}
              </Button>
              <Button look="quiet" size="small" disabled={busy} onClick={() => setAsking(false)}>
                {t.cancel}
              </Button>
            </>
          }
        />
      )}
      {error && <ErrorLine>{error}</ErrorLine>}
      <div className="acct__buttons">
        <Button type="submit" busy={busy} busyLabel={busyLabel}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button look="quiet" disabled={busy} onClick={onCancel}>
            {t.cancel}
          </Button>
        )}
      </div>
    </form>
  );
}
