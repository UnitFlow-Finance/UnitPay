import { NextResponse } from "next/server";
import {
  createP2PCustomerPayoutDetail,
  listP2PCustomerPayoutDetails,
} from "@/lib/p2p/store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ownerCircleWalletId = url.searchParams.get("ownerCircleWalletId");
  if (!ownerCircleWalletId) {
    return NextResponse.json({ error: "Missing ownerCircleWalletId" }, { status: 400 });
  }
  const details = await listP2PCustomerPayoutDetails(
    ownerCircleWalletId,
    url.searchParams.get("method") || undefined,
  );
  return NextResponse.json({ details });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    for (const key of ["ownerCircleWalletId", "method", "label", "accountIdentifier"]) {
      if (!body?.[key]) return NextResponse.json({ error: `Missing ${key}` }, { status: 400 });
    }
    const detail = await createP2PCustomerPayoutDetail({
      ownerCircleWalletId: String(body.ownerCircleWalletId),
      method: String(body.method),
      label: String(body.label),
      recipientName: body.recipientName ? String(body.recipientName) : undefined,
      accountIdentifier: String(body.accountIdentifier),
      institutionName: body.institutionName ? String(body.institutionName) : undefined,
      referenceNote: body.referenceNote ? String(body.referenceNote) : undefined,
      instructions: body.instructions ? String(body.instructions) : undefined,
      isDefault: body.isDefault !== undefined ? Boolean(body.isDefault) : undefined,
    });
    return NextResponse.json({ detail }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
