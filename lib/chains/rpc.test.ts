import { afterEach, describe, expect, it } from "vitest";
import { getChain } from "./config";
import { rpcEnvVarName, rpcUrlForChain } from "./rpc";

describe("chain RPC overrides", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("builds stable per-chain env var names", () => {
    expect(rpcEnvVarName("arcTestnet")).toBe("UNITPAY_RPC_URL_ARC_TESTNET");
    expect(rpcEnvVarName("ethereumSepolia")).toBe("UNITPAY_RPC_URL_ETHEREUM_SEPOLIA");
    expect(rpcEnvVarName("solanaDevnet")).toBe("UNITPAY_RPC_URL_SOLANA_DEVNET");
  });

  it("uses the env override when configured", () => {
    process.env.UNITPAY_RPC_URL_ARC_TESTNET = "https://rpc.example.test/arc";
    expect(rpcUrlForChain("arcTestnet")).toBe("https://rpc.example.test/arc");
  });

  it("falls back to the configured public RPC when unset or blank", () => {
    delete process.env.UNITPAY_RPC_URL_ARC_TESTNET;
    expect(rpcUrlForChain("arcTestnet")).toBe(getChain("arcTestnet").rpcUrl);

    process.env.UNITPAY_RPC_URL_ARC_TESTNET = "   ";
    expect(rpcUrlForChain("arcTestnet")).toBe(getChain("arcTestnet").rpcUrl);
  });
});
