export type PublicObjectType =
  | "pod"
  | "payment"
  | "packet"
  | "escrow"
  | "merchant"
  | "p2p-offer"
  | "user";

export interface ShareableObject {
  type: PublicObjectType;
  id: string;
  title: string;
  subtitle: string;
  amount?: string;
  currency?: string;
  creator?: string;
  status?: string;
  urlPath: string;
  qrValue?: string;
}

export function absoluteUrl(path: string, origin?: string): string {
  const base =
    origin ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    "http://localhost:3000";
  const normalizedBase = base.startsWith("http") ? base : `https://${base}`;
  return new URL(path, normalizedBase).toString();
}

export function objectPath(type: PublicObjectType, id: string): string {
  switch (type) {
    case "pod":
      return `/pods/${id}`;
    case "payment":
      return `/pay/${id}`;
    case "packet":
      return `/wallet/packet/${id}`;
    case "escrow":
      return `/wallet/escrow/${id}`;
    case "merchant":
      return `/merchant?profile=${encodeURIComponent(id)}`;
    case "p2p-offer":
      return `/p2p/offers/${id}`;
    case "user":
      return `/profile/${id}`;
  }
}
