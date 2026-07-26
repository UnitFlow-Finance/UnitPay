/**
 * Gateway burn-intent EIP-712 typed data construction.
 *
 * Mirrors Circle's canonical browser-wallet example (use-gateway skill,
 * evm-to-evm-browser-wallet.md), adapted so the resulting `data` string can
 * be handed to Circle Wallets' `signTypedData` (which expects a JSON string
 * of the typed data, not a live wallet client call) instead of a raw
 * injected-wallet `signTypedData` call.
 */

export const GATEWAY_BURN_INTENT_TYPED_DATA_TYPES = {
  EIP712Domain: [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
  ],
  TransferSpec: [
    { name: "version", type: "uint32" },
    { name: "sourceDomain", type: "uint32" },
    { name: "destinationDomain", type: "uint32" },
    { name: "sourceContract", type: "bytes32" },
    { name: "destinationContract", type: "bytes32" },
    { name: "sourceToken", type: "bytes32" },
    { name: "destinationToken", type: "bytes32" },
    { name: "sourceDepositor", type: "bytes32" },
    { name: "destinationRecipient", type: "bytes32" },
    { name: "sourceSigner", type: "bytes32" },
    { name: "destinationCaller", type: "bytes32" },
    { name: "value", type: "uint256" },
    { name: "salt", type: "bytes32" },
    { name: "hookData", type: "bytes" },
  ],
  BurnIntent: [
    { name: "maxBlockHeight", type: "uint256" },
    { name: "maxFee", type: "uint256" },
    { name: "spec", type: "TransferSpec" },
  ],
} as const;

export interface BurnIntentSpec {
  version: number;
  sourceDomain: number;
  destinationDomain: number;
  sourceContract: string; // bytes32 hex
  destinationContract: string; // bytes32 hex
  sourceToken: string; // bytes32 hex
  destinationToken: string; // bytes32 hex
  sourceDepositor: string; // bytes32 hex
  destinationRecipient: string; // bytes32 hex
  sourceSigner: string; // bytes32 hex
  destinationCaller: string; // bytes32 hex
  value: string; // uint256 as decimal string (base units)
  salt: string; // bytes32 hex
  hookData: string; // hex bytes, "0x" for none
}

export interface BurnIntent {
  maxBlockHeight: string; // uint256 as decimal string
  maxFee: string; // uint256 as decimal string (base units)
  spec: BurnIntentSpec;
}

/** Left-pads a 20-byte EVM address to a 32-byte hex value, as Gateway's TransferSpec requires. */
export function addressToBytes32(address: string): string {
  const hex = address.toLowerCase().replace(/^0x/, "");
  if (hex.length !== 40) {
    throw new Error(`Expected a 20-byte EVM address, got: ${address}`);
  }
  return `0x${hex.padStart(64, "0")}`;
}

export function randomHex32(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export const MAX_UINT256 = (2n ** 256n - 1n).toString();

/**
 * Builds the full EIP-712 typed-data JSON payload (as a STRING) expected by
 * Circle Wallets' `signTypedData({ data })`. Circle's field is documented as
 * "A string represents the typed structured data in EIP-712" — i.e. the
 * standard EIP-712 JSON-RPC payload shape, JSON.stringify'd.
 */
export function buildBurnIntentTypedDataString(burnIntent: BurnIntent): string {
  const payload = {
    types: GATEWAY_BURN_INTENT_TYPED_DATA_TYPES,
    domain: { name: "GatewayWallet", version: "1" },
    primaryType: "BurnIntent",
    message: burnIntent,
  };
  return JSON.stringify(payload);
}
