import { describe, expect, it } from "vitest";
import {
  buildEscrowShareFragment,
  decryptEscrowTerms,
  encryptEscrowTerms,
  hashEscrowTerms,
  parseEscrowShareFragment,
  prepareEscrowTerms,
  type EscrowTerms,
} from "./terms";

const terms: EscrowTerms = {
  title: "Landing page redesign",
  description: "Redesign the marketing landing page per the attached mockups.",
  deliverables: "Figma file + deployed Next.js page",
  deadline: "2026-08-01",
};

describe("hashEscrowTerms", () => {
  it("is deterministic for identical terms", () => {
    expect(hashEscrowTerms(terms)).toBe(hashEscrowTerms({ ...terms }));
  });

  it("changes if any field changes", () => {
    const hash1 = hashEscrowTerms(terms);
    const hash2 = hashEscrowTerms({ ...terms, description: "Different description" });
    expect(hash1).not.toBe(hash2);
  });

  it("returns a 32-byte hex hash", () => {
    const hash = hashEscrowTerms(terms);
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe("encryptEscrowTerms / decryptEscrowTerms", () => {
  it("round-trips terms through encryption and decryption", async () => {
    const { encrypted, rawKey } = await encryptEscrowTerms(terms);
    const decrypted = await decryptEscrowTerms(encrypted, rawKey);
    expect(decrypted).toEqual(terms);
  });

  it("produces different ciphertext for the same terms each time (random IV/key)", async () => {
    const first = await encryptEscrowTerms(terms);
    const second = await encryptEscrowTerms(terms);
    expect(first.encrypted.ciphertext).not.toBe(second.encrypted.ciphertext);
  });

  it("fails to decrypt with the wrong key", async () => {
    const { encrypted } = await encryptEscrowTerms(terms);
    const { rawKey: wrongKey } = await encryptEscrowTerms(terms);
    await expect(decryptEscrowTerms(encrypted, wrongKey)).rejects.toThrow();
  });
});

describe("buildEscrowShareFragment / parseEscrowShareFragment", () => {
  it("round-trips ciphertext, IV, and key through the fragment encoding", async () => {
    const { encrypted, rawKey } = await encryptEscrowTerms(terms);
    const fragment = buildEscrowShareFragment(encrypted, rawKey);
    const parsed = parseEscrowShareFragment(fragment);

    expect(parsed.encrypted).toEqual(encrypted);
    expect(parsed.rawKey).toEqual(rawKey);
  });

  it("accepts fragments with or without a leading #", async () => {
    const { encrypted, rawKey } = await encryptEscrowTerms(terms);
    const fragment = buildEscrowShareFragment(encrypted, rawKey);

    expect(parseEscrowShareFragment(`#${fragment}`)).toEqual(parseEscrowShareFragment(fragment));
  });

  it("produces a URL-safe string with no +, /, or = characters", async () => {
    const { encrypted, rawKey } = await encryptEscrowTerms(terms);
    const fragment = buildEscrowShareFragment(encrypted, rawKey);
    expect(fragment).not.toMatch(/[+/=]/);
  });

  it("rejects a malformed fragment", () => {
    const garbage = Buffer.from(JSON.stringify({ foo: "bar" }), "utf-8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(() => parseEscrowShareFragment(garbage)).toThrow(/Invalid or unsupported/);
  });
});

describe("prepareEscrowTerms (end-to-end)", () => {
  it("produces a termsHash matching the plaintext, and a fragment that decrypts back to it", async () => {
    const { termsHash, shareFragment } = await prepareEscrowTerms(terms);

    expect(termsHash).toBe(hashEscrowTerms(terms));

    const { encrypted, rawKey } = parseEscrowShareFragment(shareFragment);
    const decrypted = await decryptEscrowTerms(encrypted, rawKey);
    expect(decrypted).toEqual(terms);
    expect(hashEscrowTerms(decrypted)).toBe(termsHash);
  });
});
