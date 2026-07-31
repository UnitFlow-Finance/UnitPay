import { NextResponse } from "next/server";
import { createP2PTrade, listP2PTrades } from "@/lib/p2p/store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const trades = await listP2PTrades(url.searchParams.get("walletId") || undefined);
  return NextResponse.json({ trades });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const trade = await createP2PTrade({
      offerId: String(body.offerId),
      takerCircleWalletId: String(body.takerCircleWalletId),
      amount: String(body.amount),
      onChainTradeId: body.onChainTradeId !== undefined ? String(body.onChainTradeId) : undefined,
      escrowMode:
        body.escrowMode === "manual" || body.escrowMode === "ai_arbitrated"
          ? body.escrowMode
          : "automatic",
      paymentMethod: String(body.paymentMethod || "Bank Transfer"),
    });
    return NextResponse.json({ trade }, { status: trade ? 201 : 404 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
