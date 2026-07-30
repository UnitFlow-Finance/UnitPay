import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/platform/objects";

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (char) => {
    switch (char) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "\"":
        return "&quot;";
      default:
        return "&apos;";
    }
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const title = escapeXml(url.searchParams.get("title") || "UnitPay");
  const subtitle = escapeXml(url.searchParams.get("subtitle") || "Circle-powered payments");
  const amount = escapeXml(url.searchParams.get("amount") || "");
  const status = escapeXml(url.searchParams.get("status") || "");
  const logo = absoluteUrl("/unitflow-logo.jpg", url.origin);
  const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop stop-color="#101828"/>
      <stop offset="0.55" stop-color="#184E77"/>
      <stop offset="1" stop-color="#2A9D8F"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" rx="0" fill="url(#bg)"/>
  <rect x="64" y="64" width="1072" height="502" rx="36" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.25)" stroke-width="2"/>
  <image href="${logo}" x="92" y="92" width="72" height="72" preserveAspectRatio="xMidYMid slice"/>
  <text x="184" y="140" fill="white" font-size="34" font-family="Inter, Arial" font-weight="700">UnitPay</text>
  <text x="92" y="260" fill="white" font-size="62" font-family="Inter, Arial" font-weight="800">${title}</text>
  <text x="92" y="330" fill="rgba(255,255,255,0.82)" font-size="34" font-family="Inter, Arial">${subtitle}</text>
  ${amount ? `<text x="92" y="450" fill="white" font-size="68" font-family="Inter, Arial" font-weight="800">${amount}</text>` : ""}
  ${status ? `<rect x="92" y="482" width="260" height="54" rx="27" fill="rgba(255,255,255,0.16)"/><text x="122" y="519" fill="white" font-size="28" font-family="Inter, Arial" font-weight="700">${status}</text>` : ""}
  <rect x="948" y="374" width="144" height="144" rx="26" fill="white" opacity="0.92"/>
  <text x="972" y="452" fill="#101828" font-size="24" font-family="JetBrains Mono, monospace" font-weight="700">QR</text>
</svg>`;
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
