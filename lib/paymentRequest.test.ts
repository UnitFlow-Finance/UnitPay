// @vitest-environment jsdom
// (only the "recent payment request history" describe block below needs
// `window.localStorage` — everything else in this file is plain node.)
import { beforeEach, describe, expect, it } from "vitest";
import {
  decodePaymentRequest,
  encodePaymentRequest,
  isMultiReceiverRequest,
  listRecentPaymentRequests,
  receiversForRequest,
  saveRecentPaymentRequest,
  type RecentPaymentRequest,
} from "./paymentRequest";

describe("payment request encode/decode round-trip", () => {
  const payload = {
    requesterAddress: "0x1111111111111111111111111111111111111111",
    blockchain: "ARC-TESTNET",
    amount: "12.5",
    memo: "Coffee ☕",
    createdAt: "2026-07-06T00:00:00.000Z",
  };

  it("round-trips a full payload including unicode memo", () => {
    const encoded = encodePaymentRequest(payload);
    const decoded = decodePaymentRequest(encoded);
    expect(decoded).toEqual({ version: 1, ...payload });
  });

  it("produces a URL-safe string with no +, /, or = characters", () => {
    const encoded = encodePaymentRequest(payload);
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it("rejects garbage input", () => {
    expect(() => decodePaymentRequest("not-valid-base64!!!")).toThrow();
  });

  it("rejects a payload missing required fields", () => {
    const badJson = Buffer.from(JSON.stringify({ version: 1 }), "utf-8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(() => decodePaymentRequest(badJson)).toThrow(/Invalid or unsupported/);
  });
});
describe("multi-receiver (version 2) payment requests", () => {
  const receivers = [
    { address: "0x1111111111111111111111111111111111111111", amount: "3", label: "Alice" },
    { address: "0x2222222222222222222222222222222222222222", amount: "2.5", label: "Bob" },
  ];

  const basePayload = {
    requesterAddress: "0x3333333333333333333333333333333333333333",
    blockchain: "ARC-TESTNET",
    memo: "Dinner split",
    createdAt: "2026-07-09T00:00:00.000Z",
    receivers,
  };

  it("round-trips a multi-receiver payload and sums the total amount", () => {
    const encoded = encodePaymentRequest(basePayload);
    const decoded = decodePaymentRequest(encoded);
    expect(decoded.version).toBe(2);
    expect(decoded.receivers).toEqual(receivers);
    expect(decoded.amount).toBe("5.5");
  });

  it("avoids floating-point drift when summing many receivers", () => {
    const manyReceivers = Array.from({ length: 5 }, (_, i) => ({
      address: `0x${(i + 1).toString().padStart(40, "0")}`,
      amount: "0.1",
    }));
    const encoded = encodePaymentRequest({ ...basePayload, receivers: manyReceivers });
    const decoded = decodePaymentRequest(encoded);
    expect(decoded.amount).toBe("0.5");
  });

  it("identifies a version-2 payload with multiple receivers as multi-receiver", () => {
    const decoded = decodePaymentRequest(encodePaymentRequest(basePayload));
    expect(isMultiReceiverRequest(decoded)).toBe(true);
    expect(receiversForRequest(decoded)).toEqual(receivers);
  });

  it("treats a version-1 payload as a single implicit receiver", () => {
    const decoded = decodePaymentRequest(
      encodePaymentRequest({
        requesterAddress: "0x4444444444444444444444444444444444444444",
        blockchain: "ARC-TESTNET",
        amount: "10",
        createdAt: "2026-07-09T00:00:00.000Z",
      }),
    );
    expect(isMultiReceiverRequest(decoded)).toBe(false);
    expect(receiversForRequest(decoded)).toEqual([
      { address: "0x4444444444444444444444444444444444444444", amount: "10" },
    ]);
  });

  it("rejects a version-2 payload with an empty receivers array", () => {
    const badJson = Buffer.from(
      JSON.stringify({
        version: 2,
        requesterAddress: basePayload.requesterAddress,
        amount: "5",
        receivers: [],
      }),
      "utf-8",
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(() => decodePaymentRequest(badJson)).toThrow(/Invalid or unsupported/);
  });

  it("rejects a version-2 payload with a malformed receiver", () => {
    const badJson = Buffer.from(
      JSON.stringify({
        version: 2,
        requesterAddress: basePayload.requesterAddress,
        amount: "5",
        receivers: [{ address: "0x1", amount: "not-a-number" }],
      }),
      "utf-8",
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(() => decodePaymentRequest(badJson)).toThrow(/Invalid or unsupported/);
  });
});

describe("recent payment request history (localStorage cache)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  function entry(link: string): RecentPaymentRequest {
    return { link, amount: "5", receiverCount: 1, createdAt: "2026-07-09T00:00:00.000Z" };
  }

  it("returns an empty list when nothing has been saved", () => {
    expect(listRecentPaymentRequests()).toEqual([]);
  });

  it("saves and lists a request, newest first", () => {
    saveRecentPaymentRequest(entry("https://example.test/pay/aaa"));
    saveRecentPaymentRequest(entry("https://example.test/pay/bbb"));
    const list = listRecentPaymentRequests();
    expect(list.map((r) => r.link)).toEqual([
      "https://example.test/pay/bbb",
      "https://example.test/pay/aaa",
    ]);
  });

  it("de-duplicates by link, moving the existing entry to the front", () => {
    saveRecentPaymentRequest(entry("https://example.test/pay/aaa"));
    saveRecentPaymentRequest(entry("https://example.test/pay/bbb"));
    saveRecentPaymentRequest(entry("https://example.test/pay/aaa"));
    const list = listRecentPaymentRequests();
    expect(list.map((r) => r.link)).toEqual([
      "https://example.test/pay/aaa",
      "https://example.test/pay/bbb",
    ]);
  });

  it("caps history length instead of growing unbounded", () => {
    for (let i = 0; i < 25; i += 1) {
      saveRecentPaymentRequest(entry(`https://example.test/pay/${i}`));
    }
    expect(listRecentPaymentRequests()).toHaveLength(20);
  });
});
