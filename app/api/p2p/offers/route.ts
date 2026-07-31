import { NextResponse } from "next/server";
import { createP2POffer, listP2POffers } from "@/lib/p2p/store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const offers = await listP2POffers({
    side: url.searchParams.get("side") || undefined,
    asset: url.searchParams.get("asset") || undefined,
    fiatCurrency: url.searchParams.get("fiatCurrency") || undefined,
    status: url.searchParams.get("status") || undefined,
    merchantId: url.searchParams.get("merchantId") || undefined,
  });
  return NextResponse.json({ offers });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    for (const key of ["creatorWalletId", "creatorCircleWalletId", "side", "asset", "fiatCurrency"]) {
      if (!body?.[key]) return NextResponse.json({ error: `Missing ${key}` }, { status: 400 });
    }
    for (const key of ["price", "minAmount", "maxAmount", "availableAmount"]) {
      const value = Number(body?.[key]);
      if (!body?.[key] || Number.isNaN(value) || value <= 0) {
        return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 });
      }
    }
    if (Number(body.minAmount) > Number(body.maxAmount)) {
      return NextResponse.json(
        { error: "minAmount cannot be greater than maxAmount" },
        { status: 400 },
      );
    }
    if (Number(body.availableAmount) < Number(body.minAmount)) {
      return NextResponse.json(
        { error: "availableAmount must be at least minAmount" },
        { status: 400 },
      );
    }
    const offer = await createP2POffer({
      merchantId: body.merchantId ? String(body.merchantId) : undefined,
      creatorWalletId: String(body.creatorWalletId),
      creatorCircleWalletId: String(body.creatorCircleWalletId),
      chainKey: String(body.chainKey || "arcTestnet"),
      onChainOfferId: body.onChainOfferId !== undefined ? String(body.onChainOfferId) : undefined,
      custodyMode: "on_chain_escrow",
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
      paymentDetails: Array.isArray(body.paymentDetails)
        ? body.paymentDetails.map((detail: Record<string, unknown>) => ({
            id: String(detail.id || crypto.randomUUID()),
            method: String(detail.method || body.paymentMethods?.[0] || "Bank Transfer"),
            label: String(detail.label || detail.method || "Payment details"),
            recipientName: detail.recipientName ? String(detail.recipientName) : undefined,
            accountIdentifier: detail.accountIdentifier ? String(detail.accountIdentifier) : undefined,
            institutionName: detail.institutionName ? String(detail.institutionName) : undefined,
            referenceNote: detail.referenceNote ? String(detail.referenceNote) : undefined,
            instructions: detail.instructions ? String(detail.instructions) : undefined,
          }))
        : [],
      pricingMode:
        body.pricingMode === "market_premium" || body.pricingMode === "market_discount"
          ? body.pricingMode
          : "fixed",
      priceMarginPercent: String(body.priceMarginPercent || "0"),
      totalLiquidity: String(body.totalLiquidity || body.availableAmount || body.maxAmount || "1"),
      paymentTimeLimitMinutes: Number(body.paymentTimeLimitMinutes || 15),
      terms: String(body.terms || "Follow the trade instructions and only confirm after payment."),
      instructions: String(body.instructions || "Pay the merchant, upload proof, then wait for escrow release."),
      kycRequired: Boolean(body.kycRequired),
    });
    return NextResponse.json({ offer }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
