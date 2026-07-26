"use client";

import Image from "next/image";
import Link from "next/link";

export function Logo({
  size = 32,
  withWordmark = true,
  className = "",
}: {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/onboarding"
      className={`flex items-center gap-2 ${className}`}
      aria-label="UnitPay onboarding"
    >
      <Image
        src="/unitflow-logo.jpg"
        alt="UnitPay"
        width={size}
        height={size}
        className="rounded-lg object-cover shrink-0"
        priority
      />

      {withWordmark && (
        <span className="font-semibold tracking-tight text-foreground text-base sm:text-lg">
          UnitPay
        </span>
      )}
    </Link>
  );
}
