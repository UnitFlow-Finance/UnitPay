"use client";

import type { P2PEncryptedTradeMessage, P2PTrade } from "@/lib/p2p/types";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = window.atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function chatKey(trade: P2PTrade): Promise<CryptoKey> {
  const participants = [trade.buyerCircleWalletId, trade.sellerCircleWalletId].sort().join(":");
  const material = await window.crypto.subtle.digest(
    "SHA-256",
    textEncoder.encode(`unitpay-p2p-chat-v1:${trade.id}:${trade.offerId}:${participants}`),
  );
  return window.crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptP2PChatMessage(
  trade: P2PTrade,
  plaintext: string,
): Promise<Pick<P2PEncryptedTradeMessage, "encryptedPayload" | "iv" | "algorithm">> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await chatKey(trade),
    textEncoder.encode(plaintext),
  );
  return {
    encryptedPayload: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
    algorithm: "AES-GCM",
  };
}

export async function decryptP2PChatMessage(
  trade: P2PTrade,
  message: P2PEncryptedTradeMessage,
): Promise<string> {
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(message.iv) },
    await chatKey(trade),
    base64ToBytes(message.encryptedPayload),
  );
  return textDecoder.decode(decrypted);
}
