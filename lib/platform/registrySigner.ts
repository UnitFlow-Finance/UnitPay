import type { Hex } from "viem";

export const REGISTRY_SIGNER_MISSING_ERROR =
  "On-chain UnitPay storage requires UNITPAY_METADATA_REGISTRY_PRIVATE_KEY configured as a secure deployment secret.";

export const REGISTRY_SIGNER_MALFORMED_ERROR =
  "Registry signer secret is malformed. Configure UNITPAY_METADATA_REGISTRY_PRIVATE_KEY as a 32-byte hex private key.";

function stripWrappingQuotes(value: string): string {
  if (value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];
  return (first === `"` && last === `"`) || (first === "'" && last === "'")
    ? value.slice(1, -1).trim()
    : value;
}

export function normalizeRegistryPrivateKey(raw: string | undefined): Hex {
  if (raw === undefined || raw === null) {
    throw new Error(REGISTRY_SIGNER_MISSING_ERROR);
  }

  const normalized = stripWrappingQuotes(raw.trim());
  if (!normalized) {
    throw new Error(REGISTRY_SIGNER_MISSING_ERROR);
  }
  if (normalized.includes("=") || /\s/.test(normalized)) {
    throw new Error(REGISTRY_SIGNER_MALFORMED_ERROR);
  }

  const hex = normalized.startsWith("0x") ? normalized : `0x${normalized}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(REGISTRY_SIGNER_MALFORMED_ERROR);
  }

  return hex as Hex;
}
