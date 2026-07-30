import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/platform/objects";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const title = "UnitPay UnitPacket";
  const description = `Claim or inspect UnitPacket ${id.slice(0, 8)}.`;
  const image = absoluteUrl(
    `/api/share-card?title=${encodeURIComponent(title)}&subtitle=${encodeURIComponent(description)}&status=UnitPacket`,
  );
  return {
    title,
    description,
    openGraph: { title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function PacketLayout({ children }: { children: React.ReactNode }) {
  return children;
}
