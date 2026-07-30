"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Send, QrCode, Globe2, Store, Settings, Users, HandCoins } from "lucide-react";
import { Logo } from "./Logo";

const NAV_ITEMS = [
  { href: "/wallet", label: "Wallet", icon: Home },
  { href: "/wallet/send", label: "Send", icon: Send },
  { href: "/wallet/receive", label: "Receive", icon: QrCode },
  { href: "/wallet/unified", label: "Gateway", icon: Globe2 },
  { href: "/wallet/pods", label: "Pods", icon: Users },
  { href: "/p2p", label: "P2P", icon: HandCoins },
  { href: "/merchant", label: "Merchant", icon: Store },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/wallet") return pathname === "/wallet";
  return pathname.startsWith(href);
}

/**
 * Responsive app chrome for the wallet product surface:
 * - Mobile / narrow viewports: sticky top bar (logo) + fixed bottom tab bar,
 *   the standard mobile-wallet navigation pattern.
 * - Tablet and up (`sm:` / `md:`): a persistent left sidebar replaces the
 *   bottom tab bar, and content gets a wider, centered column with more
 *   breathing room instead of the mobile-optimized `max-w-md` single column.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-full">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-60 lg:w-64 shrink-0 border-r border-border bg-surface/60 px-4 py-6 gap-1">
        <Logo size={32} className="mb-6 px-2" />
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active
                  ? "bg-primary-light text-primary"
                  : "text-muted hover:text-foreground hover:bg-surface-elevated"
              }`}
            >
              <Icon className="w-[18px] h-[18px]" />
              {label}
            </Link>
          );
        })}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-border bg-background/90 backdrop-blur">
          <Logo size={28} />
          <Link
            href="/settings"
            aria-label="Settings"
            className={`p-1.5 rounded-lg transition-colors ${
              isActive(pathname, "/settings")
                ? "text-primary"
                : "text-muted hover:text-foreground"
            }`}
          >
            <Settings className="w-5 h-5" />
          </Link>
        </header>

        <div className="flex-1 pb-20 md:pb-0">{children}</div>

        {/* Mobile bottom tab bar */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-10 pb-safe border-t border-border bg-background/95 backdrop-blur">
          <div className="grid grid-cols-7">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                    active ? "text-primary" : "text-muted"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
