import { NextResponse } from "next/server";
import { getP2POffer } from "@/lib/p2p/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const offer = await getP2POffer(id);
  return NextResponse.json({ offer }, { status: offer ? 200 : 404 });
}
