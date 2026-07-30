import { NextResponse } from "next/server";
import { updateVirtualCardStatus } from "@/lib/cards/store";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { status } = await request.json();
  if (!["Active", "Frozen", "Closed"].includes(status)) {
    return NextResponse.json({ error: "Invalid card status" }, { status: 400 });
  }
  const card = await updateVirtualCardStatus(id, status);
  return NextResponse.json({ card }, { status: card ? 200 : 404 });
}
