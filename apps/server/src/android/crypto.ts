// A game's upload keystore at rest (docs/android-export-design.md §6): AES-256-GCM under
// ANDROID_KEY_MASTER, the project id as associated data (a blob copied onto another project's row
// does not open), one key id byte in front for a later rotation (ANDROID_KEY_MASTER_PREV).
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
  /** Older keys still accepted for opening (rotation; none today). */
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

/** Throws on a wrong key, a wrong project, a flipped byte or an unknown key id. */
export function open(keys: MasterKeys, projectId: string, blob: Buffer): KeyMaterial {
  if (blob.length < 1 + NONCE + TAG + 1) throw new Error("keystore blob too short");
  const id = blob[0];
  const key = [keys.current, ...keys.previous].find((k) => k.id === id)?.key;
  if (!key) throw new Error(`keystore sealed with key id ${id}, which this server does not have`);
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
