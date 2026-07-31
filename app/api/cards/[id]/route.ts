import { NextResponse } from "next/server";
import {
  deleteVirtualCard,
  fundVirtualCard,
  getVirtualCard,
  updateVirtualCardStatus,
  withdrawVirtualCardBalance,
} from "@/lib/cards/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await getVirtualCard(id);
  return NextResponse.json(
    { card: result?.card ?? null, transactions: result?.transactions ?? [] },
    { status: result ? 200 : 404 },
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await request.json();
    if (body?.action === "fund") {
      const result = await fundVirtualCard(id, String(body.amount || ""));
      return NextResponse.json(result ?? { error: "Card not found" }, { status: result ? 200 : 404 });
    }
    if (body?.action === "withdraw") {
      const result = await withdrawVirtualCardBalance(id, String(body.amount || ""));
      return NextResponse.json(result ?? { error: "Card not found" }, { status: result ? 200 : 404 });
    }
    const status = body?.status;
    if (!["Active", "Frozen", "Closed", "Expired"].includes(status)) {
      return NextResponse.json({ error: "Invalid card status" }, { status: 400 });
    }
    const card = await updateVirtualCardStatus(id, status);
    return NextResponse.json({ card }, { status: card ? 200 : 404 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const deleted = await deleteVirtualCard(id);
  return NextResponse.json(deleted ? { ok: true } : { error: "Card not found" }, { status: deleted ? 200 : 404 });
}
