export type P2POfferSide = "buy" | "sell";
export type P2POfferPricingMode = "fixed" | "market_premium" | "market_discount";
export type P2PTradeStatus =
  | "Open"
  | "Locked"
  | "Paid"
  | "Released"
  | "Disputed"
  | "Refunded"
  | "Cancelled";

export interface P2PMerchantProfile {
  id: string;
  walletId: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  stakedAmount: string;
  kycStatus: "not_started" | "pending" | "verified";
  completionRate: number;
  rating: number;
  reviewCount?: number;
  completedTrades?: number;
  totalVolume?: string;
  responseTimeSeconds: number;
  liquidity: number;
  online: boolean;
  tradingPaused?: boolean;
  activeTrades: number;
  releaseTimeSeconds?: number;
  supportedPaymentMethods?: string[];
  terms?: string;
  lastActiveAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface P2POffer {
  id: string;
  merchantId?: string;
  creatorWalletId: string;
  creatorCircleWalletId: string;
  chainKey?: string;
  onChainOfferId?: string;
  custodyMode?: "on_chain_escrow";
  side: P2POfferSide;
  asset: string;
  fiatCurrency: string;
  price: string;
  pricingMode?: P2POfferPricingMode;
  priceMarginPercent?: string;
  minAmount: string;
  maxAmount: string;
  availableAmount: string;
  totalLiquidity?: string;
  paymentMethods: string[];
  paymentTimeLimitMinutes?: number;
  terms: string;
  instructions?: string;
  kycRequired?: boolean;
  status: "Active" | "Paused" | "Filled" | "Cancelled";
  createdAt: string;
  updatedAt: string;
}

export interface P2PTradeEvidence {
  id: string;
  submittedByCircleWalletId: string;
  label: string;
  urlOrReference: string;
  createdAt: string;
}

export interface P2PTradeActivity {
  id: string;
  actorCircleWalletId: string;
  action: string;
  note?: string;
  createdAt: string;
}

export interface P2PTrade {
  id: string;
  offerId: string;
  chainKey?: string;
  onChainTradeId?: string;
  merchantId?: string;
  buyerCircleWalletId: string;
  sellerCircleWalletId: string;
  asset: string;
  fiatCurrency: string;
  cryptoAmount: string;
  fiatAmount: string;
  status: P2PTradeStatus;
  escrowMode: "automatic" | "ai_arbitrated" | "manual";
  paymentMethod: string;
  paymentDeadlineAt: string;
  proofOfPayment?: string;
  disputeReason?: string;
  resolutionNote?: string;
  evidence?: P2PTradeEvidence[];
  activity?: P2PTradeActivity[];
  createdAt: string;
  updatedAt: string;
}

export interface P2PBalance {
  circleWalletId: string;
  asset: string;
  available: string;
  locked: string;
}

export const P2P_ASSETS = ["USDC", "EURC", "CIRBTC"] as const;
export const P2P_FIAT_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "NGN",
  "CAD",
  "AUD",
  "SGD",
  "AED",
  "INR",
  "KES",
  "GHS",
  "ZAR",
  "BRL",
  "MXN",
  "JPY",
  "KRW",
  "PHP",
  "IDR",
  "MYR",
  "CNY",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "TRY",
  "THB",
  "VND",
  "UGX",
  "TZS",
  "RWF",
  "XOF",
] as const;

export const P2P_PAYMENT_METHODS = [
  "Bank Transfer",
  "Mobile Money",
  "Cash",
  "Digital Wallet",
  "Local Payment Provider",
  "Card Transfer",
  "UPI",
  "SEPA",
  "ACH",
] as const;
