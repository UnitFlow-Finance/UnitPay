import { Clock, Landmark, TrendingDown, AlertTriangle } from "lucide-react";
import { Eyebrow, Section } from "./Section";
import { Reveal } from "./Reveal";

const PROBLEMS = [
  {
    icon: Landmark,
    stat: "Fragmented rails",
    body: "Businesses juggle separate bank accounts, card processors, and crypto exchanges just to move money across one corridor.",
  },
  {
    icon: Clock,
    stat: "2–5 days",
    body: "Typical settlement time for cross-border payouts through correspondent banking — capital sits idle in transit.",
  },
  {
    icon: TrendingDown,
    stat: "High cost",
    body: "FX spreads and intermediary fees quietly erode margins on every cross-border invoice and payout.",
  },
  {
    icon: AlertTriangle,
    stat: "Poor USDC access",
    body: "On/off-ramping stablecoins in and out of fiat is still slow, manual, or unavailable for most African users.",
  },
] as const;

export function ProblemSection() {
  return (
    <Section id="problem" className="py-16 sm:py-24">
      <Reveal className="max-w-2xl mx-auto text-center mb-12 sm:mb-16">
        <Eyebrow>The Problem</Eyebrow>
        <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight text-balance">
          Moving money across borders is still stuck in the past
        </h2>
      </Reveal>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {PROBLEMS.map(({ icon: Icon, stat, body }, i) => (
          <Reveal key={stat} delay={i * 80}>
            <div className="h-full rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-3 transition-colors hover:border-primary/40">
              <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <p className="font-semibold text-foreground">{stat}</p>
              <p className="text-sm text-muted leading-relaxed">{body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
