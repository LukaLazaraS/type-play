// A game's upload keystore at rest (docs/android-export-design.md §6): AES-256-GCM under
// ANDROID_KEY_MASTER, the project id as associated data (a blob copied onto another project's row
// does not open), one key id byte in front (a hint: openWith). A rotation keeps the old master as
// ANDROID_KEY_MASTER_PREV until AndroidService.rewrap has sealed every blob again under the new one.
// Blob = keyId(1) | nonce(12) | tag(16) | ciphertext of JSON { p12: base64, password }.
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

export interface KeyMaterial {
  /** The PKCS12 keystore bytes. */
  p12: Buffer;
  /** The store password (= the key password). */
  password: string;
}

export interface MasterKeys {
  /** The current key (64 hex chars) and its id. */
  current: { id: number; key: Buffer };
  /** Older keys still accepted for opening (after a rotation: ANDROID_KEY_MASTER_PREV). */
  previous: { id: number; key: Buffer }[];
}

const NONCE = 12;
const TAG = 16;

/** 64 hex chars → 32 bytes, or null when it is not a usable master key. */
export function parseMasterKey(hex: string | undefined): Buffer | null {
  if (!hex || !/^[0-9a-f]{64}$/i.test(hex)) return null;
  return Buffer.from(hex, "hex");
}

export function seal(keys: MasterKeys, projectId: string, material: KeyMaterial): Buffer {
  const nonce = randomBytes(NONCE);
  const cipher = createCipheriv("aes-256-gcm", keys.current.key, nonce);
  cipher.setAAD(Buffer.from(projectId, "utf8"));
  const plain = Buffer.from(JSON.stringify({ p12: material.p12.toString("base64"), password: material.password }), "utf8");
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([Buffer.from([keys.current.id]), nonce, cipher.getAuthTag(), body]);
}

/** Throws on a wrong key, a wrong project or a flipped byte. */
export function open(keys: MasterKeys, projectId: string, blob: Buffer): KeyMaterial {
  return openWith(keys, projectId, blob).material;
}

/**
 * open(), and whether the current key opened it (AndroidService.rewrap seals the others again). The id byte names
 * the key first tried, then the others: the server numbers its keys by role (current 1, previous 0), so after a
 * rotation a blob sealed under the old key still says 1, now the new key's id. GCM's tag decides which key fits.
 */
export function openWith(keys: MasterKeys, projectId: string, blob: Buffer): { material: KeyMaterial; current: boolean } {
  if (blob.length < 1 + NONCE + TAG + 1) throw new Error("keystore blob too short");
  const all = [keys.current, ...keys.previous];
  const tried = [...all.filter((k) => k.id === blob[0]), ...all.filter((k) => k.id !== blob[0])];
  for (const k of tried) {
    try {
      return { material: openUnder(k.key, projectId, blob), current: k === keys.current };
    } catch {
      // not this key: the next one
    }
  }
  throw new Error(`no master key on this server opens the keystore (sealed with key id ${blob[0]}, ${all.length} key(s) tried)`);
}

function openUnder(key: Buffer, projectId: string, blob: Buffer): KeyMaterial {
  const nonce = blob.subarray(1, 1 + NONCE);
  const tag = blob.subarray(1 + NONCE, 1 + NONCE + TAG);
  const body = blob.subarray(1 + NONCE + TAG);
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAAD(Buffer.from(projectId, "utf8"));
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(body), decipher.final()]); // throws on any tampering
  const json = JSON.parse(plain.toString("utf8")) as { p12?: string; password?: string };
  if (typeof json.p12 !== "string" || typeof json.password !== "string") throw new Error("keystore blob has the wrong shape");
  return { p12: Buffer.from(json.p12, "base64"), password: json.password };
}

/** The keystore password: 32 letters and digits (Godot's docs: letters and digits only). */
export function newPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(64);
  let out = "";
  for (let i = 0; i < bytes.length && out.length < 32; i++) if (bytes[i] < 256 - (256 % alphabet.length)) out += alphabet[bytes[i] % alphabet.length];
  return out.length === 32 ? out : newPassword();
}

/** A 10-minute download link's token, compared in constant time. */
export const newToken = () => randomBytes(32).toString("base64url");
export const sameToken = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
