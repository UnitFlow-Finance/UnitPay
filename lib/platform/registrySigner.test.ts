import { describe, expect, it } from "vitest";
import {
  normalizeRegistryPrivateKey,
  REGISTRY_SIGNER_MALFORMED_ERROR,
  REGISTRY_SIGNER_MISSING_ERROR,
} from "./registrySigner";

const HEX_64 = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

describe("normalizeRegistryPrivateKey", () => {
  it("accepts a 0x-prefixed 32-byte hex private key", () => {
    expect(normalizeRegistryPrivateKey(`0x${HEX_64}`)).toBe(`0x${HEX_64}`);
  });

  it("accepts a 32-byte hex private key without 0x", () => {
    expect(normalizeRegistryPrivateKey(HEX_64)).toBe(`0x${HEX_64}`);
  });

  it("trims outer whitespace", () => {
    expect(normalizeRegistryPrivateKey(`  0x${HEX_64}\n`)).toBe(`0x${HEX_64}`);
  });

  it("strips one matching pair of wrapping quotes", () => {
    expect(normalizeRegistryPrivateKey(`"0x${HEX_64}"`)).toBe(`0x${HEX_64}`);
    expect(normalizeRegistryPrivateKey(`'${HEX_64}'`)).toBe(`0x${HEX_64}`);
  });

  it("rejects missing or empty values", () => {
    expect(() => normalizeRegistryPrivateKey(undefined)).toThrow(REGISTRY_SIGNER_MISSING_ERROR);
    expect(() => normalizeRegistryPrivateKey(" ")).toThrow(REGISTRY_SIGNER_MISSING_ERROR);
  });

  it("rejects env assignment lines", () => {
    expect(() =>
      normalizeRegistryPrivateKey(`UNITPAY_METADATA_REGISTRY_PRIVATE_KEY=0x${HEX_64}`),
    ).toThrow(REGISTRY_SIGNER_MALFORMED_ERROR);
  });

  it("rejects malformed values without leaking the submitted value", () => {
    const invalidValues = [
      `0x${HEX_64.slice(0, 62)}`,
      `0x${HEX_64}00`,
      `0x${HEX_64.slice(0, 63)}z`,
      "test test test test test test test test test test test junk",
      `0x${HEX_64.slice(0, 32)}\n${HEX_64.slice(32)}`,
      `0x${HEX_64.slice(0, 32)} ${HEX_64.slice(32)}`,
    ];

    for (const value of invalidValues) {
      expect(() => normalizeRegistryPrivateKey(value)).toThrow(REGISTRY_SIGNER_MALFORMED_ERROR);
      try {
        normalizeRegistryPrivateKey(value);
      } catch (error) {
        expect((error as Error).message).not.toContain(value);
      }
    }
  });
});
