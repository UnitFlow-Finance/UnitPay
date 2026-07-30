/**
 * Client-side read access to UnitPayEscrow.sol on Arc Testnet.
 *
 * There's no database (same "no DB" pattern as lib/paymentRequest.ts), so
 * "my escrows" is derived directly from chain state: `EscrowCreated` event
 * logs (indexed by payer/payee) narrow down which escrow IDs involve a
 * given address, then `escrows(id)` is read for each to get current
 * status. Reads are paginated over block ranges to avoid a single
 * unbounded `getLogs` call against a public RPC.
 */
import { createPublicClient, http, parseAbi, parseAbiItem, type Address } from "viem";
import { arcTestnet } from "viem/chains";
import { ESCROW_ARC_TESTNET } from "@/lib/chains/config";
import { rpcUrlForChain } from "@/lib/chains/rpc";

export const ESCROW_ABI = parseAbi([
  "function createEscrow(address payee, address arbiter, uint256 amount, bytes32 termsHash, uint64 expiresIn) returns (uint256 escrowId)",
  "function release(uint256 escrowId)",
  "function refund(uint256 escrowId)",
  "function dispute(uint256 escrowId)",
  "function resolveTimedOutDispute(uint256 escrowId)",
  "function isExpired(uint256 escrowId) view returns (bool)",
  "function nextEscrowId() view returns (uint256)",
  "function DISPUTE_TIMEOUT() view returns (uint64)",
  "function escrows(uint256) view returns (address payer, address payee, address arbiter, uint256 amount, bytes32 termsHash, uint64 createdAt, uint64 expiresAt, uint64 disputedAt, uint8 status)",
  "event EscrowCreated(uint256 indexed escrowId, address indexed payer, address indexed payee, address arbiter, uint256 amount, bytes32 termsHash, uint64 expiresAt)",
  "event EscrowReleased(uint256 indexed escrowId, address indexed releasedBy)",
  "event EscrowRefunded(uint256 indexed escrowId, address indexed refundedBy)",
  "event EscrowDisputed(uint256 indexed escrowId, address indexed raisedBy)",
  "event EscrowDisputeResolved(uint256 indexed escrowId, bool releasedToPayee)",
]);

/**
 * Typed separately from ESCROW_ABI (rather than indexed out of it) so
 * viem's `getLogs`/`args` typing narrows correctly — indexing into a mixed
 * function+event ABI array loses the discriminated `AbiEvent` type.
 */
const ESCROW_CREATED_EVENT = parseAbiItem(
  "event EscrowCreated(uint256 indexed escrowId, address indexed payer, address indexed payee, address arbiter, uint256 amount, bytes32 termsHash, uint64 expiresAt)",
);

export const ESCROW_STATUS = ["Funded", "Released", "Refunded", "Disputed"] as const;
export type EscrowStatus = (typeof ESCROW_STATUS)[number];

export interface EscrowRecord {
  id: bigint;
  payer: Address;
  payee: Address;
  arbiter: Address;
  amount: bigint;
  termsHash: `0x${string}`;
  createdAt: bigint;
  expiresAt: bigint;
  /** 0 until dispute() has been called. */
  disputedAt: bigint;
  status: EscrowStatus;
}

let cachedClient: ReturnType<typeof createPublicClient> | null = null;

export function getEscrowPublicClient() {
  if (!cachedClient) {
    cachedClient = createPublicClient({
      chain: arcTestnet,
      transport: http(rpcUrlForChain("arcTestnet")),
    });
  }
  return cachedClient;
}

export async function readEscrow(escrowId: bigint): Promise<EscrowRecord> {
  const client = getEscrowPublicClient();
  const [payer, payee, arbiter, amount, termsHash, createdAt, expiresAt, disputedAt, status] =
    await client.readContract({
      address: ESCROW_ARC_TESTNET.address,
      abi: ESCROW_ABI,
      functionName: "escrows",
      args: [escrowId],
    });

  return {
    id: escrowId,
    payer,
    payee,
    arbiter,
    amount,
    termsHash,
    createdAt,
    expiresAt,
    disputedAt,
    status: ESCROW_STATUS[status] ?? "Funded",
  };
}

/** Reads the contract-wide dispute timeout (seconds) after which anyone can call resolveTimedOutDispute. */
export async function readDisputeTimeout(): Promise<bigint> {
  const client = getEscrowPublicClient();
  return client.readContract({
    address: ESCROW_ARC_TESTNET.address,
    abi: ESCROW_ABI,
    functionName: "DISPUTE_TIMEOUT",
  });
}

export async function readNextEscrowId(): Promise<bigint> {
  const client = getEscrowPublicClient();
  return client.readContract({
    address: ESCROW_ARC_TESTNET.address,
    abi: ESCROW_ABI,
    functionName: "nextEscrowId",
  });
}

/**
 * Finds the escrow id for a `createEscrow` call just made by `payer`,
 * matching on the exact `termsHash` (a keccak256 hash of the encrypted
 * task terms — collision-proof in practice) rather than assuming
 * "highest id so far", which would race against any other concurrent
 * `createEscrow` call from a different payer.
 *
 * Scans backwards from the current chain head in small windows since the
 * escrow was just created (a few blocks at most).
 */
export async function findEscrowIdByTermsHash(
  payer: Address,
  termsHash: `0x${string}`,
  { maxWindows = 5, windowSize = 200n }: { maxWindows?: number; windowSize?: bigint } = {},
): Promise<bigint | null> {
  const client = getEscrowPublicClient();

  const deployBlock = ESCROW_ARC_TESTNET.deployBlock;
  let toBlock = await client.getBlockNumber();
  for (let i = 0; i < maxWindows; i += 1) {
    const fromBlock = toBlock - windowSize + 1n > deployBlock ? toBlock - windowSize + 1n : deployBlock;
    const logs = await client.getLogs({
      address: ESCROW_ARC_TESTNET.address,
      event: ESCROW_CREATED_EVENT,
      args: { payer },
      fromBlock,
      toBlock,
    });

    const match = logs
      .filter((log) => log.args.termsHash === termsHash)
      .sort((a, b) => Number(b.blockNumber - a.blockNumber))[0];
    if (match) {
      return match.args.escrowId ?? null;
    }

    if (fromBlock <= deployBlock) break;
    toBlock = fromBlock - 1n;
  }
  return null;
}

/**
 * Default block window per `getLogs` call. Kept comfortably under the
 * common public-RPC cap of 10,000 blocks per request (Arc Testnet's own
 * RPC enforces exactly that limit — see the "eth_getLogs is limited to a
 * 10,000 range" error this constant exists to avoid).
 */
const LOG_BLOCK_WINDOW = 9_000n;
/** How many windows to scan per `listEscrowsForAddress` call, to bound one page's RPC cost. */
const MAX_WINDOWS_PER_PAGE = 20;

export interface EscrowListPage {
  escrows: EscrowRecord[];
  /** Pass as `beforeBlock` on the next call to continue paginating backwards; undefined once exhausted. */
  nextBeforeBlock?: bigint;
}

/**
 * Finds escrows involving `address` (as payer OR payee), paginated
 * backwards from `beforeBlock` (or the current chain head) in fixed-size
 * block windows, stopping once `pageSize` escrows have been found or the
 * chain's genesis / deployment block is reached.
 */
export async function listEscrowsForAddress(
  address: Address,
  { pageSize = 10, beforeBlock }: { pageSize?: number; beforeBlock?: bigint } = {},
): Promise<EscrowListPage> {
  const client = getEscrowPublicClient();
  const latestBlock = beforeBlock ?? (await client.getBlockNumber());
  const deployBlock = ESCROW_ARC_TESTNET.deployBlock;

  const foundIds = new Set<bigint>();
  let toBlock = latestBlock;
  let windowsScanned = 0;
  let reachedFloor = toBlock < deployBlock;

  while (!reachedFloor && foundIds.size < pageSize && windowsScanned < MAX_WINDOWS_PER_PAGE) {
    const fromBlock =
      toBlock - LOG_BLOCK_WINDOW + 1n > deployBlock ? toBlock - LOG_BLOCK_WINDOW + 1n : deployBlock;

    const [asPayer, asPayee] = await Promise.all([
      client.getLogs({
        address: ESCROW_ARC_TESTNET.address,
        event: ESCROW_CREATED_EVENT,
        args: { payer: address },
        fromBlock,
        toBlock,
      }),
      client.getLogs({
        address: ESCROW_ARC_TESTNET.address,
        event: ESCROW_CREATED_EVENT,
        args: { payee: address },
        fromBlock,
        toBlock,
      }),
    ]);

    for (const log of [...asPayer, ...asPayee]) {
      if (log.args.escrowId !== undefined) foundIds.add(log.args.escrowId);
    }

    windowsScanned += 1;
    if (fromBlock <= deployBlock) {
      reachedFloor = true;
      break;
    }
    toBlock = fromBlock - 1n;
  }

  const ids = Array.from(foundIds).sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
  const escrows = await Promise.all(ids.slice(0, pageSize).map((id) => readEscrow(id)));

  return {
    escrows,
    nextBeforeBlock: reachedFloor ? undefined : toBlock,
  };
}
