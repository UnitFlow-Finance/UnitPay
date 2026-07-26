import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addEscrowPodContribution,
  canAccessEscrowPod,
  createEscrowPod,
  getEscrowPodWithStats,
  listPublicEscrowPods,
} from "./escrowPods";

describe("Escrow Pods local model", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    const store = new Map<string, string>();
    const localStorageMock = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    };
    vi.stubGlobal("localStorage", localStorageMock);
    vi.stubGlobal("window", { localStorage: localStorageMock });
    localStorage.clear();
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("pod-1")
      .mockReturnValueOnce("contribution-1");
  });

  it("lists public pods for discovery", () => {
    createEscrowPod({
      title: "Open grant",
      description: "Fund the work",
      creatorAddress: "0x1111111111111111111111111111111111111111",
      treasuryAddress: "0x1111111111111111111111111111111111111111",
      blockchain: "ARC-TESTNET",
      visibility: "public",
      whitelist: [],
      targetAmount: "25",
    });

    expect(listPublicEscrowPods()).toHaveLength(1);
  });

  it("tracks progress and completes when target is reached", () => {
    const pod = createEscrowPod({
      title: "Shared expense",
      description: "Dinner",
      creatorAddress: "0x1111111111111111111111111111111111111111",
      treasuryAddress: "0x1111111111111111111111111111111111111111",
      blockchain: "ARC-TESTNET",
      visibility: "private",
      whitelist: [],
      targetAmount: "10",
    });

    addEscrowPodContribution({
      podId: pod.id,
      contributorAddress: "0x2222222222222222222222222222222222222222",
      amount: "10",
    });

    const withStats = getEscrowPodWithStats(pod.id);
    expect(withStats?.totalContributed).toBe(10);
    expect(withStats?.progress).toBe(100);
    expect(withStats?.status).toBe("Completed");
  });

  it("enforces optional private whitelists", () => {
    const pod = createEscrowPod({
      title: "Private raise",
      description: "Invite only",
      creatorAddress: "0x1111111111111111111111111111111111111111",
      treasuryAddress: "0x1111111111111111111111111111111111111111",
      blockchain: "ARC-TESTNET",
      visibility: "private",
      whitelist: ["0x2222222222222222222222222222222222222222"],
    });

    expect(canAccessEscrowPod(pod, "0x2222222222222222222222222222222222222222")).toBe(true);
    expect(canAccessEscrowPod(pod, "0x3333333333333333333333333333333333333333")).toBe(false);
  });
});
