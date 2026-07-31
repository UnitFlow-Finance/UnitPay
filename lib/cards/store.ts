import "server-only";

import { readJsonFile, updateJsonFile } from "@/lib/platform/store";
import type { VirtualCard, VirtualCardStatus, VirtualCardTransaction } from "@/lib/cards/types";

interface CardsDatabase {
  cards: VirtualCard[];
  transactions: VirtualCardTransaction[];
}

const CARDS_FILE = "cards.json";
const emptyDb: CardsDatabase = { cards: [], transactions: [] };

export async function listVirtualCards(ownerCircleWalletId?: string): Promise<VirtualCard[]> {
  const db = await readJsonFile(CARDS_FILE, emptyDb);
  return db.cards
    .map(normalizeCard)
    .filter((card) =>
      ownerCircleWalletId ? card.ownerCircleWalletId === ownerCircleWalletId : true,
    );
}

export async function getVirtualCard(id: string): Promise<{
  card: VirtualCard;
  transactions: VirtualCardTransaction[];
} | null> {
  const db = await readJsonFile(CARDS_FILE, emptyDb);
  const card = db.cards.find((entry) => entry.id === id);
  if (!card) return null;
  return {
    card: normalizeCard(card),
    transactions: db.transactions
      .filter((entry) => entry.cardId === id)
      .map(normalizeTransaction)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

export async function createVirtualCard(input: {
  ownerCircleWalletId: string;
  label: string;
  cardType: VirtualCard["cardType"];
  monthlyLimit: string;
  perTransactionLimit: string;
  merchantRestrictions: string[];
}): Promise<VirtualCard> {
  return updateJsonFile(CARDS_FILE, emptyDb, (db) => {
    const nowDate = new Date();
    const now = nowDate.toISOString();
    const card: VirtualCard = {
      id: crypto.randomUUID(),
      ownerCircleWalletId: input.ownerCircleWalletId,
      provider: "mastercard",
      cardType: input.cardType,
      label: input.label,
      network: "Mastercard",
      last4: String(Math.floor(1000 + Math.random() * 9000)),
      status: "Active",
      spendAsset: "Gateway USDC",
      currency: "USDC",
      balance: "0",
      monthlyLimit: input.monthlyLimit,
      perTransactionLimit: input.perTransactionLimit,
      merchantRestrictions: input.merchantRestrictions,
      billingAddress: "",
      expiryMonth: String(nowDate.getUTCMonth() + 1).padStart(2, "0"),
      expiryYear: String(nowDate.getUTCFullYear() + 3),
      spentThisMonth: "0",
      createdAt: now,
      updatedAt: now,
    };
    db.cards.unshift(card);
    return card;
  });
}

export async function updateVirtualCardStatus(
  id: string,
  status: VirtualCardStatus,
): Promise<VirtualCard | null> {
  return updateJsonFile(CARDS_FILE, emptyDb, (db) => {
    const card = db.cards.find((entry) => entry.id === id);
    if (!card) return null;
    card.status = status;
    card.updatedAt = new Date().toISOString();
    return normalizeCard(card);
  });
}

export async function fundVirtualCard(id: string, amount: string): Promise<{
  card: VirtualCard;
  transaction: VirtualCardTransaction;
} | null> {
  return moveVirtualCardBalance(id, amount, "Funding");
}

export async function withdrawVirtualCardBalance(id: string, amount: string): Promise<{
  card: VirtualCard;
  transaction: VirtualCardTransaction;
} | null> {
  return moveVirtualCardBalance(id, amount, "Withdrawal");
}

export async function deleteVirtualCard(id: string): Promise<boolean> {
  return updateJsonFile(CARDS_FILE, emptyDb, (db) => {
    const index = db.cards.findIndex((entry) => entry.id === id);
    if (index === -1) return false;
    db.cards.splice(index, 1);
    db.transactions = db.transactions.filter((entry) => entry.cardId !== id);
    return true;
  });
}

function moveVirtualCardBalance(
  id: string,
  amount: string,
  type: VirtualCardTransaction["type"],
): Promise<{ card: VirtualCard; transaction: VirtualCardTransaction } | null> {
  const numericAmount = Number(amount);
  if (!amount || Number.isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error("Enter a valid amount.");
  }
  return updateJsonFile(CARDS_FILE, emptyDb, (db) => {
    const card = db.cards.find((entry) => entry.id === id);
    if (!card) return null;
    const current = Number(normalizeCard(card).balance);
    if (type === "Withdrawal" && numericAmount > current) {
      throw new Error("Card balance is insufficient for this withdrawal.");
    }
    const nextBalance = type === "Funding" ? current + numericAmount : current - numericAmount;
    card.balance = trimAmount(nextBalance);
    card.updatedAt = new Date().toISOString();
    const transaction: VirtualCardTransaction = {
      id: crypto.randomUUID(),
      cardId: id,
      merchant: type === "Funding" ? "Gateway Balance" : "UnitPay Wallet",
      amount: trimAmount(numericAmount),
      asset: normalizeCard(card).currency,
      type,
      status: "Approved",
      createdAt: card.updatedAt,
    };
    db.transactions.unshift(transaction);
    return { card: normalizeCard(card), transaction };
  });
}

function normalizeCard(card: VirtualCard): VirtualCard {
  return {
    ...card,
    network: card.network ?? (card.provider === "visa" ? "Visa" : "Mastercard"),
    currency: card.currency ?? "USDC",
    balance: card.balance ?? "0",
    billingAddress: card.billingAddress ?? "",
    expiryMonth: card.expiryMonth ?? "12",
    expiryYear: card.expiryYear ?? String(new Date(card.createdAt || Date.now()).getUTCFullYear() + 3),
  };
}

function normalizeTransaction(transaction: VirtualCardTransaction): VirtualCardTransaction {
  return {
    ...transaction,
    type: transaction.type ?? "Authorization",
  };
}

function trimAmount(value: number): string {
  return value.toFixed(6).replace(/\.?0+$/, "");
}
