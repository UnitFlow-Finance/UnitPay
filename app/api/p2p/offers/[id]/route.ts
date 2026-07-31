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
      totalLiquidity: body.totalLiquidity !== undefined ? String(body.totalLiquidity) : undefined,
      paymentMethods: Array.isArray(body.paymentMethods) ? body.paymentMethods.map(String) : undefined,
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
        : undefined,
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
