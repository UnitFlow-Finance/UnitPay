import { NextResponse } from "next/server";
import { createVirtualCard, listVirtualCards } from "@/lib/cards/store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cards = await listVirtualCards(url.searchParams.get("owner") || undefined);
  return NextResponse.json({ cards });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body?.ownerCircleWalletId || !body?.label) {
      return NextResponse.json({ error: "Missing card owner or label" }, { status: 400 });
    }
    const card = await createVirtualCard({
      ownerCircleWalletId: String(body.ownerCircleWalletId),
      label: String(body.label),
      cardType:
        body.cardType === "Single-use" || body.cardType === "Subscription"
          ? body.cardType
          : "Reusable",
      monthlyLimit: String(body.monthlyLimit || "1000"),
      perTransactionLimit: String(body.perTransactionLimit || "100"),
      merchantRestrictions: Array.isArray(body.merchantRestrictions)
        ? body.merchantRestrictions.map(String)
        : [],
    });
    return NextResponse.json({ card }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
