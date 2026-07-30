import { AppShell } from "@/components/AppShell";
import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/platform/objects";

const title = "UnitPay Merchant Profile";
const description = "Accept cross-chain Gateway payments and QR payments with UnitPay.";
const image = absoluteUrl(
  `/api/share-card?title=${encodeURIComponent(title)}&subtitle=${encodeURIComponent(description)}&status=Merchant`,
);

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, images: [image] },
  twitter: { card: "summary_large_image", title, description, images: [image] },
};

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
