import "server-only";

import { getChain } from "@/lib/chains/config";
import { badRequest } from "@/lib/circle/routeErrors";
import { usdcToBaseUnits } from "@/lib/units";
import type { UnitPayTokenBalance, UnitPayWallet } from "@/lib/types";

const ARC_GAS_RESERVE_BASE_UNITS = usdcToBaseUnits("0.02");

function tokenSymbol(balance: UnitPayTokenBalance): string {
  return balance.token.symbol || (balance.token.isNative ? "Native" : "TOKEN");
}

function tokenAddress(balance: UnitPayTokenBalance): string {
  return (balance.token.tokenAddress || "").toLowerCase();
}

function humanAmountToBaseUnits(amount: string): bigint {
  try {
    return usdcToBaseUnits(amount || "0");
  } catch {
    return 0n;
  }
}

function usdcBalanceBaseUnits(balances: UnitPayTokenBalance[], chainKey: string): bigint {
  const chain = getChain(chainKey);
  let max = 0n;

  for (const balance of balances) {
    const symbol = tokenSymbol(balance);
    const isUsdc =
      symbol === "USDC" ||
      tokenAddress(balance) === chain.usdcAddress.toLowerCase() ||
      (chain.usdcIsNativeGas && Boolean(balance.token.isNative));
    if (!isUsdc) continue;
    const amount = humanAmountToBaseUnits(balance.amount);
    if (amount > max) max = amount;
  }

  return max;
}

function nativeGasBalanceBaseUnits(balances: UnitPayTokenBalance[]): bigint {
  let max = 0n;
  for (const balance of balances) {
    if (!balance.token.isNative) continue;
    const amount = humanAmountToBaseUnits(balance.amount);
    if (amount > max) max = amount;
  }
  return max;
}

export async function requireWalletForBlockchain({
  circleClient,
  userToken,
  walletId,
  blockchain,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  circleClient: any;
  userToken: string;
  walletId: string;
  blockchain: string;
}): Promise<UnitPayWallet> {
  const response = await circleClient.listWallets({ userToken });
  const wallets = (response.data?.wallets ?? []) as UnitPayWallet[];
  const wallet = wallets.find((entry) => entry.id === walletId);
  if (!wallet) throw badRequest("Selected wallet was not found for this account.");
  if (wallet.blockchain !== blockchain) {
    throw badRequest(
      `Selected wallet is on ${wallet.blockchain}, but this transaction must use ${blockchain}.`,
    );
  }
  return wallet;
}

export async function requireUsdcSpendableBalance({
  circleClient,
  userToken,
  walletId,
  chainKey,
  amount,
  requireTransferAmount = true,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  circleClient: any;
  userToken: string;
  walletId: string;
  chainKey: string;
  amount?: string;
  requireTransferAmount?: boolean;
}): Promise<void> {
  const chain = getChain(chainKey);
  const response = await circleClient.getWalletTokenBalance({ userToken, walletId });
  const balances = (response.data?.tokenBalances ?? []) as UnitPayTokenBalance[];
  const usdcBalance = usdcBalanceBaseUnits(balances, chainKey);
  const requested = amount ? usdcToBaseUnits(amount) : 0n;

  if (requireTransferAmount && requested <= 0n) {
    throw badRequest("Enter a valid USDC amount.");
  }

  if (chain.usdcIsNativeGas) {
    const required = requireTransferAmount ? requested + ARC_GAS_RESERVE_BASE_UNITS : ARC_GAS_RESERVE_BASE_UNITS;
    if (usdcBalance < required) {
      throw badRequest(
        `Insufficient Arc Testnet USDC. Keep at least 0.02 USDC for gas; this action needs ${amount ?? "0"} USDC plus gas.`,
      );
    }
    return;
  }

  if (requireTransferAmount && usdcBalance < requested) {
    throw badRequest(`Insufficient USDC balance on ${chain.label} for this transaction.`);
  }

  const nativeGasBalance = nativeGasBalanceBaseUnits(balances);
  if (nativeGasBalance <= 0n) {
    throw badRequest(`Insufficient native gas on ${chain.label} to submit this transaction.`);
  }
}
