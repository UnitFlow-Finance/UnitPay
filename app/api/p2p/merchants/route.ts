import { NextResponse } from "next/server";
import { listP2PMerchants, upsertP2PMerchantProfile } from "@/lib/p2p/store";

export async function GET() {
  const merchants = await listP2PMerchants();
  return NextResponse.json({ merchants });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    for (const key of ["walletId", "circleWalletId", "displayName"]) {
      if (!body?.[key]) return NextResponse.json({ error: `Missing ${key}` }, { status: 400 });
    }
    const merchant = await upsertP2PMerchantProfile({
      walletId: String(body.walletId),
      circleWalletId: String(body.circleWalletId),
      displayName: String(body.displayName),
      avatarUrl: body.avatarUrl ? String(body.avatarUrl) : undefined,
      bio: body.bio ? String(body.bio) : undefined,
      stakedAmount: body.stakedAmount ? String(body.stakedAmount) : undefined,
      kycStatus:
        body.kycStatus === "not_started" || body.kycStatus === "pending" || body.kycStatus === "verified"
          ? body.kycStatus
          : undefined,
      tradingPaused: body.tradingPaused !== undefined ? Boolean(body.tradingPaused) : undefined,
      supportedPaymentMethods: Array.isArray(body.supportedPaymentMethods)
        ? body.supportedPaymentMethods.map(String)
        : undefined,
      terms: body.terms ? String(body.terms) : undefined,
    });
    return NextResponse.json({ merchant });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
