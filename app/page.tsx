"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Logo } from "@/components/Logo";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/onboarding");
  }, [router]);

  return (
    <main className="min-h-full flex flex-col items-center justify-center gap-4">
      <Logo size={40} withWordmark={false} />
      <p className="text-muted text-sm">Loading UnitPay…</p>
    </main>
  );
}
