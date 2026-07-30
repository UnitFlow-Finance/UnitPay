export type ArbitratorAction =
  | "release"
  | "refund"
  | "require_evidence"
  | "escalate_manual"
  | "split";

export interface ArbitratorRule {
  id: string;
  ownerCircleWalletId: string;
  name: string;
  description: string;
  trigger: string;
  action: ArbitratorAction;
  timeoutHours?: number;
  splitPayeePercent?: number;
  requiresBothApproval: boolean;
  status: "Active" | "Paused";
  createdAt: string;
  updatedAt: string;
}
