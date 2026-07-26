import { Eyebrow, Section } from "./Section";
import { Reveal } from "./Reveal";

const CONVERGING_RAILS = [
  "Payment rails",
  "Blockchain networks",
  "Fiat corridors",
  "Banking infrastructure",
] as const;

export function VisionSection() {
  return (
    <Section id="vision" className="py-16 sm:py-24">
      <div className="rounded-3xl border border-border bg-gradient-to-b from-surface to-surface/40 px-6 py-14 sm:px-12 sm:py-20 text-center overflow-hidden relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(20,184,166,0.08),transparent_60%)]"
        />

        <Reveal className="relative max-w-2xl mx-auto">
          <Eyebrow>Long-Term Vision</Eyebrow>
          <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight text-balance mb-6">
            One platform for every rail money moves on
          </h2>
          <p className="text-base sm:text-lg text-muted leading-relaxed">
            UnitPay&apos;s mission is to collapse fragmented financial workflows by giving
            businesses and users access to multiple payment rails, blockchain networks, fiat
            corridors, and banking infrastructure — through a single platform.
          </p>
        </Reveal>

        {/* Converging rails visual: separate inputs merging into one node */}
        <Reveal delay={140} className="relative mt-12 sm:mt-16 max-w-2xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {CONVERGING_RAILS.map((rail) => (
              <div
                key={rail}
                className="rounded-xl border border-border bg-surface-elevated px-3 py-3 text-xs sm:text-sm font-medium text-muted"
              >
                {rail}
              </div>
            ))}
          </div>
          <div className="flex justify-center">
            <svg width="2" height="28" className="text-border" aria-hidden>
              <line x1="1" y1="0" x2="1" y2="28" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary text-white px-5 py-2.5 text-sm font-semibold soft-pulse">
              UnitPay
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
