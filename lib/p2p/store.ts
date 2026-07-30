import "server-only";

import { readJsonFile, updateJsonFile } from "@/lib/platform/store";
import type { P2PBalance, P2PMerchantProfile, P2POffer, P2PTrade } from "@/lib/p2p/types";

interface P2PDatabase {
  offers: P2POffer[];
  trades: P2PTrade[];
  merchants: P2PMerchantProfile[];
  balances: P2PBalance[];
}

const P2P_FILE = "p2p.json";
const emptyDb: P2PDatabase = { offers: [], trades: [], merchants: [], balances: [] };

function byNewest<T extends { createdAt: string }>(a: T, b: T): number {
  return b.createdAt.localeCompare(a.createdAt);
}

export async function listP2POffers(filters?: {
  side?: string;
  asset?: string;
  fiatCurrency?: string;
}): Promise<P2POffer[]> {
  const db = await readJsonFile(P2P_FILE, emptyDb);
  return db.offers
    .filter((offer) => offer.status === "Active")
    .filter((offer) => (filters?.side ? offer.side === filters.side : true))
    .filter((offer) => (filters?.asset ? offer.asset === filters.asset : true))
    .filter((offer) =>
      filters?.fiatCurrency ? offer.fiatCurrency === filters.fiatCurrency : true,
    )
    .sort(byNewest);
}

export async function getP2POffer(id: string): Promise<P2POffer | null> {
  const db = await readJsonFile(P2P_FILE, emptyDb);
  return db.offers.find((offer) => offer.id === id) ?? null;
}

export async function createP2POffer(
  input: Omit<P2POffer, "id" | "status" | "createdAt" | "updatedAt">,
): Promise<P2POffer> {
  return updateJsonFile(P2P_FILE, emptyDb, (db) => {
    const now = new Date().toISOString();
    const offer: P2POffer = {
      ...input,
      id: crypto.randomUUID(),
      status: "Active",
      createdAt: now,
      updatedAt: now,
    };
    db.offers.unshift(offer);
    return offer;
  });
}

export async function listP2PTrades(circleWalletId?: string): Promise<P2PTrade[]> {
  const db = await readJsonFile(P2P_FILE, emptyDb);
  return db.trades
    .filter((trade) =>
      circleWalletId
        ? trade.buyerCircleWalletId === circleWalletId ||
          trade.sellerCircleWalletId === circleWalletId
        : true,
    )
    .sort(byNewest);
}

export async function createP2PTrade(input: {
  offerId: string;
  takerCircleWalletId: string;
  amount: string;
  escrowMode: P2PTrade["escrowMode"];
  paymentMethod: string;
}): Promise<P2PTrade | null> {
  return updateJsonFile(P2P_FILE, emptyDb, (db) => {
    const offer = db.offers.find((entry) => entry.id === input.offerId);
    if (!offer || offer.status !== "Active") return null;

    const activeTakerTrades = db.trades.filter(
      (trade) =>
        [trade.buyerCircleWalletId, trade.sellerCircleWalletId].includes(input.takerCircleWalletId) &&
        ["Open", "Locked", "Paid", "Disputed"].includes(trade.status),
    );
    if (activeTakerTrades.length >= 2) {
      throw new Error("Regular users can only keep one active buy and one active sell trade.");
    }

    const cryptoAmount = Number(input.amount);
    const fiatAmount = cryptoAmount * Number(offer.price);
    const now = new Date().toISOString();
    const buyerCircleWalletId =
      offer.side === "sell" ? input.takerCircleWalletId : offer.creatorCircleWalletId;
    const sellerCircleWalletId =
      offer.side === "sell" ? offer.creatorCircleWalletId : input.takerCircleWalletId;
    const trade: P2PTrade = {
      id: crypto.randomUUID(),
      offerId: offer.id,
      buyerCircleWalletId,
      sellerCircleWalletId,
      asset: offer.asset,
      fiatCurrency: offer.fiatCurrency,
      cryptoAmount: input.amount,
      fiatAmount: fiatAmount.toFixed(2),
      status: "Locked",
      escrowMode: input.escrowMode,
      paymentMethod: input.paymentMethod,
      createdAt: now,
      updatedAt: now,
    };
    offer.availableAmount = Math.max(0, Number(offer.availableAmount) - cryptoAmount).toString();
    offer.updatedAt = now;
    if (Number(offer.availableAmount) <= 0) offer.status = "Filled";
    db.trades.unshift(trade);
    return trade;
  });
}

export async function updateP2PTradeStatus(
  id: string,
  status: P2PTrade["status"],
): Promise<P2PTrade | null> {
  return updateJsonFile(P2P_FILE, emptyDb, (db) => {
    const trade = db.trades.find((entry) => entry.id === id);
    if (!trade) return null;
    trade.status = status;
    trade.updatedAt = new Date().toISOString();
    return trade;
  });
}

export async function rankAvailableMerchants(): Promise<P2PMerchantProfile[]> {
  const db = await readJsonFile(P2P_FILE, emptyDb);
  return db.merchants
    .filter((merchant) => merchant.kycStatus === "verified" && merchant.activeTrades < 5)
    .sort((a, b) => {
      const score = (merchant: P2PMerchantProfile) =>
        merchant.completionRate * 0.35 +
        merchant.rating * 10 * 0.25 +
        merchant.liquidity * 0.0001 +
        (merchant.online ? 20 : 0) -
        merchant.responseTimeSeconds * 0.01;
      return score(b) - score(a);
    });
}
