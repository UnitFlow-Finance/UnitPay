export type P2POfferSide = "buy" | "sell";
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
  stakedAmount: string;
  kycStatus: "not_started" | "pending" | "verified";
  completionRate: number;
  rating: number;
  responseTimeSeconds: number;
  liquidity: number;
  online: boolean;
  activeTrades: number;
  createdAt: string;
}

export interface P2POffer {
  id: string;
  merchantId?: string;
  creatorWalletId: string;
  creatorCircleWalletId: string;
  side: P2POfferSide;
  asset: string;
  fiatCurrency: string;
  price: string;
  minAmount: string;
  maxAmount: string;
  availableAmount: string;
  paymentMethods: string[];
  terms: string;
  status: "Active" | "Paused" | "Filled" | "Cancelled";
  createdAt: string;
  updatedAt: string;
}

export interface P2PTrade {
  id: string;
  offerId: string;
  buyerCircleWalletId: string;
  sellerCircleWalletId: string;
  asset: string;
  fiatCurrency: string;
  cryptoAmount: string;
  fiatAmount: string;
  status: P2PTradeStatus;
  escrowMode: "automatic" | "ai_arbitrated" | "manual";
  paymentMethod: string;
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
