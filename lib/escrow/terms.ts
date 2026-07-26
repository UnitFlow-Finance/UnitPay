/**
 * Client-side encryption for escrow task terms.
 *
 * UnitPayEscrow.sol only ever sees a `bytes32 termsHash` — the actual terms
 * text (scope of work, deliverables, deadline, whatever the payer/payee
 * agree on) never touches Circle's servers or the chain. It is:
 *
 *   1. AES-256-GCM encrypted in the browser with a random key.
 *   2. The ciphertext (+ IV) is embedded in a shareable link's URL
 *      *fragment* (`#...`), which browsers never send to a server — so the
 *      only party who can decrypt the terms is whoever has the link.
 *   3. `termsHash = keccak256(utf8(termsJson))` is computed over the
 *      *plaintext* terms and passed to `createEscrow`. Anyone with the
 *      decrypted terms can independently recompute this hash and verify it
 *      matches what's on-chain — proving the terms haven't been altered
 *      after the escrow was funded, without revealing them to anyone else.
 *
 * The AES key itself is never stored or transmitted anywhere except inside
 * the link fragment. Losing the link means losing the ability to decrypt
 * the terms (the commitment hash on-chain is not reversible).
 */
import { keccak256, toBytes } from "viem";

export interface EscrowTerms {
  title: string;
  description: string;
  deliverables?: string;
  deadline?: string; // ISO date string, optional
}

export interface EncryptedEscrowTerms {
  /** Base64url-encoded AES-GCM ciphertext (includes the GCM auth tag). */
  ciphertext: string;
  /** Base64url-encoded 12-byte GCM IV. */
  iv: string;
}

function toBase64Url(bytes: Uint8Array): string {
  const binary =
    typeof window === "undefined"
      ? Buffer.from(bytes).toString("base64")
      : window.btoa(String.fromCharCode(...bytes));
  return binary.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Copies a Uint8Array's bytes into a fresh, tightly-sized ArrayBuffer.
 * Web Crypto's TS types require `BufferSource` backed by a plain
 * `ArrayBuffer` (not `ArrayBufferLike`, which also covers
 * `SharedArrayBuffer`) — plain `Uint8Array`s from `crypto.getRandomValues`
 * or base64 decoding satisfy that at runtime but not always in the types,
 * so this normalizes to a concrete `ArrayBuffer` view.
 */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  if (typeof window === "undefined") {
    return new Uint8Array(Buffer.from(padded, "base64"));
  }
  const binary = window.atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Computes the on-chain commitment hash for a set of plaintext terms. */
export function hashEscrowTerms(terms: EscrowTerms): `0x${string}` {
  const json = JSON.stringify(terms);
  return keccak256(toBytes(json));
}

/**
 * Encrypts terms with a fresh random AES-256-GCM key.
 * Returns the ciphertext/IV (safe to put in a shareable link fragment
 * alongside the key) and the raw key material separately, so callers can
 * choose how to encode/transmit the key (this module encodes it as part of
 * `buildEscrowShareFragment` below).
 */
export async function encryptEscrowTerms(
  terms: EscrowTerms,
): Promise<{ encrypted: EncryptedEscrowTerms; key: CryptoKey; rawKey: Uint8Array }> {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(terms));

  const ciphertextBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  const rawKey = new Uint8Array(await crypto.subtle.exportKey("raw", key));

  return {
    encrypted: {
      ciphertext: toBase64Url(new Uint8Array(ciphertextBuffer)),
      iv: toBase64Url(iv),
    },
    key,
    rawKey,
  };
}

/** Decrypts terms given the ciphertext/IV and the raw AES key bytes. */
export async function decryptEscrowTerms(
  encrypted: EncryptedEscrowTerms,
  rawKey: Uint8Array,
): Promise<EscrowTerms> {
  const key = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(rawKey),
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  const iv = fromBase64Url(encrypted.iv);
  const ciphertext = fromBase64Url(encrypted.ciphertext);

  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(ciphertext),
  );
  const json = new TextDecoder().decode(plaintextBuffer);
  return JSON.parse(json) as EscrowTerms;
}

/**
 * Builds the URL fragment (everything after `#`) that carries the
 * ciphertext, IV, and decryption key for a shareable escrow link. Using the
 * fragment (not a query param) means the key never leaves the browser —
 * fragments are not sent in HTTP requests or normally logged by servers.
 */
export function buildEscrowShareFragment(encrypted: EncryptedEscrowTerms, rawKey: Uint8Array): string {
  const payload = {
    c: encrypted.ciphertext,
    iv: encrypted.iv,
    k: toBase64Url(rawKey),
  };
  return toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

/**
 * localStorage key an escrow's share fragment is cached under on the
 * browser that created it (or that first opened the original share
 * link), so the full shareable link (including the terms-decryption
 * key) can be reconstructed later from /wallet/escrow/[id] without
 * needing the original link — see app/wallet/escrow/new/page.tsx and
 * app/wallet/escrow/[id]/page.tsx. Never sent to any server; same trust
 * boundary as the Circle session data already kept in localStorage.
 */
export function escrowFragmentStorageKey(escrowId: string): string {
  return `unitpay.escrowFragment.${escrowId}`;
}

/** Parses a URL fragment produced by `buildEscrowShareFragment`. */
export function parseEscrowShareFragment(fragment: string): {
  encrypted: EncryptedEscrowTerms;
  rawKey: Uint8Array;
} {
  const cleaned = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  const json = new TextDecoder().decode(fromBase64Url(cleaned));
  const parsed = JSON.parse(json) as { c: string; iv: string; k: string };
  if (!parsed.c || !parsed.iv || !parsed.k) {
    throw new Error("Invalid or unsupported escrow share link.");
  }
  return {
    encrypted: { ciphertext: parsed.c, iv: parsed.iv },
    rawKey: fromBase64Url(parsed.k),
  };
}

/**
 * Convenience end-to-end helper: encrypts terms, computes the on-chain
 * commitment hash, and produces the shareable link fragment — everything
 * needed to both fund the escrow (hash) and share the terms (fragment).
 */
export async function prepareEscrowTerms(terms: EscrowTerms): Promise<{
  termsHash: `0x${string}`;
  shareFragment: string;
}> {
  const termsHash = hashEscrowTerms(terms);
  const { encrypted, rawKey } = await encryptEscrowTerms(terms);
  const shareFragment = buildEscrowShareFragment(encrypted, rawKey);
  return { termsHash, shareFragment };
}
