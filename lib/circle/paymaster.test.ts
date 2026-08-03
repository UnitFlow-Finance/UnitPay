import { describe, expect, it } from "vitest";
import {
  chainSupportsCirclePaymaster,
  defaultWalletAccountTypeForBlockchain,
  defaultWalletAccountTypeForChainKey,
  hasNativeGasBalance,
  nativeGasBalance,
  paymasterTransferFee,
  walletSupportsCirclePaymaster,
} from "@/lib/circle/paymaster";
import type { UnitPayTokenBalance } from "@/lib/types";

function balance(
  amount: string,
  symbol: string | undefined,
  isNative = false,
): UnitPayTokenBalance {
  return {
    amount,
    token: { symbol, isNative },
  };
}

describe("Circle paymaster helpers", () => {
  it("enables paymaster only for non-Arc EVM chains", () => {
    expect(chainSupportsCirclePaymaster("arcTestnet")).toBe(false);
    expect(chainSupportsCirclePaymaster("baseSepolia")).toBe(true);
    expect(chainSupportsCirclePaymaster("solanaDevnet")).toBe(false);
  });

  it("detects native gas balances without treating Arc native USDC as separate gas", () => {
    expect(nativeGasBalance([balance("1", "ETH", true)])?.amount).toBe("1");
    expect(hasNativeGasBalance([balance("0", "ETH", true)])).toBe(false);
    expect(hasNativeGasBalance([balance("5", "USDC", true)])).toBe(false);
  });

  it("builds native and paymaster fee payloads", () => {
    expect(paymasterTransferFee("native")).toEqual({
      type: "level",
      config: { feeLevel: "MEDIUM" },
    });
    expect(paymasterTransferFee("paymaster")).toMatchObject({
      type: "paymaster",
      config: { feeLevel: "MEDIUM", paymaster: true, sponsored: true },
    });
  });

  it("requires an SCA wallet for paymaster transfers", () => {
    expect(walletSupportsCirclePaymaster({ accountType: "SCA" })).toBe(true);
    expect(walletSupportsCirclePaymaster({ accountType: "sca" })).toBe(true);
    expect(walletSupportsCirclePaymaster({ accountType: "EOA" })).toBe(false);
    expect(walletSupportsCirclePaymaster(null)).toBe(false);
  });

  it("defaults EVM wallets to SCA and Solana wallets to EOA", () => {
    expect(defaultWalletAccountTypeForChainKey("arcTestnet")).toBe("SCA");
    expect(defaultWalletAccountTypeForChainKey("baseSepolia")).toBe("SCA");
    expect(defaultWalletAccountTypeForChainKey("solanaDevnet")).toBe("EOA");
    expect(defaultWalletAccountTypeForBlockchain("BASE-SEPOLIA")).toBe("SCA");
    expect(defaultWalletAccountTypeForBlockchain("SOL-DEVNET")).toBe("EOA");
  });
});
