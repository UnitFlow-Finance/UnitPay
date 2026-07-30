import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/platform/objects";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const title = "UnitPay Escrow";
  const description = `Protected escrow agreement ${id.slice(0, 8)}.`;
  const image = absoluteUrl(
    `/api/share-card?title=${encodeURIComponent(title)}&subtitle=${encodeURIComponent(description)}&status=Escrow`,
  );
  return {
    title,
    description,
    openGraph: { title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function EscrowLayout({ children }: { children: React.ReactNode }) {
  return children;
}
