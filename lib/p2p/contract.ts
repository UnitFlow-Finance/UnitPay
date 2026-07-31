import { createPublicClient, http, keccak256, parseAbi, parseAbiItem, stringToHex, type Address } from "viem";
import { arcTestnet } from "viem/chains";
import { getP2PMarketplaceForChain } from "@/lib/chains/config";
import { rpcUrlForChain } from "@/lib/chains/rpc";

export const P2P_MARKETPLACE_ABI = parseAbi([
  "function createOffer(address asset,uint8 side,uint256 price,uint256 minAmount,uint256 maxAmount,uint256 availableAmount,uint64 paymentWindow,bytes32 metadataHash) returns (uint256 offerId)",
  "function updateOffer(uint256 offerId,uint256 price,uint256 minAmount,uint256 maxAmount,uint256 availableAmount,uint8 status,bytes32 metadataHash)",
  "function cancelOffer(uint256 offerId)",
  "function startTrade(uint256 offerId,uint256 amount) returns (uint256 tradeId)",
  "function markPaid(uint256 tradeId,bytes32 evidenceHash)",
  "function release(uint256 tradeId)",
  "function cancelExpired(uint256 tradeId)",
  "function openDispute(uint256 tradeId,bytes32 evidenceHash)",
  "function resolveDispute(uint256 tradeId,bool releaseToBuyer)",
  "function nextOfferId() view returns (uint256)",
  "function nextTradeId() view returns (uint256)",
  "function offers(uint256) view returns (address merchant,address asset,uint8 side,uint256 price,uint256 minAmount,uint256 maxAmount,uint256 availableAmount,uint64 paymentWindow,bytes32 metadataHash,uint8 status)",
  "function trades(uint256) view returns (uint256 offerId,address buyer,address seller,address asset,uint256 amount,uint256 fiatAmount,uint64 createdAt,uint64 paymentDeadline,bytes32 evidenceHash,uint8 status)",
  "event OfferCreated(uint256 indexed offerId,address indexed merchant,address indexed asset,uint8 side)",
  "event TradeStarted(uint256 indexed tradeId,uint256 indexed offerId,address indexed buyer,address seller,uint256 amount)",
]);

const OFFER_CREATED_EVENT = parseAbiItem(
  "event OfferCreated(uint256 indexed offerId,address indexed merchant,address indexed asset,uint8 side)",
);

const TRADE_STARTED_EVENT = parseAbiItem(
  "event TradeStarted(uint256 indexed tradeId,uint256 indexed offerId,address indexed buyer,address seller,uint256 amount)",
);

export const P2P_OFFER_SIDE_ONCHAIN = {
  buy: 0,
  sell: 1,
} as const;

export function p2pMetadataHash(input: unknown): `0x${string}` {
  return keccak256(stringToHex(JSON.stringify(input)));
}

export function p2pEvidenceHash(input: string): `0x${string}` {
  return input.trim() ? keccak256(stringToHex(input.trim())) : `0x${"0".repeat(64)}`;
}

export function getP2PPublicClient(chainKey: string) {
  if (chainKey !== "arcTestnet") {
    throw new Error("P2P reads are currently wired for Arc Testnet. Add a viem chain mapping before enabling this chain.");
  }
  return createPublicClient({
    chain: arcTestnet,
    transport: http(rpcUrlForChain(chainKey)),
  });
}

export async function findP2POfferIdByMetadataHash({
  chainKey,
  merchant,
  metadataHash,
  maxWindows = 5,
  windowSize = 200n,
}: {
  chainKey: string;
  merchant: Address;
  metadataHash: `0x${string}`;
  maxWindows?: number;
  windowSize?: bigint;
}): Promise<bigint | null> {
  const deployment = getP2PMarketplaceForChain(chainKey);
  const client = getP2PPublicClient(chainKey);
  let toBlock = await client.getBlockNumber();
  const floor = deployment.deployBlock ?? 0n;
  for (let i = 0; i < maxWindows; i += 1) {
    const fromBlock = toBlock - windowSize + 1n > floor ? toBlock - windowSize + 1n : floor;
    const logs = await client.getLogs({
      address: deployment.address,
      event: OFFER_CREATED_EVENT,
      args: { merchant },
      fromBlock,
      toBlock,
    });
    const matches = await Promise.all(
      logs.map(async (log) => {
        const offerId = log.args.offerId;
        if (offerId === undefined) return null;
        const offer = await client.readContract({
          address: deployment.address,
          abi: P2P_MARKETPLACE_ABI,
          functionName: "offers",
          args: [offerId],
        });
        return offer[8] === metadataHash ? offerId : null;
      }),
    );
    const match = matches.find((entry): entry is bigint => entry !== null);
    if (match !== undefined) return match;
    if (fromBlock <= floor) break;
    toBlock = fromBlock - 1n;
  }
  return null;
}

export async function findP2PTradeId({
  chainKey,
  offerId,
  buyer,
  seller,
  amountBaseUnits,
  maxWindows = 5,
  windowSize = 200n,
}: {
  chainKey: string;
  offerId: bigint;
  buyer: Address;
  seller: Address;
  amountBaseUnits: bigint;
  maxWindows?: number;
  windowSize?: bigint;
}): Promise<bigint | null> {
  const deployment = getP2PMarketplaceForChain(chainKey);
  const client = getP2PPublicClient(chainKey);
  let toBlock = await client.getBlockNumber();
  const floor = deployment.deployBlock ?? 0n;
  for (let i = 0; i < maxWindows; i += 1) {
    const fromBlock = toBlock - windowSize + 1n > floor ? toBlock - windowSize + 1n : floor;
    const logs = await client.getLogs({
      address: deployment.address,
      event: TRADE_STARTED_EVENT,
      args: { offerId, buyer },
      fromBlock,
      toBlock,
    });
    const match = logs
      .filter((log) => log.args.seller?.toLowerCase() === seller.toLowerCase())
      .filter((log) => log.args.amount === amountBaseUnits)
      .sort((a, b) => Number(b.blockNumber - a.blockNumber))[0];
    if (match?.args.tradeId !== undefined) return match.args.tradeId;
    if (fromBlock <= floor) break;
    toBlock = fromBlock - 1n;
  }
  return null;
}

export async function waitForP2PTradeId(
  input: Parameters<typeof findP2PTradeId>[0] & {
    attempts?: number;
    intervalMs?: number;
  },
): Promise<bigint | null> {
  const attempts = input.attempts ?? 20;
  const intervalMs = input.intervalMs ?? 3_000;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const match = await findP2PTradeId(input);
    if (match !== null) return match;
    if (attempt < attempts - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
    }
  }
  return null;
}
