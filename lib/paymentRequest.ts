/**
 * Payment-request encoding.
 *
 * This demo build has no database, so a "payment request" is a self-
 * contained, URL-safe base64 JSON payload embedded directly in the
 * link/QR code, rather than a server-side record looked up by ID. This is
 * an intentional simplification for a testnet demo — see README for the
 * "what's stubbed" notes. On-chain settlement itself still uses the real
 * Circle Wallets transfer flow; only the *request* metadata is encoded
 * client-side rather than persisted.
 *
 * Version 2 adds multi-receiver support: a single link can request one
 * lump payment that gets split atomically across several addresses in one
 * transaction (UnitPayTransfer.batchTransfer), e.g. splitting a bill or
 * paying several freelancers from one payer action. Version 1 (single
 * receiver = requesterAddress) still decodes and pays exactly as before.
 */

export interface PaymentReceiver {
  address: string;
  /** Human-readable USDC amount for this receiver, e.g. "4.25". */
  amount: string;
  /** Optional label shown to the payer, e.g. "Alice's share". */
  label?: string;
}

export interface PaymentRequestPayload {
  version: 1 | 2;
  /** v1: the sole receiver. v2: the request's creator, for display only — funds may not go to this address at all. */
  requesterAddress: string;
  blockchain: string; // Circle Blockchain enum value, e.g. "ARC-TESTNET"
  /** Total human-readable USDC amount. v1: paid to requesterAddress. v2: sum of `receivers[].amount`. */
  amount: string;
  /** Present only on version-2 (multi-receiver) requests. */
  receivers?: PaymentReceiver[];
  memo?: string;
  createdAt: string; // ISO timestamp
}

export type NewPaymentRequestPayload =
  | Omit<PaymentRequestPayload, "version" | "receivers">
  | (Omit<PaymentRequestPayload, "version" | "amount"> & { receivers: PaymentReceiver[] });

function sumReceiverAmounts(receivers: PaymentReceiver[]): number {
  return receivers.reduce((total, r) => total + Number(r.amount), 0);
}

export function encodePaymentRequest(payload: NewPaymentRequestPayload): string {
  const full: PaymentRequestPayload =
    "receivers" in payload
      ? {
          version: 2,
          ...payload,
          amount: formatTotal(sumReceiverAmounts(payload.receivers)),
        }
      : { version: 1, ...payload };

  const json = JSON.stringify(full);
  const base64 =
    typeof window === "undefined"
      ? Buffer.from(json, "utf-8").toString("base64")
      : window.btoa(unescape(encodeURIComponent(json)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function formatTotal(n: number): string {
  // Avoid floating-point artifacts like "4.1999999999999" from repeated
  // addition; USDC only ever needs up to 6 decimal places of precision.
  return (Math.round(n * 1e6) / 1e6).toString();
}

function isValidReceiver(r: unknown): r is PaymentReceiver {
  if (typeof r !== "object" || r === null) return false;
  const { address, amount } = r as Record<string, unknown>;
  return typeof address === "string" && address.length > 0 && typeof amount === "string" && Number(amount) > 0;
}

export function decodePaymentRequest(encoded: string): PaymentRequestPayload {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const json =
    typeof window === "undefined"
      ? Buffer.from(padded, "base64").toString("utf-8")
      : decodeURIComponent(escape(window.atob(padded)));

  const parsed = JSON.parse(json) as PaymentRequestPayload;

  if (parsed.version === 2) {
    if (
      !parsed.requesterAddress ||
      !parsed.amount ||
      !Array.isArray(parsed.receivers) ||
      parsed.receivers.length === 0 ||
      !parsed.receivers.every(isValidReceiver)
    ) {
      throw new Error("Invalid or unsupported payment request link.");
    }
    return parsed;
  }

  if (parsed.version !== 1 || !parsed.requesterAddress || !parsed.amount) {
    throw new Error("Invalid or unsupported payment request link.");
  }
  return parsed;
}

/** Normalizes any version of the payload into an explicit receiver list. */
export function receiversForRequest(payload: PaymentRequestPayload): PaymentReceiver[] {
  if (payload.version === 2 && payload.receivers) return payload.receivers;
  return [{ address: payload.requesterAddress, amount: payload.amount }];
}

export function isMultiReceiverRequest(payload: PaymentRequestPayload): boolean {
  return payload.version === 2 && !!payload.receivers && payload.receivers.length > 1;
}

/**
 * Local history of generated request links, so a requester can come back
 * to /wallet/request later and re-copy a link they already shared —
 * there's still no server-side record (see module docstring above), so
 * this is purely a per-browser convenience cache, capped to avoid
 * unbounded localStorage growth.
 */
const RECENT_REQUESTS_STORAGE_KEY = "unitpay.recentPaymentRequests";
const MAX_RECENT_REQUESTS = 20;

export interface RecentPaymentRequest {
  link: string;
  amount: string;
  memo?: string;
  receiverCount: number;
  createdAt: string;
}

export function saveRecentPaymentRequest(entry: RecentPaymentRequest): void {
  if (typeof window === "undefined") return;
  const existing = listRecentPaymentRequests();
  const next = [entry, ...existing.filter((r) => r.link !== entry.link)].slice(
    0,
    MAX_RECENT_REQUESTS,
  );
  window.localStorage.setItem(RECENT_REQUESTS_STORAGE_KEY, JSON.stringify(next));
}

export function listRecentPaymentRequests(): RecentPaymentRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_REQUESTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RecentPaymentRequest[]) : [];
  } catch {
    return [];
  }
}
