import type { Metadata } from "next";
import { decodePaymentRequest } from "@/lib/paymentRequest";
import { absoluteUrl } from "@/lib/platform/objects";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ encoded: string }>;
}): Promise<Metadata> {
  const { encoded } = await params;
  let title = "UnitPay Payment Link";
  let description = "Pay a UnitPay request from your wallet or external chain.";
  let amount = "";
  try {
    const request = decodePaymentRequest(encoded);
    title = request.memo || "UnitPay Payment Link";
    description = `Request from ${request.requesterAddress.slice(0, 8)}...${request.requesterAddress.slice(-6)}`;
    amount = `${request.amount} USDC`;
  } catch {
    // Keep generic metadata for malformed or expired links.
  }
  const image = absoluteUrl(
    `/api/share-card?title=${encodeURIComponent(title)}&subtitle=${encodeURIComponent(description)}&amount=${encodeURIComponent(amount)}&status=Payment`,
  );
  return {
    title,
    description,
    openGraph: { title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function PaymentLinkLayout({ children }: { children: React.ReactNode }) {
  return children;
}
