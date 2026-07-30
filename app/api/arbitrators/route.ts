import { NextResponse } from "next/server";
import { createArbitratorRule, listArbitratorRules } from "@/lib/arbitration/store";
import type { ArbitratorAction } from "@/lib/arbitration/types";

const actions: ArbitratorAction[] = [
  "release",
  "refund",
  "require_evidence",
  "escalate_manual",
  "split",
];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rules = await listArbitratorRules(url.searchParams.get("owner") || undefined);
  return NextResponse.json({ rules });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = actions.includes(body.action) ? body.action : "escalate_manual";
    if (!body?.ownerCircleWalletId || !body?.name) {
      return NextResponse.json({ error: "Missing owner or rule name" }, { status: 400 });
    }
    const rule = await createArbitratorRule({
      ownerCircleWalletId: String(body.ownerCircleWalletId),
      name: String(body.name),
      description: String(body.description || ""),
      trigger: String(body.trigger || "Manual review requested"),
      action,
      timeoutHours: body.timeoutHours ? Number(body.timeoutHours) : undefined,
      splitPayeePercent: body.splitPayeePercent ? Number(body.splitPayeePercent) : undefined,
      requiresBothApproval: Boolean(body.requiresBothApproval),
    });
    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
