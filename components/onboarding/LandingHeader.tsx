"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { LinkButton } from "@/components/ui/Button";

const NAV_LINKS = [
  { href: "#products", label: "Products" },
  { href: "#builders", label: "Developers" },
  { href: "#vision", label: "About" },
  { href: "https://docs.unitflow.finance", label: "Docs", external: true },
] as const;

/**
 * Sticky marketing-site header for /onboarding. Nav items scroll-link to
 * in-page sections; "Docs" points out to the docs site. Collapses to a
 * hamburger sheet below `sm`.
 */
export function LandingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
        <Link href="/onboarding" className="shrink-0" onClick={() => setOpen(false)}>
          <Logo size={30} />
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target={"external" in link && link.external ? "_blank" : undefined}
              rel={"external" in link && link.external ? "noopener noreferrer" : undefined}
              className="text-sm font-medium text-muted hover:text-foreground transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-4">
          <Link
            href="/onboarding/login"
            className="text-sm font-medium text-muted hover:text-foreground transition-colors"
          >
            Log in
          </Link>
          <LinkButton href="/onboarding/wallet" size="md">
            Create Your Wallet
          </LinkButton>
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-foreground hover:bg-surface transition-colors"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border/60 bg-background px-4 py-4 space-y-4">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target={"external" in link && link.external ? "_blank" : undefined}
                rel={"external" in link && link.external ? "noopener noreferrer" : undefined}
                onClick={() => setOpen(false)}
                className="py-2.5 text-sm font-medium text-muted hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <LinkButton href="/onboarding/wallet" size="md" fullWidth>
            Create Your Wallet
          </LinkButton>
          <Link
            href="/onboarding/login"
            onClick={() => setOpen(false)}
            className="block text-center py-2.5 text-sm font-medium text-muted hover:text-foreground transition-colors"
          >
            Already have a wallet? Log in
          </Link>
        </div>
      )}
    </header>
  );
}
