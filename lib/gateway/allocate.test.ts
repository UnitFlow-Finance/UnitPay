import { describe, expect, it } from "vitest";
import { allocateSourceChains } from "./allocate";

describe("allocateSourceChains", () => {
  it("draws entirely from the destination chain when it has enough balance", () => {
    const legs = allocateSourceChains(
      [
        { chainKey: "arcTestnet", balance: "50" },
        { chainKey: "baseSepolia", balance: "10" },
      ],
      "20",
      "arcTestnet",
    );
    expect(legs).toEqual([{ chainKey: "arcTestnet", amount: "20" }]);
  });

  it("prefers the destination chain first even if it is not the largest balance", () => {
    const legs = allocateSourceChains(
      [
        { chainKey: "arcTestnet", balance: "5" },
        { chainKey: "baseSepolia", balance: "100" },
      ],
      "5",
      "arcTestnet",
    );
    expect(legs).toEqual([{ chainKey: "arcTestnet", amount: "5" }]);
  });

  it("splits across multiple chains, destination first then highest-balance-first", () => {
    const legs = allocateSourceChains(
      [
        { chainKey: "arcTestnet", balance: "5" },
        { chainKey: "baseSepolia", balance: "100" },
        { chainKey: "avalancheFuji", balance: "50" },
      ],
      "60",
      "arcTestnet",
    );
    expect(legs).toEqual([
      { chainKey: "arcTestnet", amount: "5" },
      { chainKey: "baseSepolia", amount: "55" },
    ]);
  });

  it("ignores zero-balance chains", () => {
    const legs = allocateSourceChains(
      [
        { chainKey: "arcTestnet", balance: "0" },
        { chainKey: "baseSepolia", balance: "10" },
      ],
      "10",
      "arcTestnet",
    );
    expect(legs).toEqual([{ chainKey: "baseSepolia", amount: "10" }]);
  });

  it("throws when total balance is insufficient", () => {
    expect(() =>
      allocateSourceChains(
        [{ chainKey: "arcTestnet", balance: "5" }],
        "10",
        "arcTestnet",
      ),
    ).toThrow(/Insufficient/);
  });

  it("throws for a zero or negative amount", () => {
    expect(() =>
      allocateSourceChains([{ chainKey: "arcTestnet", balance: "5" }], "0", "arcTestnet"),
    ).toThrow(/greater than zero/);
  });
});
