import { NextResponse } from "next/server";
import { pruneP2POffersMissingOnChainId } from "@/lib/p2p/store";

export async function POST() {
  try {
    const result = await pruneP2POffersMissingOnChainId();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
