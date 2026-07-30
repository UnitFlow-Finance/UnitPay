export type VirtualCardProvider = "mastercard" | "visa" | "other";
export type VirtualCardStatus = "Active" | "Frozen" | "Closed";
export type VirtualCardType = "Reusable" | "Single-use" | "Subscription";

export interface VirtualCard {
  id: string;
  ownerCircleWalletId: string;
  provider: VirtualCardProvider;
  cardType: VirtualCardType;
  label: string;
  last4: string;
  status: VirtualCardStatus;
  spendAsset: string;
  monthlyLimit: string;
  perTransactionLimit: string;
  merchantRestrictions: string[];
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
  status: "Approved" | "Declined" | "Reversed";
  createdAt: string;
}
