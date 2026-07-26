import { NextResponse } from "next/server";
import { submitBurnIntents } from "@/lib/gateway/api";

/**
 * Submits the signed burn intent to Gateway's /transfer endpoint. Returns
 * the attestation + signature the frontend needs to call gatewayMint() on
 * the destination chain (via another Circle contract-execution challenge).
 */
export async function POST(request: Request) {
  try {
    const { burnIntent, signature } = await request.json();
    if (!burnIntent || !signature) {
      return NextResponse.json({ error: "Missing burnIntent or signature" }, { status: 400 });
    }

    const result = await submitBurnIntents([{ burnIntent, signature }]);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message ?? String(error) },
      { status: 502 },
    );
  }
}
