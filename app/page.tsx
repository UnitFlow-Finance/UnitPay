"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Logo } from "@/components/Logo";
import { hasStoredUserSession } from "@/lib/session";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(hasStoredUserSession() ? "/wallet" : "/onboarding");
  }, [router]);

  return (
    <main className="min-h-full flex flex-col items-center justify-center gap-4">
      <Logo size={40} withWordmark={false} />
      <p className="text-muted text-sm">Loading UnitPay…</p>
    </main>
  );
}
