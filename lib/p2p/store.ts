import "server-only";

import { readJsonFile, updateJsonFile } from "@/lib/platform/store";
import type {
  P2PBalance,
  P2PMerchantProfile,
  P2POffer,
  P2PTrade,
  P2PTradeActivity,
  P2PTradeEvidence,
} from "@/lib/p2p/types";

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
  status?: string;
  merchantId?: string;
}): Promise<P2POffer[]> {
  const db = await readJsonFile(P2P_FILE, emptyDb);
  return db.offers
    .map(normalizeOffer)
    .filter((offer) =>
      filters?.status
        ? filters.status === "all" || offer.status === filters.status
        : offer.status === "Active",
    )
    .filter((offer) => (filters?.side ? offer.side === filters.side : true))
    .filter((offer) => (filters?.asset ? offer.asset === filters.asset : true))
    .filter((offer) =>
      filters?.fiatCurrency ? offer.fiatCurrency === filters.fiatCurrency : true,
    )
    .filter((offer) => (filters?.merchantId ? offer.merchantId === filters.merchantId : true))
    .sort(byNewest);
}

export async function listAllP2POffers(filters?: {
  creatorCircleWalletId?: string;
  merchantId?: string;
}): Promise<P2POffer[]> {
  const db = await readJsonFile(P2P_FILE, emptyDb);
  return db.offers
    .map(normalizeOffer)
    .filter((offer) =>
      filters?.creatorCircleWalletId
        ? offer.creatorCircleWalletId === filters.creatorCircleWalletId
        : true,
    )
    .filter((offer) => (filters?.merchantId ? offer.merchantId === filters.merchantId : true))
    .sort(byNewest);
}

export async function getP2POffer(id: string): Promise<P2POffer | null> {
  const db = await readJsonFile(P2P_FILE, emptyDb);
  const offer = db.offers.find((entry) => entry.id === id);
  return offer ? normalizeOffer(offer) : null;
}

export async function createP2POffer(
  input: Omit<P2POffer, "id" | "status" | "createdAt" | "updatedAt">,
): Promise<P2POffer> {
  return updateJsonFile(P2P_FILE, emptyDb, (db) => {
    const now = new Date().toISOString();
    const merchant = ensureMerchant(db, {
      walletId: input.creatorWalletId,
      circleWalletId: input.creatorCircleWalletId,
      displayName: input.merchantId || `Merchant ${input.creatorCircleWalletId.slice(0, 8)}`,
      paymentMethods: input.paymentMethods,
    });
    const offer: P2POffer = {
      ...input,
      id: crypto.randomUUID(),
      merchantId: input.merchantId ?? merchant.id,
      totalLiquidity: input.totalLiquidity ?? input.availableAmount,
      paymentTimeLimitMinutes: input.paymentTimeLimitMinutes ?? 15,
      instructions: input.instructions ?? "Send fiat payment using the selected payment method, then mark payment sent.",
      kycRequired: input.kycRequired ?? false,
      status: "Active",
      createdAt: now,
      updatedAt: now,
    };
    db.offers.unshift(offer);
    return offer;
  });
}

export async function updateP2POffer(
  id: string,
  updates: Partial<Pick<
    P2POffer,
    | "price"
    | "pricingMode"
    | "priceMarginPercent"
    | "minAmount"
    | "maxAmount"
    | "availableAmount"
    | "paymentMethods"
    | "paymentTimeLimitMinutes"
    | "terms"
    | "instructions"
    | "kycRequired"
    | "status"
  >>,
): Promise<P2POffer | null> {
  return updateJsonFile(P2P_FILE, emptyDb, (db) => {
    const offer = db.offers.find((entry) => entry.id === id);
    if (!offer) return null;
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        (offer as unknown as Record<string, unknown>)[key] = value;
      }
    }
    offer.updatedAt = new Date().toISOString();
    return normalizeOffer(offer);
  });
}

export async function deleteP2POffer(id: string): Promise<boolean> {
  return updateJsonFile(P2P_FILE, emptyDb, (db) => {
    const index = db.offers.findIndex((entry) => entry.id === id);
    if (index === -1) return false;
    db.offers.splice(index, 1);
    return true;
  });
}

export async function listP2PTrades(circleWalletId?: string): Promise<P2PTrade[]> {
  const db = await readJsonFile(P2P_FILE, emptyDb);
  return db.trades
    .map(normalizeTrade)
    .filter((trade) =>
      circleWalletId
        ? trade.buyerCircleWalletId === circleWalletId ||
          trade.sellerCircleWalletId === circleWalletId
        : true,
    )
    .sort(byNewest);
}

export async function getP2PTrade(id: string): Promise<P2PTrade | null> {
  const db = await readJsonFile(P2P_FILE, emptyDb);
  const trade = db.trades.find((entry) => entry.id === id);
  return trade ? normalizeTrade(trade) : null;
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
    const paymentDeadlineAt = new Date(
      Date.now() + (offer.paymentTimeLimitMinutes ?? 15) * 60_000,
    ).toISOString();
    const buyerCircleWalletId =
      offer.side === "sell" ? input.takerCircleWalletId : offer.creatorCircleWalletId;
    const sellerCircleWalletId =
      offer.side === "sell" ? offer.creatorCircleWalletId : input.takerCircleWalletId;
    const trade: P2PTrade = {
      id: crypto.randomUUID(),
      offerId: offer.id,
      merchantId: offer.merchantId,
      buyerCircleWalletId,
      sellerCircleWalletId,
      asset: offer.asset,
      fiatCurrency: offer.fiatCurrency,
      cryptoAmount: input.amount,
      fiatAmount: fiatAmount.toFixed(2),
      status: "Locked",
      escrowMode: input.escrowMode,
      paymentMethod: input.paymentMethod,
      paymentDeadlineAt,
      evidence: [],
      activity: [
        {
          id: crypto.randomUUID(),
          actorCircleWalletId: input.takerCircleWalletId,
          action: "Trade locked in escrow",
          note: `${input.amount} ${offer.asset} reserved for this P2P trade.`,
          createdAt: now,
        },
      ],
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

export async function markP2PTradePaid(
  id: string,
  actorCircleWalletId: string,
  proofOfPayment?: string,
): Promise<P2PTrade | null> {
  return updateTrade(id, actorCircleWalletId, "Paid", "Payment marked sent", {
    proofOfPayment,
  });
}

export async function releaseP2PTrade(
  id: string,
  actorCircleWalletId: string,
): Promise<P2PTrade | null> {
  return updateTrade(id, actorCircleWalletId, "Released", "Escrow released");
}

export async function cancelP2PTrade(
  id: string,
  actorCircleWalletId: string,
): Promise<P2PTrade | null> {
  return updateTrade(id, actorCircleWalletId, "Cancelled", "Trade cancelled");
}

export async function disputeP2PTrade(
  id: string,
  actorCircleWalletId: string,
  reason: string,
): Promise<P2PTrade | null> {
  return updateTrade(id, actorCircleWalletId, "Disputed", "Dispute opened", {
    disputeReason: reason,
  });
}

export async function resolveP2PTrade(
  id: string,
  actorCircleWalletId: string,
  outcome: "release" | "refund",
  note: string,
): Promise<P2PTrade | null> {
  return updateTrade(
    id,
    actorCircleWalletId,
    outcome === "release" ? "Released" : "Refunded",
    outcome === "release" ? "Dispute resolved to seller" : "Dispute resolved to buyer",
    { resolutionNote: note },
  );
}

export async function addP2PTradeEvidence(
  id: string,
  input: Omit<P2PTradeEvidence, "id" | "createdAt">,
): Promise<P2PTrade | null> {
  return updateJsonFile(P2P_FILE, emptyDb, (db) => {
    const trade = db.trades.find((entry) => entry.id === id);
    if (!trade) return null;
    const now = new Date().toISOString();
    trade.evidence = [...(trade.evidence ?? []), { ...input, id: crypto.randomUUID(), createdAt: now }];
    appendActivity(trade, {
      actorCircleWalletId: input.submittedByCircleWalletId,
      action: "Evidence submitted",
      note: input.label,
      createdAt: now,
    });
    trade.updatedAt = now;
    return normalizeTrade(trade);
  });
}

export async function upsertP2PMerchantProfile(input: {
  walletId: string;
  circleWalletId: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  stakedAmount?: string;
  kycStatus?: P2PMerchantProfile["kycStatus"];
  tradingPaused?: boolean;
  supportedPaymentMethods?: string[];
  terms?: string;
}): Promise<P2PMerchantProfile> {
  return updateJsonFile(P2P_FILE, emptyDb, (db) => {
    const merchant = ensureMerchant(db, input);
    merchant.displayName = input.displayName || merchant.displayName;
    merchant.avatarUrl = input.avatarUrl ?? merchant.avatarUrl;
    merchant.bio = input.bio ?? merchant.bio;
    merchant.stakedAmount = input.stakedAmount ?? merchant.stakedAmount;
    merchant.kycStatus = input.kycStatus ?? merchant.kycStatus;
    merchant.tradingPaused = input.tradingPaused ?? merchant.tradingPaused;
    merchant.supportedPaymentMethods = input.supportedPaymentMethods ?? merchant.supportedPaymentMethods;
    merchant.terms = input.terms ?? merchant.terms;
    merchant.online = !merchant.tradingPaused;
    merchant.lastActiveAt = new Date().toISOString();
    merchant.updatedAt = merchant.lastActiveAt;
    return normalizeMerchant(merchant);
  });
}

export async function listP2PMerchants(): Promise<P2PMerchantProfile[]> {
  const db = await readJsonFile(P2P_FILE, emptyDb);
  return db.merchants.map(normalizeMerchant).sort((a, b) => merchantScore(b) - merchantScore(a));
}

export async function getP2PMerchant(id: string): Promise<P2PMerchantProfile | null> {
  const db = await readJsonFile(P2P_FILE, emptyDb);
  const merchant = db.merchants.find((entry) => entry.id === id || entry.walletId === id);
  return merchant ? normalizeMerchant(merchant) : null;
}

export async function rankAvailableMerchants(): Promise<P2PMerchantProfile[]> {
  const db = await readJsonFile(P2P_FILE, emptyDb);
  return db.merchants
    .map(normalizeMerchant)
    .filter((merchant) => merchant.kycStatus === "verified" && merchant.activeTrades < 5)
    .sort((a, b) => merchantScore(b) - merchantScore(a));
}

function ensureMerchant(
  db: P2PDatabase,
  input: {
    walletId: string;
    circleWalletId: string;
    displayName?: string;
    paymentMethods?: string[];
  },
): P2PMerchantProfile {
  let merchant = db.merchants.find(
    (entry) => entry.walletId === input.walletId || entry.id === input.circleWalletId,
  );
  if (!merchant) {
    const now = new Date().toISOString();
    merchant = {
      id: input.circleWalletId,
      walletId: input.walletId,
      displayName: input.displayName || `Merchant ${input.circleWalletId.slice(0, 8)}`,
      stakedAmount: "0",
      kycStatus: "verified",
      completionRate: 100,
      rating: 5,
      reviewCount: 0,
      completedTrades: 0,
      totalVolume: "0",
      responseTimeSeconds: 180,
      liquidity: 0,
      online: true,
      tradingPaused: false,
      activeTrades: 0,
      releaseTimeSeconds: 300,
      supportedPaymentMethods: input.paymentMethods ?? ["Bank Transfer"],
      terms: "Fast settlement after payment confirmation.",
      lastActiveAt: now,
      createdAt: now,
      updatedAt: now,
    };
    db.merchants.unshift(merchant);
  }
  return merchant;
}

function updateTrade(
  id: string,
  actorCircleWalletId: string,
  status: P2PTrade["status"],
  action: string,
  updates: Partial<P2PTrade> = {},
): Promise<P2PTrade | null> {
  return updateJsonFile(P2P_FILE, emptyDb, (db) => {
    const trade = db.trades.find((entry) => entry.id === id);
    if (!trade) return null;
    const now = new Date().toISOString();
    Object.assign(trade, updates, { status, updatedAt: now });
    appendActivity(trade, {
      actorCircleWalletId,
      action,
      note: updates.resolutionNote ?? updates.disputeReason ?? updates.proofOfPayment,
      createdAt: now,
    });
    if (status === "Released") {
      const merchant = trade.merchantId
        ? db.merchants.find((entry) => entry.id === trade.merchantId)
        : undefined;
      if (merchant) {
        merchant.completedTrades = (merchant.completedTrades ?? 0) + 1;
        merchant.totalVolume = trimAmount(Number(merchant.totalVolume ?? "0") + Number(trade.cryptoAmount));
        merchant.activeTrades = Math.max(0, merchant.activeTrades - 1);
        merchant.updatedAt = now;
      }
    }
    return normalizeTrade(trade);
  });
}

function appendActivity(trade: P2PTrade, input: Omit<P2PTradeActivity, "id">): void {
  trade.activity = [...(trade.activity ?? []), { ...input, id: crypto.randomUUID() }];
}

function normalizeOffer(offer: P2POffer): P2POffer {
  return {
    ...offer,
    pricingMode: offer.pricingMode ?? "fixed",
    priceMarginPercent: offer.priceMarginPercent ?? "0",
    totalLiquidity: offer.totalLiquidity ?? offer.availableAmount,
    paymentTimeLimitMinutes: offer.paymentTimeLimitMinutes ?? 15,
    instructions: offer.instructions ?? "Send fiat payment and upload proof before the deadline.",
    kycRequired: offer.kycRequired ?? false,
  };
}

function normalizeTrade(trade: P2PTrade): P2PTrade {
  return {
    ...trade,
    paymentDeadlineAt:
      trade.paymentDeadlineAt ??
      new Date(new Date(trade.createdAt).getTime() + 15 * 60_000).toISOString(),
    evidence: trade.evidence ?? [],
    activity: trade.activity ?? [],
  };
}

function normalizeMerchant(merchant: P2PMerchantProfile): P2PMerchantProfile {
  return {
    ...merchant,
    reviewCount: merchant.reviewCount ?? 0,
    completedTrades: merchant.completedTrades ?? 0,
    totalVolume: merchant.totalVolume ?? "0",
    tradingPaused: merchant.tradingPaused ?? false,
    releaseTimeSeconds: merchant.releaseTimeSeconds ?? merchant.responseTimeSeconds,
    supportedPaymentMethods: merchant.supportedPaymentMethods ?? ["Bank Transfer"],
    lastActiveAt: merchant.lastActiveAt ?? merchant.createdAt,
    updatedAt: merchant.updatedAt ?? merchant.createdAt,
  };
}

function merchantScore(merchant: P2PMerchantProfile): number {
  return (
    merchant.completionRate * 0.35 +
    merchant.rating * 10 * 0.25 +
    merchant.liquidity * 0.0001 +
    (merchant.online ? 20 : 0) -
    merchant.responseTimeSeconds * 0.01 +
    (merchant.completedTrades ?? 0) * 0.05
  );
}

function trimAmount(value: number): string {
  return value.toFixed(6).replace(/\.?0+$/, "");
}
