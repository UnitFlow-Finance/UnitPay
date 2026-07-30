import { CHAINS, listEvmChains } from "@/lib/chains/config";

export type SupportedAssetSymbol = "USDC" | "EURC" | "CIRBTC";

export interface SupportedToken {
  id: string;
  chainKey: string;
  chainLabel: string;
  name: string;
  symbol: SupportedAssetSymbol | string;
  decimals: number;
  contractAddress: string;
  logoUrl?: string;
  defaultAsset: boolean;
}

export interface CustomTokenInput {
  chainKey: string;
  contractAddress: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  logoUrl?: string;
}

export const DEFAULT_ASSETS: SupportedAssetSymbol[] = ["USDC", "EURC", "CIRBTC"];

export function defaultSupportedTokens(): SupportedToken[] {
  return listEvmChains().flatMap((chain) =>
    DEFAULT_ASSETS.map((symbol) => ({
      id: `${chain.key}:${symbol}`,
      chainKey: chain.key,
      chainLabel: chain.label,
      name:
        symbol === "USDC"
          ? "USD Coin"
          : symbol === "EURC"
            ? "Euro Coin"
            : "Circle Bitcoin",
      symbol,
      decimals: symbol === "CIRBTC" ? 8 : 6,
      contractAddress: symbol === "USDC" ? chain.usdcAddress : "",
      defaultAsset: true,
    })),
  );
}

export function normalizeCustomToken(input: CustomTokenInput): SupportedToken {
  const chain = CHAINS[input.chainKey];
  if (!chain) throw new Error("Unsupported chain.");
  const address = input.contractAddress.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error("Enter a valid ERC-20 contract address.");
  }
  return {
    id: `${chain.key}:${address.toLowerCase()}`,
    chainKey: chain.key,
    chainLabel: chain.label,
    name: input.name?.trim() || "Custom ERC-20 Token",
    symbol: input.symbol?.trim().toUpperCase() || "TOKEN",
    decimals: input.decimals ?? 18,
    contractAddress: address,
    logoUrl: input.logoUrl?.trim() || undefined,
    defaultAsset: false,
  };
}
