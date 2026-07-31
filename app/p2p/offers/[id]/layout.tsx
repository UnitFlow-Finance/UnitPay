import type { Metadata } from "next";
import { getP2POffer } from "@/lib/p2p/store";
import { customerActionLabel } from "@/lib/p2p/types";
import { absoluteUrl } from "@/lib/platform/objects";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const offer = await getP2POffer(id);
  const title = offer
    ? `${customerActionLabel(offer.side)} ${offer.asset} on UnitPay P2P`
    : "UnitPay P2P Offer";
  const description = offer
    ? `${offer.price} ${offer.fiatCurrency} · ${offer.paymentMethods.join(", ")}`
    : "Peer-to-peer crypto trading with escrow protection.";
  const image = absoluteUrl(
    `/api/share-card?title=${encodeURIComponent(title)}&subtitle=${encodeURIComponent(description)}&amount=${encodeURIComponent(offer ? `${offer.availableAmount} ${offer.asset}` : "")}&status=${encodeURIComponent(offer?.status ?? "Active")}`,
  );
  return {
    title,
    description,
    openGraph: { title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function P2POfferLayout({ children }: { children: React.ReactNode }) {
  return children;
}
