import "server-only";

import { readJsonFile, updateJsonFile } from "@/lib/platform/store";
import type { ArbitratorRule } from "@/lib/arbitration/types";

interface ArbitratorDatabase {
  rules: ArbitratorRule[];
}

const ARBITRATORS_FILE = "arbitrators.json";
const emptyDb: ArbitratorDatabase = { rules: [] };

export async function listArbitratorRules(ownerCircleWalletId?: string): Promise<ArbitratorRule[]> {
  const db = await readJsonFile(ARBITRATORS_FILE, emptyDb);
  return db.rules.filter((rule) =>
    ownerCircleWalletId ? rule.ownerCircleWalletId === ownerCircleWalletId : true,
  );
}

export async function createArbitratorRule(
  input: Omit<ArbitratorRule, "id" | "status" | "createdAt" | "updatedAt">,
): Promise<ArbitratorRule> {
  return updateJsonFile(ARBITRATORS_FILE, emptyDb, (db) => {
    const now = new Date().toISOString();
    const rule: ArbitratorRule = {
      ...input,
      id: crypto.randomUUID(),
      status: "Active",
      createdAt: now,
      updatedAt: now,
    };
    db.rules.unshift(rule);
    return rule;
  });
}
