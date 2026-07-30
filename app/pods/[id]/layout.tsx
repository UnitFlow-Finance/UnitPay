import type { Metadata } from "next";
import { getPod } from "@/lib/pods/store";
import { absoluteUrl } from "@/lib/platform/objects";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const pod = await getPod(id);
  const title = pod?.title ?? "UnitPay Pod";
  const description = pod?.description ?? "Collaborative funding on UnitPay.";
  const amount = pod?.targetAmount ? `${pod.targetAmount} USDC` : "Flexible funding";
  const image = absoluteUrl(
    `/api/share-card?title=${encodeURIComponent(title)}&subtitle=${encodeURIComponent(description)}&amount=${encodeURIComponent(amount)}&status=${encodeURIComponent(pod?.status ?? "Open")}`,
  );
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default function PodDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
