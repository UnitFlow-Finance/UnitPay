/**
 * Unit conversion utilities for USDC / native-gas amounts.
 *
 * THIS FILE EXISTS BECAUSE GETTING DECIMALS WRONG SILENTLY CORRUPTS AMOUNTS.
 *
 * Ground truth (verified against Circle's docs, see lib/chains/config.ts header):
 *   - USDC (ERC-20 / SPL) always uses 6 decimals, on every chain, everywhere.
 *   - On Arc Testnet, there is NO separate native gas token — USDC IS the
 *     native gas asset, and it still uses 6 decimals for gas math. Do not
 *     apply an 18-decimal conversion to any Arc amount, gas or otherwise.
 *   - On every other EVM testnet in this app (Sepolia, Fuji, Base Sepolia,
 *     Arbitrum Sepolia, OP Sepolia, Polygon Amoy, Unichain Sepolia, Sonic
 *     Testnet, World Chain Sepolia, Sei Atlantic, HyperEVM Testnet), the
 *     native gas token (ETH, AVAX, MATIC, ...) is a SEPARATE asset from USDC
 *     and uses the conventional 18 decimals.
 *   - Solana Devnet's native gas token (SOL) uses 9 decimals; its USDC SPL
 *     mint still uses 6 decimals.
 *
 * All amounts that cross an API/contract boundary should flow through these
 * helpers rather than ad-hoc string/BigInt math.
 */

export const USDC_DECIMALS = 6;
export const EVM_NATIVE_GAS_DECIMALS = 18;
export const SOLANA_NATIVE_GAS_DECIMALS = 9;

/**
 * Converts a human-readable decimal amount string (e.g. "12.5") into the
 * smallest integer unit for the given number of decimals, as a BigInt.
 *
 * Deliberately string-based (no floating point) to avoid precision loss on
 * amounts with many decimal places.
 */
export function toBaseUnits(amount: string | number, decimals: number): bigint {
  if (decimals < 0 || !Number.isInteger(decimals)) {
    throw new Error(`Invalid decimals: ${decimals}`);
  }

  const str = String(amount).trim();
  if (str === "" || !/^-?\d*\.?\d*$/.test(str) || str === "-" || str === ".") {
    throw new Error(`Invalid numeric amount: "${amount}"`);
  }

  const negative = str.startsWith("-");
  const unsigned = negative ? str.slice(1) : str;
  const [wholeRaw, fracRaw = ""] = unsigned.split(".");
  const whole = wholeRaw === "" ? "0" : wholeRaw;

  if (fracRaw.length > decimals) {
    throw new Error(
      `Amount "${amount}" has more precision (${fracRaw.length} decimal places) ` +
        `than the target unit supports (${decimals}). Refusing to silently truncate.`,
    );
  }

  const fracPadded = fracRaw.padEnd(decimals, "0");
  const combined = `${whole}${fracPadded}`.replace(/^0+(?=\d)/, "");
  const value = BigInt(combined === "" ? "0" : combined);

  return negative ? -value : value;
}

/**
 * Converts an integer amount in base units (as a BigInt or numeric string)
 * back into a human-readable decimal string for the given number of decimals.
 * Trailing zeros in the fractional part are trimmed; an integer amount is
 * returned without a trailing decimal point.
 */
export function fromBaseUnits(amount: bigint | string, decimals: number): string {
  if (decimals < 0 || !Number.isInteger(decimals)) {
    throw new Error(`Invalid decimals: ${decimals}`);
  }

  const value = typeof amount === "bigint" ? amount : BigInt(amount);
  const negative = value < 0n;
  const abs = negative ? -value : value;

  const str = abs.toString().padStart(decimals + 1, "0");
  const whole = str.slice(0, str.length - decimals) || "0";
  const frac = decimals === 0 ? "" : str.slice(str.length - decimals);
  const fracTrimmed = frac.replace(/0+$/, "");

  const result = fracTrimmed ? `${whole}.${fracTrimmed}` : whole;
  return negative && value !== 0n ? `-${result}` : result;
}

/** Convenience: human USDC amount -> base units (always 6 decimals). */
export function usdcToBaseUnits(amount: string | number): bigint {
  return toBaseUnits(amount, USDC_DECIMALS);
}

/** Convenience: base units -> human USDC amount string (always 6 decimals). */
export function usdcFromBaseUnits(amount: bigint | string): string {
  return fromBaseUnits(amount, USDC_DECIMALS);
}

/**
 * Converts a human-readable native-gas amount to base units for the given
 * chain's native gas decimals. Callers MUST pass the correct decimals for
 * the target chain — use `chain.nativeGasDecimals`, and never assume 18.
 *
 * Throws if called for a chain where USDC is the native gas asset (Arc) —
 * callers should use `usdcToBaseUnits` there instead, since gas and USDC
 * are the same 6-decimal pool of funds on that chain.
 */
export function nativeGasToBaseUnits(
  amount: string | number,
  nativeGasDecimals: number | undefined,
  usdcIsNativeGas: boolean,
): bigint {
  if (usdcIsNativeGas) {
    throw new Error(
      "This chain has no separate native gas token — USDC is the native gas " +
        "asset. Use usdcToBaseUnits() instead of nativeGasToBaseUnits().",
    );
  }
  if (nativeGasDecimals === undefined) {
    throw new Error(
      "nativeGasDecimals is required for chains where usdcIsNativeGas is false.",
    );
  }
  return toBaseUnits(amount, nativeGasDecimals);
}

/**
 * Formats a raw balance string as returned by Circle Wallets APIs.
 * Circle's `getWalletTokenBalance` / `getTokenBalance` endpoints already
 * return HUMAN-READABLE amounts (e.g. "20" for 20 USDC), NOT base units.
 * Do not run these through toBaseUnits/fromBaseUnits again — this helper
 * exists only to normalize display formatting (fixed decimal places).
 */
export function formatHumanAmount(amount: string | number, displayDecimals = 2): string {
  const num = typeof amount === "number" ? amount : Number(amount);
  if (Number.isNaN(num)) {
    throw new Error(`Invalid human-readable amount: "${amount}"`);
  }
  return num.toFixed(displayDecimals);
}
