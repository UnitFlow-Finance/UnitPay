import { getChain } from "@/lib/chains/config";
import { chainKeyForBlockchain } from "@/lib/chains/lookup";
import type { UnitPayTokenBalance, UnitPayWallet } from "@/lib/types";
import { tokenAmount, tokenSymbol } from "@/lib/wallet/balances";

export type SendFeeMode = "native" | "paymaster";
export type CircleWalletAccountType = "EOA" | "SCA";

export function circlePaymasterEnabled(): boolean {
  return (
    process.env.CIRCLE_PAYMASTER_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_CIRCLE_PAYMASTER_ENABLED === "true"
  );
}

export function chainSupportsCirclePaymaster(chainKey: string): boolean {
  const chain = getChain(chainKey);
  return chain.family === "evm" && !chain.usdcIsNativeGas;
}

export function walletSupportsCirclePaymaster(
  wallet?: Pick<UnitPayWallet, "accountType"> | null,
): boolean {
  return wallet?.accountType?.toUpperCase() === "SCA";
}

export function defaultWalletAccountTypeForChainKey(chainKey: string): CircleWalletAccountType {
  return getChain(chainKey).family === "evm" ? "SCA" : "EOA";
}

export function defaultWalletAccountTypeForBlockchain(
  blockchain: string,
): CircleWalletAccountType {
  return defaultWalletAccountTypeForChainKey(chainKeyForBlockchain(blockchain));
}

export function normalizeWalletAccountType(
  accountType: unknown,
  blockchain: string,
): CircleWalletAccountType {
  if (accountType === "EOA" || accountType === "SCA") return accountType;
  return defaultWalletAccountTypeForBlockchain(blockchain);
}

export function nativeGasBalance(
  balances: UnitPayTokenBalance[],
): UnitPayTokenBalance | null {
  return balances.find((balance) => balance.token.isNative && tokenSymbol(balance) !== "USDC") ?? null;
}

export function hasNativeGasBalance(balances: UnitPayTokenBalance[]): boolean {
  const balance = nativeGasBalance(balances);
  return Boolean(balance && tokenAmount(balance) > 0);
}

export function paymasterTransferFee(feeMode: SendFeeMode) {
  if (feeMode === "paymaster") {
    return {
      type: "paymaster",
      config: {
        feeLevel: "MEDIUM",
        paymaster: true,
        sponsored: true,
      },
    };
  }

  return { type: "level", config: { feeLevel: "MEDIUM" } };
}
