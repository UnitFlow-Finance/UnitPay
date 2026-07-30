import { NextResponse } from "next/server";
import { createP2POffer, listP2POffers } from "@/lib/p2p/store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const offers = await listP2POffers({
    side: url.searchParams.get("side") || undefined,
    asset: url.searchParams.get("asset") || undefined,
    fiatCurrency: url.searchParams.get("fiatCurrency") || undefined,
  });
  return NextResponse.json({ offers });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    for (const key of ["creatorWalletId", "creatorCircleWalletId", "side", "asset", "fiatCurrency"]) {
      if (!body?.[key]) return NextResponse.json({ error: `Missing ${key}` }, { status: 400 });
    }
    const offer = await createP2POffer({
      merchantId: body.merchantId ? String(body.merchantId) : undefined,
      creatorWalletId: String(body.creatorWalletId),
      creatorCircleWalletId: String(body.creatorCircleWalletId),
      side: body.side === "buy" ? "buy" : "sell",
      asset: String(body.asset),
      fiatCurrency: String(body.fiatCurrency),
      price: String(body.price || "1"),
      minAmount: String(body.minAmount || "1"),
      maxAmount: String(body.maxAmount || body.availableAmount || "1"),
      availableAmount: String(body.availableAmount || body.maxAmount || "1"),
      paymentMethods: Array.isArray(body.paymentMethods)
        ? body.paymentMethods.map(String)
        : ["Bank Transfer"],
      terms: String(body.terms || "Follow the trade instructions and only confirm after payment."),
    });
    return NextResponse.json({ offer }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
