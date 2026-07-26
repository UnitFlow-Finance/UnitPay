import { describe, expect, it } from "vitest";
import {
  MAX_UINT256,
  addressToBytes32,
  buildBurnIntentTypedDataString,
  randomHex32,
} from "./burnIntent";

describe("addressToBytes32", () => {
  it("left-pads a 20-byte address to 32 bytes", () => {
    const address = "0x1234567890123456789012345678901234567890";
    const result = addressToBytes32(address);
    expect(result).toBe(
      "0x0000000000000000000000001234567890123456789012345678901234567890".slice(0, 66),
    );
    expect(result.length).toBe(66); // 0x + 64 hex chars
  });

  it("lowercases the address", () => {
    const address = "0xABCDEF0123456789ABCDEF0123456789ABCDEF01";
    const result = addressToBytes32(address);
    expect(result).toBe(result.toLowerCase());
  });

  it("rejects addresses that are not 20 bytes", () => {
    expect(() => addressToBytes32("0x1234")).toThrow(/20-byte EVM address/);
  });
});

describe("randomHex32", () => {
  it("produces a 32-byte hex string each time", () => {
    const a = randomHex32();
    const b = randomHex32();
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
    expect(b).toMatch(/^0x[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
});

describe("MAX_UINT256", () => {
  it("equals 2^256 - 1", () => {
    expect(BigInt(MAX_UINT256)).toBe(2n ** 256n - 1n);
  });
});

describe("buildBurnIntentTypedDataString", () => {
  const sampleIntent = {
    maxBlockHeight: MAX_UINT256,
    maxFee: "2010000",
    spec: {
      version: 1,
      sourceDomain: 26,
      destinationDomain: 6,
      sourceContract: addressToBytes32("0x0077777d7EBA4688BDeF3E311b846F25870A19B9"),
      destinationContract: addressToBytes32("0x0022222ABE238Cc2C7Bb1f21003F0a260052475B"),
      sourceToken: addressToBytes32("0x3600000000000000000000000000000000000000"),
      destinationToken: addressToBytes32("0x036CbD53842c5426634e7929541eC2318f3dCF7e"),
      sourceDepositor: addressToBytes32("0x1111111111111111111111111111111111111111"),
      destinationRecipient: addressToBytes32("0x1111111111111111111111111111111111111111"),
      sourceSigner: addressToBytes32("0x1111111111111111111111111111111111111111"),
      destinationCaller: addressToBytes32("0x0000000000000000000000000000000000000000"),
      value: "5000000",
      salt: randomHex32(),
      hookData: "0x",
    },
  };

  it("produces valid JSON containing the expected EIP-712 shape", () => {
    const str = buildBurnIntentTypedDataString(sampleIntent);
    const parsed = JSON.parse(str);

    expect(parsed.primaryType).toBe("BurnIntent");
    expect(parsed.domain).toEqual({ name: "GatewayWallet", version: "1" });
    expect(parsed.types.BurnIntent).toBeDefined();
    expect(parsed.types.TransferSpec).toBeDefined();
    expect(parsed.message.spec.sourceDomain).toBe(26);
    expect(parsed.message.spec.destinationDomain).toBe(6);
    expect(parsed.message.spec.value).toBe("5000000");
  });

  it("round-trips the exact burn intent passed in", () => {
    const str = buildBurnIntentTypedDataString(sampleIntent);
    const parsed = JSON.parse(str);
    expect(parsed.message).toEqual(sampleIntent);
  });
});
