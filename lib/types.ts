/** Minimal frontend-facing shapes for data returned by our /api/wallet/* routes. */

export interface UnitPayWallet {
  id: string;
  address: string;
  blockchain: string;
  state?: string;
  accountType?: string;
  custodyType?: string;
}

export interface UnitPayTokenBalance {
  amount: string; // human-readable, e.g. "20.5"
  token: {
    id?: string;
    name?: string;
    symbol?: string;
    tokenAddress?: string;
    blockchain?: string;
    isNative?: boolean;
    decimals?: number;
  };
}

export interface UnitPayTransaction {
  id: string;
  state: string; // e.g. INITIATED, PENDING, CONFIRMED, COMPLETE, FAILED
  txHash?: string;
  blockchain: string;
  amounts?: string[];
  sourceAddress?: string;
  destinationAddress?: string;
  createDate?: string;
  transactionType?: string;
}

export interface UnitPayWalletBalanceGroup {
  wallet: UnitPayWallet;
  tokenBalances: UnitPayTokenBalance[];
}
