import { ArrowRight } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { RailFlow } from "./RailFlow";
import { Reveal } from "./Reveal";
import { Section } from "./Section";

export function Hero() {
  return (
    <Section className="pt-10 pb-14 sm:pt-24 sm:pb-28 overflow-hidden">
      {/* Ambient glow, purely decorative */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 hidden sm:block -translate-x-1/2 w-[640px] h-[640px] rounded-full bg-primary/10 blur-3xl"
      />

      <div className="relative text-center max-w-3xl mx-auto space-y-5 sm:space-y-8">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-medium text-muted">
            Built on Arc · Powered by Circle
          </span>
        </Reveal>

        <Reveal delay={80}>
          <h1 className="text-[2rem] leading-tight sm:text-5xl lg:text-6xl font-semibold tracking-tight text-balance">
            Money without borders,{" "}
            <span className="text-primary">settled in stablecoins.</span>
          </h1>
        </Reveal>

        <Reveal delay={160}>
          <p className="text-base sm:text-lg text-muted leading-relaxed max-w-2xl mx-auto text-balance">
            UnitPay is the stablecoin payments layer collapsing fragmented financial rails
            across Africa and cross-border trade into one platform — a self-custodied USDC
            wallet, on/off-ramp, and settlement infrastructure built on Arc.
          </p>
        </Reveal>

        <Reveal delay={240}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <LinkButton href="/onboarding/wallet" size="lg" className="w-full sm:w-auto">
              Set Up Your Wallet
              <ArrowRight className="w-4 h-4" />
            </LinkButton>
            <LinkButton
              href="#products"
              variant="secondary"
              size="lg"
              className="w-full sm:w-auto"
            >
              Explore the Platform
            </LinkButton>
          </div>
        </Reveal>
      </div>

      <Reveal delay={320} className="mt-10 sm:mt-20">
        <div className="max-w-2xl mx-auto rounded-2xl sm:rounded-3xl border border-border bg-surface/60 px-3 py-5 sm:px-10 sm:py-10">
          <RailFlow />
        </div>
      </Reveal>
    </Section>
  );
}
