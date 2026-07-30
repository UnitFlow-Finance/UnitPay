/**
 * Client-side read access to UnitPayPacket.sol on Arc Testnet — same "no
 * database, read chain state directly" pattern as lib/escrow/contract.ts.
 */
import { createPublicClient, http, parseAbi, parseAbiItem, type Address } from "viem";
import { arcTestnet } from "viem/chains";
import { PACKET_ARC_TESTNET } from "@/lib/chains/config";
import { rpcUrlForChain } from "@/lib/chains/rpc";

export const PACKET_ABI = parseAbi([
  "function createPacket(uint32 maxClaims, uint256 totalAmount, uint8 splitMode, uint64 expiresIn) returns (uint256 packetId)",
  "function claim(uint256 packetId) returns (uint256 amount)",
  "function reclaim(uint256 packetId)",
  "function remainingClaims(uint256 packetId) view returns (uint32)",
  "function isExpired(uint256 packetId) view returns (bool)",
  "function nextPacketId() view returns (uint256)",
  "function hasClaimed(uint256, address) view returns (bool)",
  "function packets(uint256) view returns (address creator, uint256 totalAmount, uint256 remainingAmount, uint32 maxClaims, uint32 claimsMade, uint8 splitMode, uint64 createdAt, uint64 expiresAt, bool reclaimed)",
  "event PacketCreated(uint256 indexed packetId, address indexed creator, uint256 totalAmount, uint32 maxClaims, uint8 splitMode, uint64 expiresAt)",
  "event PacketClaimed(uint256 indexed packetId, address indexed claimer, uint256 amount, uint32 claimsMade)",
  "event PacketReclaimed(uint256 indexed packetId, uint256 amount)",
]);

const PACKET_CREATED_EVENT = parseAbiItem(
  "event PacketCreated(uint256 indexed packetId, address indexed creator, uint256 totalAmount, uint32 maxClaims, uint8 splitMode, uint64 expiresAt)",
);
const PACKET_CLAIMED_EVENT = parseAbiItem(
  "event PacketClaimed(uint256 indexed packetId, address indexed claimer, uint256 amount, uint32 claimsMade)",
);

export const SPLIT_MODES = ["Equal", "Random"] as const;
export type SplitModeLabel = (typeof SPLIT_MODES)[number];

export interface PacketRecord {
  id: bigint;
  creator: Address;
  totalAmount: bigint;
  remainingAmount: bigint;
  maxClaims: number;
  claimsMade: number;
  splitMode: SplitModeLabel;
  createdAt: bigint;
  expiresAt: bigint;
  reclaimed: boolean;
}

export interface PacketClaimRecord {
  claimer: Address;
  amount: bigint;
  claimsMade: number;
}

let cachedClient: ReturnType<typeof createPublicClient> | null = null;

export function getPacketPublicClient() {
  if (!cachedClient) {
    cachedClient = createPublicClient({
      chain: arcTestnet,
      transport: http(rpcUrlForChain("arcTestnet")),
    });
  }
  return cachedClient;
}

export async function readPacket(packetId: bigint): Promise<PacketRecord> {
  const client = getPacketPublicClient();
  const [creator, totalAmount, remainingAmount, maxClaims, claimsMade, splitMode, createdAt, expiresAt, reclaimed] =
    await client.readContract({
      address: PACKET_ARC_TESTNET.address,
      abi: PACKET_ABI,
      functionName: "packets",
      args: [packetId],
    });

  return {
    id: packetId,
    creator,
    totalAmount,
    remainingAmount,
    maxClaims,
    claimsMade,
    splitMode: SPLIT_MODES[splitMode] ?? "Equal",
    createdAt,
    expiresAt,
    reclaimed,
  };
}

export async function readHasClaimed(packetId: bigint, address: Address): Promise<boolean> {
  const client = getPacketPublicClient();
  return client.readContract({
    address: PACKET_ARC_TESTNET.address,
    abi: PACKET_ABI,
    functionName: "hasClaimed",
    args: [packetId, address],
  });
}

/**
 * Default block window per `getLogs` call. Kept comfortably under the
 * common public-RPC cap of 10,000 blocks per request (Arc Testnet's own
 * RPC enforces exactly that limit — see the "eth_getLogs is limited to a
 * 10,000 range" error this constant exists to avoid).
 */
const LOG_BLOCK_WINDOW = 9_000n;

/**
 * All PacketClaimed events for a packet, oldest first — used to render
 * "who claimed what". Chunked into `LOG_BLOCK_WINDOW`-sized windows from
 * the contract's deploy block to chain head, since a single unbounded
 * `getLogs` call exceeds the RPC's 10,000-block-range limit.
 */
export async function readPacketClaims(packetId: bigint): Promise<PacketClaimRecord[]> {
  const client = getPacketPublicClient();
  const deployBlock = PACKET_ARC_TESTNET.deployBlock;
  const latestBlock = await client.getBlockNumber();

  const windows: { fromBlock: bigint; toBlock: bigint }[] = [];
  let fromBlock = deployBlock;
  while (fromBlock <= latestBlock) {
    const toBlock =
      fromBlock + LOG_BLOCK_WINDOW - 1n < latestBlock ? fromBlock + LOG_BLOCK_WINDOW - 1n : latestBlock;
    windows.push({ fromBlock, toBlock });
    fromBlock = toBlock + 1n;
  }

  const chunks = await Promise.all(
    windows.map(({ fromBlock, toBlock }) =>
      client.getLogs({
        address: PACKET_ARC_TESTNET.address,
        event: PACKET_CLAIMED_EVENT,
        args: { packetId },
        fromBlock,
        toBlock,
      }),
    ),
  );

  return chunks
    .flat()
    .filter((log) => log.args.claimer !== undefined && log.args.amount !== undefined)
    .map((log) => ({
      claimer: log.args.claimer as Address,
      amount: log.args.amount as bigint,
      claimsMade: log.args.claimsMade ?? 0,
    }));
}

const MAX_WINDOWS_PER_PAGE = 20;

export interface PacketListPage {
  packets: PacketRecord[];
  nextBeforeBlock?: bigint;
}

/**
 * Finds packets created by `address`, paginated backwards from
 * `beforeBlock` (or the current chain head) in fixed-size block windows —
 * same approach as lib/escrow/contract.ts's listEscrowsForAddress.
 */
export async function listPacketsForCreator(
  address: Address,
  { pageSize = 10, beforeBlock }: { pageSize?: number; beforeBlock?: bigint } = {},
): Promise<PacketListPage> {
  const client = getPacketPublicClient();
  const latestBlock = beforeBlock ?? (await client.getBlockNumber());
  const deployBlock = PACKET_ARC_TESTNET.deployBlock;

  const foundIds = new Set<bigint>();
  let toBlock = latestBlock;
  let windowsScanned = 0;
  let reachedFloor = toBlock < deployBlock;

  while (!reachedFloor && foundIds.size < pageSize && windowsScanned < MAX_WINDOWS_PER_PAGE) {
    const fromBlock =
      toBlock - LOG_BLOCK_WINDOW + 1n > deployBlock ? toBlock - LOG_BLOCK_WINDOW + 1n : deployBlock;

    const logs = await client.getLogs({
      address: PACKET_ARC_TESTNET.address,
      event: PACKET_CREATED_EVENT,
      args: { creator: address },
      fromBlock,
      toBlock,
    });

    for (const log of logs) {
      if (log.args.packetId !== undefined) foundIds.add(log.args.packetId);
    }

    windowsScanned += 1;
    if (fromBlock <= deployBlock) {
      reachedFloor = true;
      break;
    }
    toBlock = fromBlock - 1n;
  }

  const ids = Array.from(foundIds).sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
  const packets = await Promise.all(ids.slice(0, pageSize).map((id) => readPacket(id)));

  return {
    packets,
    nextBeforeBlock: reachedFloor ? undefined : toBlock,
  };
}

/**
 * Finds the packet id for a `createPacket` call just made by `creator`,
 * matching on the exact total/maxClaims/splitMode (good enough — a
 * creator making two identical packets back-to-back is fine to
 * disambiguate by "most recent match").
 */
export async function findPacketIdForCreator(
  creator: Address,
  { totalAmount, maxClaims }: { totalAmount: bigint; maxClaims: number },
  { maxWindows = 5, windowSize = 200n }: { maxWindows?: number; windowSize?: bigint } = {},
): Promise<bigint | null> {
  const client = getPacketPublicClient();
  const deployBlock = PACKET_ARC_TESTNET.deployBlock;

  let toBlock = await client.getBlockNumber();
  for (let i = 0; i < maxWindows; i += 1) {
    const fromBlock = toBlock - windowSize + 1n > deployBlock ? toBlock - windowSize + 1n : deployBlock;
    const logs = await client.getLogs({
      address: PACKET_ARC_TESTNET.address,
      event: PACKET_CREATED_EVENT,
      args: { creator },
      fromBlock,
      toBlock,
    });

    const match = logs
      .filter((log) => log.args.totalAmount === totalAmount && log.args.maxClaims === maxClaims)
      .sort((a, b) => Number(b.blockNumber - a.blockNumber))[0];
    if (match?.args.packetId !== undefined) {
      return match.args.packetId;
    }

    if (fromBlock <= deployBlock) break;
    toBlock = fromBlock - 1n;
  }
  return null;
}
