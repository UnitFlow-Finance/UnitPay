import type { PublicObjectType } from "@/lib/platform/objects";

export type UnitPayQrKind =
  | "circle-wallet-id"
  | "wallet-address"
  | "payment-link"
  | "pod"
  | "packet"
  | "escrow"
  | "merchant"
  | "p2p-offer"
  | "deep-link"
  | "chain-payment"
  | "unknown";

export interface UnitPayQrPayload {
  kind: UnitPayQrKind;
  value: string;
  route?: string;
  objectType?: PublicObjectType;
  objectId?: string;
}

const ETH_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export function encodeUnitPayQr(payload: UnitPayQrPayload): string {
  return JSON.stringify({ unitpay: 1, ...payload });
}

export function parseUnitPayQr(raw: string): UnitPayQrPayload {
  const value = raw.trim();
  if (!value) return { kind: "unknown", value };

  try {
    const parsed = JSON.parse(value) as Partial<UnitPayQrPayload> & { unitpay?: number };
    if (parsed.unitpay === 1 && parsed.kind && parsed.value) {
      return {
        kind: parsed.kind,
        value: parsed.value,
        route: parsed.route,
        objectType: parsed.objectType,
        objectId: parsed.objectId,
      };
    }
  } catch {
    // Continue with string heuristics.
  }

  if (value.startsWith("unitpay://")) {
    const url = new URL(value);
    const objectType = url.hostname as PublicObjectType;
    const objectId = url.pathname.replace(/^\//, "");
    return {
      kind: "deep-link",
      value,
      route: `/${objectType === "payment" ? "pay" : objectType}/${objectId}`,
      objectType,
      objectId,
    };
  }

  if (value.includes("/pay/")) {
    return { kind: "payment-link", value, route: new URL(value).pathname };
  }
  if (value.includes("/pods/")) {
    const route = new URL(value).pathname;
    return { kind: "pod", value, route, objectType: "pod", objectId: route.split("/").pop() };
  }
  if (value.includes("/p2p/offers/")) {
    const route = new URL(value).pathname;
    return {
      kind: "p2p-offer",
      value,
      route,
      objectType: "p2p-offer",
      objectId: route.split("/").pop(),
    };
  }
  if (value.startsWith("ethereum:") || value.startsWith("solana:")) {
    return { kind: "chain-payment", value };
  }
  if (ETH_ADDRESS_PATTERN.test(value)) {
    return { kind: "wallet-address", value };
  }
  if (/^[A-Za-z0-9_-]{8,}$/.test(value)) {
    return { kind: "circle-wallet-id", value, route: `/wallet/send?recipient=${value}` };
  }
  return { kind: "unknown", value };
}
