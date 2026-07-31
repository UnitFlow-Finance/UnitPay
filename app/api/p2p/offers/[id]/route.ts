import { NextResponse } from "next/server";
import { deleteP2POffer, getP2POffer, updateP2POffer } from "@/lib/p2p/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const offer = await getP2POffer(id);
  return NextResponse.json({ offer }, { status: offer ? 200 : 404 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const status = ["Active", "Paused", "Filled", "Cancelled"].includes(body?.status)
      ? body.status
      : undefined;
    const offer = await updateP2POffer(id, {
      price: body.price !== undefined ? String(body.price) : undefined,
      pricingMode:
        body.pricingMode === "market_premium" || body.pricingMode === "market_discount" || body.pricingMode === "fixed"
          ? body.pricingMode
          : undefined,
      priceMarginPercent:
        body.priceMarginPercent !== undefined ? String(body.priceMarginPercent) : undefined,
      minAmount: body.minAmount !== undefined ? String(body.minAmount) : undefined,
      maxAmount: body.maxAmount !== undefined ? String(body.maxAmount) : undefined,
      availableAmount: body.availableAmount !== undefined ? String(body.availableAmount) : undefined,
      paymentMethods: Array.isArray(body.paymentMethods) ? body.paymentMethods.map(String) : undefined,
      paymentTimeLimitMinutes:
        body.paymentTimeLimitMinutes !== undefined ? Number(body.paymentTimeLimitMinutes) : undefined,
      terms: body.terms !== undefined ? String(body.terms) : undefined,
      instructions: body.instructions !== undefined ? String(body.instructions) : undefined,
      kycRequired: body.kycRequired !== undefined ? Boolean(body.kycRequired) : undefined,
      status,
    });
    return NextResponse.json({ offer }, { status: offer ? 200 : 404 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const deleted = await deleteP2POffer(id);
  return NextResponse.json(deleted ? { ok: true } : { error: "Offer not found" }, { status: deleted ? 200 : 404 });
}
