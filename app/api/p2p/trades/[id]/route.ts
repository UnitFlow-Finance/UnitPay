import { NextResponse } from "next/server";
import {
  addP2PTradeEvidence,
  cancelP2PTrade,
  disputeP2PTrade,
  getP2PTrade,
  markP2PTradePaid,
  releaseP2PTrade,
  resolveP2PTrade,
} from "@/lib/p2p/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const trade = await getP2PTrade(id);
  return NextResponse.json({ trade }, { status: trade ? 200 : 404 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const actorCircleWalletId = String(body.actorCircleWalletId || "");
    if (!actorCircleWalletId) {
      return NextResponse.json({ error: "Missing actorCircleWalletId" }, { status: 400 });
    }
    let trade = null;
    if (body.action === "mark-paid") {
      trade = await markP2PTradePaid(id, actorCircleWalletId, String(body.proofOfPayment || ""));
    } else if (body.action === "release") {
      trade = await releaseP2PTrade(id, actorCircleWalletId);
    } else if (body.action === "cancel") {
      trade = await cancelP2PTrade(id, actorCircleWalletId);
    } else if (body.action === "dispute") {
      trade = await disputeP2PTrade(id, actorCircleWalletId, String(body.reason || "Dispute opened"));
    } else if (body.action === "resolve") {
      trade = await resolveP2PTrade(
        id,
        actorCircleWalletId,
        body.outcome === "refund" ? "refund" : "release",
        String(body.note || "Resolved by arbitration"),
      );
    } else if (body.action === "evidence") {
      trade = await addP2PTradeEvidence(id, {
        submittedByCircleWalletId: actorCircleWalletId,
        label: String(body.label || "Evidence"),
        urlOrReference: String(body.urlOrReference || ""),
      });
    } else {
      return NextResponse.json({ error: "Unsupported trade action" }, { status: 400 });
    }
    return NextResponse.json({ trade }, { status: trade ? 200 : 404 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
