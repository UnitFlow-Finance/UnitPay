/**
 * UnitPay chain configuration — TESTNET ONLY.
 *
 * Source of truth for all values below: Circle's live developer docs, verified
 * at build time (2026-07-06) from:
 *   - https://developers.circle.com/gateway/references/supported-blockchains
 *   - https://developers.circle.com/gateway/quickstarts/unified-balance-evm
 *   - Circle Gateway skill (circlefin/skills: use-gateway)
 *
 * Do NOT hand-edit chain IDs / contract addresses from memory or guesswork.
 * Circle's docs (or the Circle MCP server) are the only authoritative source —
 * these values can and do change. Re-verify before every release.
 *
 * IMPORTANT — decimals:
 *   - Arc Testnet has NO separate native gas token. USDC itself is the native
 *     gas asset there, and it uses ERC-20-style 6 decimals for BOTH gas and
 *     value transfer. There is no 18-decimal quantity anywhere on Arc.
 *   - Every other EVM testnet in this list (Sepolia, Fuji, Base Sepolia, etc.)
 *     has a conventional 18-decimal native gas token (ETH, AVAX, MATIC, ...)
 *     that is completely separate from its 6-decimal USDC ERC-20 balance.
 *   - Solana Devnet uses 9-decimal SOL for fees and a 6-decimal SPL USDC mint.
 *   - See lib/units.ts for the conversion utility and its tests — never do
 *     ad-hoc decimal math when handling amounts.
 */

export type ChainFamily = "evm" | "solana";

export interface UnitPayChainConfig {
  /** Internal stable key used across the app (not necessarily the Circle name). */
  key: string;
  /** Human-readable label for UI. */
  label: string;
  /** Circle Gateway `SupportedChainName` value, where applicable. */
  gatewayChainName?: string;
  /**
   * `@circle-fin/unified-balance-kit`'s `UnifiedBalanceChain` enum value for
   * this chain. Used for the App Kit unified-balance reads/allocation on
   * /wallet/unified — kept separate from `gatewayChainName` since the kit
   * uses its own naming (e.g. "Arc_Testnet" vs our "arcTestnet").
   */
  unifiedBalanceChain: string;
  /** Circle Wallets `Blockchain` enum value (used for wallet creation / tx APIs). */
  circleBlockchain: string;
  /** Gateway/CCTP numeric domain ID (NOT the same as the chain's public chain ID). */
  domain: number;
  /** Public EVM chain ID. Not applicable to Solana. */
  evmChainId?: number;
  family: ChainFamily;
  /** USDC contract/mint address on this chain. */
  usdcAddress: string;
  /** True if USDC is itself the native gas asset on this chain (Arc only, currently). */
  usdcIsNativeGas: boolean;
  /** Decimals of the native gas asset (18 for typical EVM, 9 for Solana). Omitted when usdcIsNativeGas is true. */
  nativeGasDecimals?: number;
  /** Public RPC URL. */
  rpcUrl: string;
  /** Public testnet faucet for native gas / USDC. */
  faucetUrl: string;
  /** Whether Gateway Nanopayments are supported on this chain. */
  nanopayments: boolean;
  /** Block explorer, if known. */
  explorerUrl?: string;
}

/** Gateway contract addresses — identical across all supported EVM testnets. */
export const GATEWAY_TESTNET = {
  apiBaseUrl: "https://gateway-api-testnet.circle.com/v1",
  walletAddress: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9",
  minterAddress: "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B",
} as const;

export const GATEWAY_SOLANA_DEVNET = {
  walletAddress: "GATEwdfmYNELfp5wDmmR6noSr2vHnAfBPMm2PvCzX5vu",
  minterAddress: "GATEmKK2ECL1brEngQZWCgMWPbvrEYqsV6u29dAaHavr",
} as const;

/**
 * UnitPayTransfer.sol on Arc Testnet — used here for its `batchTransfer`
 * function (multi-receiver payment links: one payer approval + one
 * transaction fans a single payment out to several receivers atomically).
 * See contracts-workspace/deployments.arcTestnet.json.
 */
export const TRANSFER_ARC_TESTNET = {
  address: "0xA666E45cb863C1eB541E5EB5918af61BaEF30faC",
} as const;

/**
 * UnitPayEscrow.sol, deployed to Arc Testnet via a plain Hardhat deploy
 * (contracts-workspace/scripts/redeploy-standalone.js), redeployed on
 * 2026-07-09 after a security-audit pass (self-dealing arbiter guard,
 * dispute-timeout fallback, self-address-payee guard — see
 * contracts-workspace/README.md). Unproxied: this address will change
 * again if the contract's source ever needs to change in the future,
 * since it has no upgrade mechanism. See
 * contracts-workspace/deployments.arcTestnet.json for the full deployment
 * record, including the superseded pre-audit address.
 */
export const ESCROW_ARC_TESTNET = {
  address: "0xeDb41960251D3d377372b877752b67C0A8Ca851A",
  /**
   * Block the current contract was deployed at (tx
   * 0x93a9681daeb915ae81648cd5814ed0faae09dbbabe590a9a3116d808c65abaf6).
   * Used as the floor for backward-scanning `getLogs` pagination so scans
   * terminate here instead of walking all the way to genesis.
   */
  deployBlock: 50_951_986n,
} as const;

/**
 * UnitPayPacket.sol ("Unit Packet" — WeChat-hongbao-style USDC giveaway),
 * deployed to Arc Testnet the same way as ESCROW_ARC_TESTNET above,
 * redeployed 2026-07-09 with the wrapper-contract reroll guard on claim()
 * (msg.sender == tx.origin — see contracts-workspace/README.md).
 */
export const PACKET_ARC_TESTNET = {
  address: "0xd35E1ef94a7B70D04A798537d3bcE9677DC638d4",
  /**
   * Block the current contract was deployed at (tx
   * 0x5765cbb41e33e815da8b2f1e7b8cb01ecb45802d38c77b57e3c6033a391fc93d).
   * Used as the floor for backward-scanning `getLogs` pagination so scans
   * terminate here instead of walking all the way to genesis.
   */
  deployBlock: 50_951_998n,
} as const;

/**
 * UnitPayMetadataRegistry.sol, deployed to Arc Testnet as the durable on-chain
 * metadata store for pods, P2P records, custom tokens, arbitrator rules,
 * virtual cards, and collaborative payment-link pod metadata. Writes are made
 * by a configured server-side relayer key; reads are public chain reads.
 */
export const METADATA_REGISTRY_ARC_TESTNET = {
  address: "0x100012Cd3BFBd6af56dAd2E0a874001f1De5038e",
} as const;

/**
 * UnitPayP2PMarketplace.sol, the real-funds P2P escrow contract. Arc Testnet
 * is the first live deployment; add per-chain deployments here as the same
 * contract is rolled out to additional EVM testnets.
 */
export const P2P_MARKETPLACE_BY_CHAIN: Record<string, { address: `0x${string}`; deployBlock?: bigint }> = {
  arcTestnet: {
    address: "0x14EBC5420dd9B643956947Fd7d35d73E26335491",
    deployBlock: 54_603_185n,
  },
} as const;

export function getP2PMarketplaceForChain(chainKey: string): { address: `0x${string}`; deployBlock?: bigint } {
  const deployment = P2P_MARKETPLACE_BY_CHAIN[chainKey];
  if (!deployment || deployment.address === "0x0000000000000000000000000000000000000000") {
    throw new Error(`P2P marketplace is not deployed for ${chainKey}.`);
  }
  return deployment;
}

/**
 * All chains this build supports, keyed by internal `key`.
 * Arc Testnet is the default/primary chain per the product spec.
 */
export const CHAINS: Record<string, UnitPayChainConfig> = {
  arcTestnet: {
    key: "arcTestnet",
    label: "Arc Testnet",
    gatewayChainName: "arcTestnet",
    unifiedBalanceChain: "Arc_Testnet",
    circleBlockchain: "ARC-TESTNET",
    domain: 26,
    evmChainId: 5042002, // Verified against UnitFlow-Finance's own hardhat.config.js (arcTestnet network entry).
    family: "evm",
    usdcAddress: "0x3600000000000000000000000000000000000000",
    usdcIsNativeGas: true,
    rpcUrl: "https://arc-testnet.g.alchemy.com/v2/o1k50yOLGXHrczBA8KDOf",
    faucetUrl: "https://faucet.circle.com",
    nanopayments: true,
    explorerUrl: "https://testnet.arcscan.app",
  },
  ethereumSepolia: {
    key: "ethereumSepolia",
    label: "Ethereum Sepolia",
    gatewayChainName: "sepolia",
    unifiedBalanceChain: "Ethereum_Sepolia",
    circleBlockchain: "ETH-SEPOLIA",
    domain: 0,
    evmChainId: 11155111,
    family: "evm",
    usdcAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    usdcIsNativeGas: false,
    nativeGasDecimals: 18,
    rpcUrl: "https://rpc.sepolia.org",
    faucetUrl: "https://faucet.circle.com",
    nanopayments: true,
    explorerUrl: "https://sepolia.etherscan.io",
  },
  avalancheFuji: {
    key: "avalancheFuji",
    label: "Avalanche Fuji",
    gatewayChainName: "avalancheFuji",
    unifiedBalanceChain: "Avalanche_Fuji",
    circleBlockchain: "AVAX-FUJI",
    domain: 1,
    evmChainId: 43113,
    family: "evm",
    usdcAddress: "0x5425890298aed601595a70AB815c96711a31Bc65",
    usdcIsNativeGas: false,
    nativeGasDecimals: 18,
    rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
    faucetUrl: "https://core.app/tools/testnet-faucet",
    nanopayments: true,
    explorerUrl: "https://testnet.snowtrace.io",
  },
  optimismSepolia: {
    key: "optimismSepolia",
    label: "OP Sepolia",
    gatewayChainName: "optimismSepolia",
    unifiedBalanceChain: "Optimism_Sepolia",
    circleBlockchain: "OP-SEPOLIA",
    domain: 2,
    evmChainId: 11155420,
    family: "evm",
    usdcAddress: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
    usdcIsNativeGas: false,
    nativeGasDecimals: 18,
    rpcUrl: "https://sepolia.optimism.io",
    faucetUrl: "https://console.circle.com/faucet",
    nanopayments: true,
    explorerUrl: "https://sepolia-optimism.etherscan.io",
  },
  arbitrumSepolia: {
    key: "arbitrumSepolia",
    label: "Arbitrum Sepolia",
    gatewayChainName: "arbitrumSepolia",
    unifiedBalanceChain: "Arbitrum_Sepolia",
    circleBlockchain: "ARB-SEPOLIA",
    domain: 3,
    evmChainId: 421614,
    family: "evm",
    usdcAddress: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    usdcIsNativeGas: false,
    nativeGasDecimals: 18,
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    faucetUrl: "https://console.circle.com/faucet",
    nanopayments: true,
    explorerUrl: "https://sepolia.arbiscan.io",
  },
  baseSepolia: {
    key: "baseSepolia",
    label: "Base Sepolia",
    gatewayChainName: "baseSepolia",
    unifiedBalanceChain: "Base_Sepolia",
    circleBlockchain: "BASE-SEPOLIA",
    domain: 6,
    evmChainId: 84532,
    family: "evm",
    usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    usdcIsNativeGas: false,
    nativeGasDecimals: 18,
    rpcUrl: "https://sepolia.base.org",
    faucetUrl: "https://www.alchemy.com/faucets/base-sepolia",
    nanopayments: true,
    explorerUrl: "https://sepolia.basescan.org",
  },
  polygonAmoy: {
    key: "polygonAmoy",
    label: "Polygon Amoy",
    gatewayChainName: "polygonAmoy",
    unifiedBalanceChain: "Polygon_Amoy_Testnet",
    circleBlockchain: "MATIC-AMOY",
    domain: 7,
    evmChainId: 80002,
    family: "evm",
    usdcAddress: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
    usdcIsNativeGas: false,
    nativeGasDecimals: 18,
    rpcUrl: "https://rpc-amoy.polygon.technology",
    faucetUrl: "https://console.circle.com/faucet",
    nanopayments: true,
    explorerUrl: "https://amoy.polygonscan.com",
  },
  unichainSepolia: {
    key: "unichainSepolia",
    label: "Unichain Sepolia",
    gatewayChainName: "unichainSepolia",
    unifiedBalanceChain: "Unichain_Sepolia",
    circleBlockchain: "UNI-SEPOLIA",
    domain: 10,
    evmChainId: 1301,
    family: "evm",
    usdcAddress: "0x31d0220469e10c4E71834a79b1f276d740d3768F",
    usdcIsNativeGas: false,
    nativeGasDecimals: 18,
    rpcUrl: "https://sepolia.unichain.org",
    faucetUrl: "https://console.circle.com/faucet",
    nanopayments: true,
  },
  sonicTestnet: {
    key: "sonicTestnet",
    label: "Sonic Testnet",
    gatewayChainName: "sonicTestnet",
    unifiedBalanceChain: "Sonic_Testnet",
    circleBlockchain: "EVM-TESTNET",
    domain: 13,
    family: "evm",
    usdcAddress: "0x0BA304580ee7c9a980CF72e55f5Ed2E9fd30Bc51",
    usdcIsNativeGas: false,
    nativeGasDecimals: 18,
    rpcUrl: "https://rpc.testnet.soniclabs.com",
    faucetUrl: "https://testnet.soniclabs.com/account",
    nanopayments: true,
  },
  worldChainSepolia: {
    key: "worldChainSepolia",
    label: "World Chain Sepolia",
    gatewayChainName: "worldChainSepolia",
    unifiedBalanceChain: "World_Chain_Sepolia",
    circleBlockchain: "EVM-TESTNET",
    domain: 14,
    evmChainId: 4801,
    family: "evm",
    usdcAddress: "0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88",
    usdcIsNativeGas: false,
    nativeGasDecimals: 18,
    rpcUrl: "https://worldchain-sepolia.g.alchemy.com/public",
    faucetUrl: "https://www.l2faucet.com/world",
    nanopayments: true,
  },
  seiAtlantic: {
    key: "seiAtlantic",
    label: "Sei Atlantic",
    gatewayChainName: "seiAtlantic",
    unifiedBalanceChain: "Sei_Testnet",
    circleBlockchain: "EVM-TESTNET",
    domain: 16,
    family: "evm",
    usdcAddress: "0x4fCF1784B31630811181f670Aea7A7bEF803eaED",
    usdcIsNativeGas: false,
    nativeGasDecimals: 18,
    rpcUrl: "https://evm-rpc-testnet.sei-apis.com",
    faucetUrl: "https://docs.sei.io/learn/faucet",
    nanopayments: true,
  },
  hyperEvmTestnet: {
    key: "hyperEvmTestnet",
    label: "HyperEVM Testnet",
    gatewayChainName: "hyperEvmTestnet",
    unifiedBalanceChain: "HyperEVM_Testnet",
    circleBlockchain: "EVM-TESTNET",
    domain: 19,
    family: "evm",
    usdcAddress: "0x2B3370eE501B4a559b57D449569354196457D8Ab",
    usdcIsNativeGas: false,
    nativeGasDecimals: 18,
    rpcUrl: "https://rpc.hyperliquid-testnet.xyz/evm",
    faucetUrl: "https://app.hyperliquid-testnet.xyz/drip",
    nanopayments: true,
  },
  solanaDevnet: {
    key: "solanaDevnet",
    label: "Solana Devnet",
    unifiedBalanceChain: "Solana_Devnet",
    circleBlockchain: "SOL-DEVNET",
    domain: 5,
    family: "solana",
    usdcAddress: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    usdcIsNativeGas: false,
    nativeGasDecimals: 9,
    rpcUrl: "https://api.devnet.solana.com",
    faucetUrl: "https://faucet.solana.com",
    nanopayments: false,
  },
};

/** Chains actually surfaced in the v1 chain-selector UI (curated shortlist). */
export const DEFAULT_SELECTOR_CHAINS = [
  "arcTestnet",
  "ethereumSepolia",
  "baseSepolia",
  "avalancheFuji",
  "arbitrumSepolia",
  "optimismSepolia",
  "polygonAmoy",
  "solanaDevnet",
] as const;

export const PRIMARY_CHAIN = CHAINS.arcTestnet;

export function getChain(key: string): UnitPayChainConfig {
  const chain = CHAINS[key];
  if (!chain) {
    throw new Error(`Unknown chain key: ${key}`);
  }
  return chain;
}

export function listEvmChains(): UnitPayChainConfig[] {
  return Object.values(CHAINS).filter((c) => c.family === "evm");
}

export function listAllChains(): UnitPayChainConfig[] {
  return Object.values(CHAINS);
}

/**
 * Solana Gateway wallet compatibility.
 * Per Circle's own guidance: only Solflare currently supports the arbitrary
 * message signing Gateway needs for burn intents. Phantom and most others
 * will reject it. Surface this explicitly in any Solana-path UI.
 */
export const SOLANA_GATEWAY_WALLET_COMPAT_WARNING =
  "Solana Gateway transfers require a wallet that supports arbitrary message signing. " +
  "Currently only Solflare is known to support this. Phantom and most other Solana " +
  "wallets will reject the signing request required for Gateway burn intents.";

export const SOLANA_GATEWAY_SUPPORTED_WALLETS = ["Solflare"] as const;
