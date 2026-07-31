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
      customerPaymentDetails: body.customerPaymentDetails
        ? {
            id: String(body.customerPaymentDetails.id || crypto.randomUUID()),
            method: String(body.customerPaymentDetails.method || body.paymentMethod || "Bank Transfer"),
            label: String(body.customerPaymentDetails.label || "Customer payout details"),
            recipientName: body.customerPaymentDetails.recipientName
              ? String(body.customerPaymentDetails.recipientName)
              : undefined,
            accountIdentifier: body.customerPaymentDetails.accountIdentifier
              ? String(body.customerPaymentDetails.accountIdentifier)
              : undefined,
            institutionName: body.customerPaymentDetails.institutionName
              ? String(body.customerPaymentDetails.institutionName)
              : undefined,
            referenceNote: body.customerPaymentDetails.referenceNote
              ? String(body.customerPaymentDetails.referenceNote)
              : undefined,
            instructions: body.customerPaymentDetails.instructions
              ? String(body.customerPaymentDetails.instructions)
              : undefined,
          }
        : undefined,
    });
    return NextResponse.json({ trade }, { status: trade ? 201 : 404 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
