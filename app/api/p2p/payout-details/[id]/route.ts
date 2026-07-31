import { NextResponse } from "next/server";
import {
  deleteP2PCustomerPayoutDetail,
  updateP2PCustomerPayoutDetail,
} from "@/lib/p2p/store";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const ownerCircleWalletId = String(body.ownerCircleWalletId || "");
    if (!ownerCircleWalletId) {
      return NextResponse.json({ error: "Missing ownerCircleWalletId" }, { status: 400 });
    }
    const detail = await updateP2PCustomerPayoutDetail(id, ownerCircleWalletId, {
      method: body.method !== undefined ? String(body.method) : undefined,
      label: body.label !== undefined ? String(body.label) : undefined,
      recipientName: body.recipientName !== undefined ? String(body.recipientName) : undefined,
      accountIdentifier:
        body.accountIdentifier !== undefined ? String(body.accountIdentifier) : undefined,
      institutionName: body.institutionName !== undefined ? String(body.institutionName) : undefined,
      referenceNote: body.referenceNote !== undefined ? String(body.referenceNote) : undefined,
      instructions: body.instructions !== undefined ? String(body.instructions) : undefined,
      isDefault: body.isDefault !== undefined ? Boolean(body.isDefault) : undefined,
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json({ detail }, { status: detail ? 200 : 404 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const ownerCircleWalletId = url.searchParams.get("ownerCircleWalletId") || "";
  if (!ownerCircleWalletId) {
    return NextResponse.json({ error: "Missing ownerCircleWalletId" }, { status: 400 });
  }
  const deleted = await deleteP2PCustomerPayoutDetail(id, ownerCircleWalletId);
  return NextResponse.json(
    deleted ? { ok: true } : { error: "Payout detail not found" },
    { status: deleted ? 200 : 404 },
  );
}
