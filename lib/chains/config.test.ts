import { describe, expect, it } from "vitest";
import { CHAINS, GATEWAY_TESTNET, PRIMARY_CHAIN, listAllChains } from "./config";

const MAINNET_MARKERS = [
  "mainnet",
  "api.circle.com/v1", // mainnet Circle Wallets/Gateway base URL (no "-testnet")
];

describe("chain config — testnet-only invariant", () => {
  it("every configured chain's Gateway API base is the testnet endpoint", () => {
    expect(GATEWAY_TESTNET.apiBaseUrl).toContain("gateway-api-testnet.circle.com");
  });

  it("no chain config or faucet URL references a mainnet identifier", () => {
    for (const chain of listAllChains()) {
      const serialized = JSON.stringify(chain).toLowerCase();
      for (const marker of MAINNET_MARKERS) {
        expect(serialized.includes(marker)).toBe(false);
      }
    }
  });

  it("Arc Testnet is flagged as having USDC as its native gas asset", () => {
    expect(CHAINS.arcTestnet.usdcIsNativeGas).toBe(true);
    expect(CHAINS.arcTestnet.nativeGasDecimals).toBeUndefined();
  });

  it("every non-Arc EVM chain declares a native gas decimals value distinct from USDC's", () => {
    for (const chain of listAllChains()) {
      if (chain.family !== "evm" || chain.usdcIsNativeGas) continue;
      expect(chain.nativeGasDecimals).toBeDefined();
      expect(chain.nativeGasDecimals).not.toBe(6);
    }
  });

  it("Solana Devnet does not have Gateway nanopayments support (per Circle docs)", () => {
    expect(CHAINS.solanaDevnet.nanopayments).toBe(false);
  });

  it("PRIMARY_CHAIN is Arc Testnet", () => {
    expect(PRIMARY_CHAIN.key).toBe("arcTestnet");
  });

  it("every chain has a non-empty usdcAddress and rpcUrl", () => {
    for (const chain of listAllChains()) {
      expect(chain.usdcAddress.length).toBeGreaterThan(0);
      expect(chain.rpcUrl.length).toBeGreaterThan(0);
    }
  });
});
