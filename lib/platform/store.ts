import "server-only";

import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  keccak256,
  parseAbi,
  toBytes,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";
import { METADATA_REGISTRY_ARC_TESTNET } from "@/lib/chains/config";
import { rpcUrlForChain } from "@/lib/chains/rpc";
import {
  normalizeRegistryPrivateKey,
  REGISTRY_SIGNER_MALFORMED_ERROR,
} from "@/lib/platform/registrySigner";

const STORE_KIND = keccak256(toBytes("unitpay.platform.store.v1"));
const queues = new Map<string, Promise<unknown>>();
const memoryStore = new Map<string, string>();

const METADATA_REGISTRY_ABI = parseAbi([
  "function upsert(bytes32 kind, string id, string data)",
  "function getRecord(bytes32 kind, string id) view returns (string data, uint64 updatedAt, bool exists)",
]);

function cloneFallback<T>(fallback: T): T {
  return typeof structuredClone === "function"
    ? structuredClone(fallback)
    : (JSON.parse(JSON.stringify(fallback)) as T);
}

function registryAddress(): Address | null {
  const raw =
    process.env.UNITPAY_METADATA_REGISTRY_ADDRESS ?? METADATA_REGISTRY_ARC_TESTNET.address;
  if (!raw) return null;
  if (!isAddress(raw)) {
    throw new Error("UNITPAY_METADATA_REGISTRY_ADDRESS is not a valid EVM address.");
  }
  return raw;
}

function registryPrivateKey() {
  return normalizeRegistryPrivateKey(process.env.UNITPAY_METADATA_REGISTRY_PRIVATE_KEY);
}

function shouldUseMemoryStore(): boolean {
  return process.env.UNITPAY_METADATA_STORE === "memory" || process.env.NODE_ENV === "test";
}

function getPublicClient() {
  return createPublicClient({
    chain: arcTestnet,
    transport: http(process.env.UNITPAY_METADATA_RPC_URL?.trim() || rpcUrlForChain("arcTestnet")),
  });
}

function getWalletClient() {
  let account: ReturnType<typeof privateKeyToAccount>;
  try {
    account = privateKeyToAccount(registryPrivateKey());
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes("private key")) {
      throw new Error(REGISTRY_SIGNER_MALFORMED_ERROR);
    }
    throw error;
  }
  return createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(process.env.UNITPAY_METADATA_RPC_URL?.trim() || rpcUrlForChain("arcTestnet")),
  });
}

async function readOnchainRecord(fileName: string): Promise<string | null> {
  if (shouldUseMemoryStore()) return memoryStore.get(fileName) ?? null;

  const address = registryAddress();
  if (!address) {
    throw new Error("UNITPAY_METADATA_REGISTRY_ADDRESS must be configured for on-chain storage.");
  }

  const [data, , exists] = await getPublicClient().readContract({
    address,
    abi: METADATA_REGISTRY_ABI,
    functionName: "getRecord",
    args: [STORE_KIND, fileName],
  });
  return exists ? data : null;
}

async function writeOnchainRecord(fileName: string, data: string): Promise<void> {
  if (shouldUseMemoryStore()) {
    memoryStore.set(fileName, data);
    return;
  }

  const address = registryAddress();
  if (!address) {
    throw new Error("UNITPAY_METADATA_REGISTRY_ADDRESS must be configured for on-chain storage.");
  }

  const hash = await getWalletClient().writeContract({
    address,
    abi: METADATA_REGISTRY_ABI,
    functionName: "upsert",
    args: [STORE_KIND, fileName, data],
  });
  await getPublicClient().waitForTransactionReceipt({ hash });
}

export async function readJsonFile<T>(fileName: string, fallback: T): Promise<T> {
  const raw = await readOnchainRecord(fileName);
  if (!raw) return cloneFallback(fallback);

  try {
    return JSON.parse(raw) as T;
  } catch {
    return cloneFallback(fallback);
  }
}

export async function writeJsonFile<T>(fileName: string, data: T): Promise<void> {
  const raw = JSON.stringify(data);
  if (!raw) throw new Error(`Cannot store empty metadata payload for ${fileName}.`);
  await writeOnchainRecord(fileName, raw);
}

export async function updateJsonFile<T, R>(
  fileName: string,
  fallback: T,
  updater: (data: T) => R | Promise<R>,
): Promise<R> {
  const run = async () => {
    const data = await readJsonFile(fileName, fallback);
    const result = await updater(data);
    await writeJsonFile(fileName, data);
    return result;
  };
  const previous = queues.get(fileName) ?? Promise.resolve();
  const next = previous.then(run, run);
  queues.set(fileName, next.catch(() => undefined));
  return next;
}
