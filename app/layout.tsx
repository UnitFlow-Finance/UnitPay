import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { CircleSdkProvider } from "@/lib/circle/sdkContext";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "UnitPay — USDC Wallet & Payments (Testnet)",
  description:
    "UnitPay — a UnitFlow Finance product. A crypto-native USDC wallet and payments app, demoed end-to-end on Arc Testnet, powered by Circle.",
  icons: {
    icon: "/unitflow-logo.jpg",
    apple: "/unitflow-logo.jpg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0f1117",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <CircleSdkProvider>{children}</CircleSdkProvider>
      </body>
    </html>
  );
}
