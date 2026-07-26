import { describe, expect, it } from "vitest";
import {
  EVM_NATIVE_GAS_DECIMALS,
  SOLANA_NATIVE_GAS_DECIMALS,
  USDC_DECIMALS,
  formatHumanAmount,
  fromBaseUnits,
  nativeGasToBaseUnits,
  toBaseUnits,
  usdcFromBaseUnits,
  usdcToBaseUnits,
} from "./units";

describe("toBaseUnits / fromBaseUnits round-trip", () => {
  it("converts whole USDC amounts (6 decimals)", () => {
    expect(toBaseUnits("5", USDC_DECIMALS)).toBe(5_000000n);
    expect(fromBaseUnits(5_000000n, USDC_DECIMALS)).toBe("5");
  });

  it("converts fractional USDC amounts", () => {
    expect(toBaseUnits("12.5", USDC_DECIMALS)).toBe(12_500000n);
    expect(toBaseUnits("0.000001", USDC_DECIMALS)).toBe(1n);
    expect(fromBaseUnits(12_500000n, USDC_DECIMALS)).toBe("12.5");
    expect(fromBaseUnits(1n, USDC_DECIMALS)).toBe("0.000001");
  });

  it("converts 18-decimal EVM native gas amounts (e.g. ETH/AVAX/MATIC)", () => {
    expect(toBaseUnits("1", EVM_NATIVE_GAS_DECIMALS)).toBe(10n ** 18n);
    expect(toBaseUnits("0.001", EVM_NATIVE_GAS_DECIMALS)).toBe(10n ** 15n);
    expect(fromBaseUnits(10n ** 18n, EVM_NATIVE_GAS_DECIMALS)).toBe("1");
  });

  it("converts 9-decimal Solana native gas amounts (SOL)", () => {
    expect(toBaseUnits("1", SOLANA_NATIVE_GAS_DECIMALS)).toBe(10n ** 9n);
    expect(fromBaseUnits(10n ** 9n, SOLANA_NATIVE_GAS_DECIMALS)).toBe("1");
  });

  it("handles zero", () => {
    expect(toBaseUnits("0", USDC_DECIMALS)).toBe(0n);
    expect(fromBaseUnits(0n, USDC_DECIMALS)).toBe("0");
  });

  it("handles negative amounts", () => {
    expect(toBaseUnits("-2.5", USDC_DECIMALS)).toBe(-2_500000n);
    expect(fromBaseUnits(-2_500000n, USDC_DECIMALS)).toBe("-2.5");
  });

  it("trims trailing zeros on the way out but not the way in", () => {
    expect(toBaseUnits("1.100000", USDC_DECIMALS)).toBe(1_100000n);
    expect(fromBaseUnits(1_100000n, USDC_DECIMALS)).toBe("1.1");
  });

  it("rejects amounts with more precision than the target decimals support", () => {
    // 7 decimal places into a 6-decimal unit must not silently truncate.
    expect(() => toBaseUnits("1.1234567", USDC_DECIMALS)).toThrow(/precision/);
  });

  it("rejects garbage input rather than coercing", () => {
    expect(() => toBaseUnits("abc", USDC_DECIMALS)).toThrow(/Invalid numeric amount/);
    expect(() => toBaseUnits("", USDC_DECIMALS)).toThrow(/Invalid numeric amount/);
    expect(() => toBaseUnits("1.2.3", USDC_DECIMALS)).toThrow(/Invalid numeric amount/);
  });

  it("round-trips a large amount without precision loss", () => {
    const human = "1234567890.123456";
    const base = toBaseUnits(human, USDC_DECIMALS);
    expect(base).toBe(1234567890123456n);
    expect(fromBaseUnits(base, USDC_DECIMALS)).toBe(human);
  });
});

describe("usdcToBaseUnits / usdcFromBaseUnits convenience wrappers", () => {
  it("always use 6 decimals regardless of chain", () => {
    expect(usdcToBaseUnits("10")).toBe(10_000000n);
    expect(usdcFromBaseUnits(10_000000n)).toBe("10");
  });
});

describe("nativeGasToBaseUnits — the Arc-vs-everything-else guard rail", () => {
  it("converts native gas correctly for a normal EVM testnet (18 decimals)", () => {
    // e.g. Ethereum Sepolia / Base Sepolia / Avalanche Fuji
    const result = nativeGasToBaseUnits("0.05", 18, false);
    expect(result).toBe(50_000_000_000_000_000n);
  });

  it("throws if called for Arc, where USDC IS the native gas asset", () => {
    // This is the exact mistake the spec warns about: treating Arc's gas
    // asset as an 18-decimal quantity instead of the 6-decimal USDC pool.
    expect(() => nativeGasToBaseUnits("1", undefined, true)).toThrow(
      /USDC is the native gas asset/,
    );
  });

  it("throws if nativeGasDecimals is missing for a non-Arc chain", () => {
    expect(() => nativeGasToBaseUnits("1", undefined, false)).toThrow(
      /nativeGasDecimals is required/,
    );
  });

  it("never conflates an Arc USDC amount with an 18-decimal native amount", () => {
    // Regression guard: 1 USDC on Arc must equal 1_000000 base units (6dp),
    // not 1e18 base units as an 18-decimal native-gas conversion would give.
    const arcUsdcBaseUnits = usdcToBaseUnits("1");
    const wouldBeWrongIfTreatedAs18Decimals = toBaseUnits("1", 18);
    expect(arcUsdcBaseUnits).toBe(1_000000n);
    expect(arcUsdcBaseUnits).not.toBe(wouldBeWrongIfTreatedAs18Decimals);
  });
});

describe("formatHumanAmount", () => {
  it("formats human-readable balances (as already returned by Circle APIs) to fixed decimals", () => {
    expect(formatHumanAmount("20")).toBe("20.00");
    expect(formatHumanAmount("12.5")).toBe("12.50");
    expect(formatHumanAmount(0)).toBe("0.00");
    expect(formatHumanAmount("3.14159", 4)).toBe("3.1416");
  });

  it("rejects non-numeric input", () => {
    expect(() => formatHumanAmount("not-a-number")).toThrow(/Invalid human-readable amount/);
  });
});
