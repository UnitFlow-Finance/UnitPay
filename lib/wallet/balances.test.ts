import { describe, expect, it } from "vitest";
import {
  displayTokenBalances,
  formatCompactBalance,
  groupTotalBySymbol,
  primaryUsdcBalance,
} from "@/lib/wallet/balances";
import type { UnitPayTokenBalance, UnitPayWalletBalanceGroup } from "@/lib/types";

function balance(
  amount: string,
  symbol: string | undefined,
  options: Partial<UnitPayTokenBalance["token"]> = {},
): UnitPayTokenBalance {
  return {
    amount,
    token: {
      symbol,
      ...options,
    },
  };
}

describe("wallet balance display helpers", () => {
  it("deduplicates Arc Testnet native USDC and token USDC in totals", () => {
    const walletBalances: UnitPayWalletBalanceGroup[] = [
      {
        wallet: {
          id: "arc-wallet",
          address: "0x0000000000000000000000000000000000000001",
          blockchain: "ARC-TESTNET",
        },
        tokenBalances: [
          balance("12.5", "USDC", { isNative: true }),
          balance("12.500000", "USDC", {
            tokenAddress: "0x14ebc5420dd9b643956947fd7d35d73e26335491",
          }),
        ],
      },
    ];

    expect(groupTotalBySymbol(walletBalances)).toEqual({ USDC: 12.5 });
  });

  it("deduplicates Arc native entries even when Circle labels the native token differently", () => {
    const balances = [
      balance("7", undefined, { isNative: true }),
      balance("7.0", "USDC", { tokenAddress: "0x14ebc5420dd9b643956947fd7d35d73e26335491" }),
    ];

    const displayBalances = displayTokenBalances(balances, "ARC-TESTNET");

    expect(displayBalances).toHaveLength(1);
    expect(primaryUsdcBalance(balances, "ARC-TESTNET")?.token.symbol).toBe("USDC");
  });

  it("keeps existing duplicate handling for same-amount native USDC token rows", () => {
    const walletBalances: UnitPayWalletBalanceGroup[] = [
      {
        wallet: {
          id: "base-wallet",
          address: "0x0000000000000000000000000000000000000002",
          blockchain: "BASE-SEPOLIA",
        },
        tokenBalances: [
          balance("3", "USDC", { isNative: true }),
          balance("3", "USDC", { tokenAddress: "0x036cbD53842c5426634e7929541eC2318f3dCF7e" }),
        ],
      },
    ];

    expect(groupTotalBySymbol(walletBalances)).toEqual({ USDC: 3 });
    expect(displayTokenBalances(walletBalances[0].tokenBalances, "BASE-SEPOLIA")).toHaveLength(1);
  });

  it("still sums independent wallet balances across chains", () => {
    const walletBalances: UnitPayWalletBalanceGroup[] = [
      {
        wallet: {
          id: "arc-wallet",
          address: "0x0000000000000000000000000000000000000001",
          blockchain: "ARC-TESTNET",
        },
        tokenBalances: [
          balance("5", "USDC", { isNative: true }),
          balance("5", "USDC", { tokenAddress: "0x14ebc5420dd9b643956947fd7d35d73e26335491" }),
        ],
      },
      {
        wallet: {
          id: "sepolia-wallet",
          address: "0x0000000000000000000000000000000000000003",
          blockchain: "ETH-SEPOLIA",
        },
        tokenBalances: [
          balance("8", "USDC", { tokenAddress: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238" }),
        ],
      },
    ];

    expect(groupTotalBySymbol(walletBalances)).toEqual({ USDC: 13 });
  });

  it("counts Arc only once when Arc is returned as native plus token balance alongside other chains", () => {
    const walletBalances: UnitPayWalletBalanceGroup[] = [
      {
        wallet: {
          id: "arc-wallet",
          address: "0x0000000000000000000000000000000000000001",
          blockchain: "ARC-TESTNET",
        },
        tokenBalances: [
          balance("1", undefined, { isNative: true }),
          balance("1", "USDC", { tokenAddress: "0x14ebc5420dd9b643956947fd7d35d73e26335491" }),
        ],
      },
      {
        wallet: {
          id: "sepolia-wallet",
          address: "0x0000000000000000000000000000000000000002",
          blockchain: "ETH-SEPOLIA",
        },
        tokenBalances: [
          balance("2", "USDC", { tokenAddress: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238" }),
        ],
      },
      {
        wallet: {
          id: "base-wallet",
          address: "0x0000000000000000000000000000000000000003",
          blockchain: "BASE-SEPOLIA",
        },
        tokenBalances: [
          balance("3", "USDC", { tokenAddress: "0x036cbD53842c5426634e7929541eC2318f3dCF7e" }),
        ],
      },
    ];

    expect(groupTotalBySymbol(walletBalances)).toEqual({ USDC: 6 });
  });

  it("uses the highest Arc USDC-like amount if native and token rows drift", () => {
    const balances = [
      balance("1", undefined, { isNative: true }),
      balance("1.02", "USDC", { tokenAddress: "0x14ebc5420dd9b643956947fd7d35d73e26335491" }),
    ];

    expect(primaryUsdcBalance(balances, "ARC-TESTNET")?.amount).toBe("1.02");
  });

  it("formats balances with compact two-decimal precision", () => {
    expect(formatCompactBalance(0)).toBe("0.00");
    expect(formatCompactBalance(1)).toBe("1.00");
    expect(formatCompactBalance(999.999)).toBe("1,000.00");
    expect(formatCompactBalance(1000)).toBe("1k");
    expect(formatCompactBalance(1500)).toBe("1.5k");
    expect(formatCompactBalance(1_250_000)).toBe("1.25m");
    expect(formatCompactBalance(2_000_000_000)).toBe("2b");
  });
});
