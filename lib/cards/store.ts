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
  return db.cards.filter((card) =>
    ownerCircleWalletId ? card.ownerCircleWalletId === ownerCircleWalletId : true,
  );
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
    const now = new Date().toISOString();
    const card: VirtualCard = {
      id: crypto.randomUUID(),
      ownerCircleWalletId: input.ownerCircleWalletId,
      provider: "mastercard",
      cardType: input.cardType,
      label: input.label,
      last4: String(Math.floor(1000 + Math.random() * 9000)),
      status: "Active",
      spendAsset: "Gateway USDC",
      monthlyLimit: input.monthlyLimit,
      perTransactionLimit: input.perTransactionLimit,
      merchantRestrictions: input.merchantRestrictions,
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
    return card;
  });
}
