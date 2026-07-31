export type VirtualCardProvider = "mastercard" | "visa" | "other";
export type VirtualCardStatus = "Active" | "Frozen" | "Closed" | "Expired";
export type VirtualCardType = "Reusable" | "Single-use" | "Subscription";

export interface VirtualCard {
  id: string;
  ownerCircleWalletId: string;
  provider: VirtualCardProvider;
  cardType: VirtualCardType;
  label: string;
  network: "Mastercard" | "Visa" | "Other";
  last4: string;
  status: VirtualCardStatus;
  spendAsset: string;
  currency: string;
  balance: string;
  monthlyLimit: string;
  perTransactionLimit: string;
  merchantRestrictions: string[];
  billingAddress?: string;
  expiryMonth: string;
  expiryYear: string;
  spentThisMonth: string;
  createdAt: string;
  updatedAt: string;
}

export interface VirtualCardTransaction {
  id: string;
  cardId: string;
  merchant: string;
  amount: string;
  asset: string;
  type: "Funding" | "Withdrawal" | "Authorization" | "Refund";
  status: "Approved" | "Declined" | "Reversed";
  createdAt: string;
}
