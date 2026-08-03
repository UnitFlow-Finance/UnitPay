import { Fingerprint, ArrowLeftRight, Zap, Repeat2, Globe2 } from "lucide-react";
import { Eyebrow, Section } from "./Section";
import { Reveal } from "./Reveal";

const MODULES = [
  {
    icon: Fingerprint,
    name: "Self-Custodied Wallet",
    description:
      "MPC-based wallet with no seed phrase — secured by PIN or Google login through Circle's User-Controlled Wallets. You always hold the keys.",
  },
  {
    icon: ArrowLeftRight,
    name: " Fiat↔ USDC On/Off-Ramp",
    description:
      "Move between Fiat and USDC without routing through five different apps and bank transfers.",
  },
  {
    icon: Zap,
    name: "Gasless USDC Payments",
    description:
      "Paymaster integration on Arc means gas is paid in USDC itself — no separate gas token to hold or manage.",
  },
  {
    icon: Repeat2,
    name: "Cross-Chain Transfers",
    description:
      "Native USDC transfers across chains via Circle's CCTP — no wrapped assets, no bridge risk.",
  },
  {
    icon: Globe2,
    name: "Gateway Infrastructure",
    description:
      "Unified USDC balance across supported chains, aligned with Circle Gateway so funds work everywhere at once.",
  },
] as const;

export function SolutionSection() {
  return (
    <Section id="products" className="py-16 sm:py-24">
      <Reveal className="max-w-2xl mx-auto text-center mb-12 sm:mb-16">
        <Eyebrow>The Solution</Eyebrow>
        <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight text-balance">
          One platform, every rail
        </h2>
        <p className="mt-4 text-muted leading-relaxed">
          UnitPay collapses wallets, ramps, and cross-chain settlement into a single
          self-custodied product, built on Arc.
        </p>
      </Reveal>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {MODULES.map(({ icon: Icon, name, description }, i) => (
          <Reveal key={name} delay={i * 70}>
            <div className="h-full rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-3 transition-all hover:border-primary/40 hover:-translate-y-0.5">
              <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <p className="font-semibold text-foreground">{name}</p>
              <p className="text-sm text-muted leading-relaxed">{description}</p>
            </div>
          </Reveal>
        ))}

        <Reveal delay={MODULES.length * 70}>
          <div className="h-full rounded-2xl border border-dashed border-border bg-surface/40 p-5 sm:p-6 flex flex-col justify-center items-start gap-2">
            <p className="text-sm font-medium text-foreground">Powered by the UnitFlow ecosystem</p>
            <p className="text-sm text-muted leading-relaxed">
              UnitPay is one product in the UnitFlow Finance stack — more shared
              infrastructure across payments, liquidity, and credit is on the way.
            </p>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
