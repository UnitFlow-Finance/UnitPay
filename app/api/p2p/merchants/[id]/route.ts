import { NextResponse } from "next/server";
import { getP2PMerchant, listAllP2POffers } from "@/lib/p2p/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const merchant = await getP2PMerchant(id);
  const offers = merchant ? await listAllP2POffers({ merchantId: merchant.id }) : [];
  return NextResponse.json({ merchant, offers }, { status: merchant ? 200 : 404 });
}
