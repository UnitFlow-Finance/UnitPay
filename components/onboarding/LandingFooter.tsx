import Link from "next/link";
import { DiscordIcon, XIcon } from "@/components/icons/SocialIcons";
import { Logo } from "@/components/Logo";
import { Section } from "./Section";

const FOOTER_NAV = [
  { href: "#products", label: "Products" },
  { href: "#builders", label: "Developers" },
  { href: "#vision", label: "About" },
  { href: "https://docs.unitflow.finance", label: "Docs", external: true },
] as const;

const SOCIAL_LINKS = [
  { href: "https://x.com/UnitFlowFinance", label: "X", icon: XIcon },
  { href: "https://discord.gg/CCw46AqS7", label: "Discord", icon: DiscordIcon },
] as const;

export function LandingFooter() {
  return (
    <footer className="border-t border-border/60 mt-8">
      <Section className="py-10 sm:py-14">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-8">
          <div className="space-y-3">
            <Logo size={28} />
            <p className="text-xs text-subtle max-w-xs leading-relaxed">
              A UnitFlow Finance product. Demoed end-to-end on Arc Testnet, powered by Circle.
            </p>
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {FOOTER_NAV.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target={"external" in link && link.external ? "_blank" : undefined}
                rel={"external" in link && link.external ? "noopener noreferrer" : undefined}
                className="text-sm text-muted hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            {SOCIAL_LINKS.map(({ href, label, icon: Icon }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="text-muted hover:text-foreground transition-colors"
              >
                <Icon className="w-5 h-5" />
              </a>
            ))}
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-subtle">
            © {new Date().getFullYear()} UnitFlow Finance. Testnet demo — not for production
            use.
          </p>
          <div className="flex gap-5">
            <Link href="/onboarding" className="text-xs text-subtle hover:text-muted transition-colors">
              Overview
            </Link>
            <Link href="/onboarding/wallet" className="text-xs text-subtle hover:text-muted transition-colors">
              Create Wallet
            </Link>
          </div>
        </div>
      </Section>
    </footer>
  );
}
