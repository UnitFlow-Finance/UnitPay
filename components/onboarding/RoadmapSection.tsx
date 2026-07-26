import { Landmark, Layers3, Store, Globe } from "lucide-react";
import { Eyebrow, Section } from "./Section";
import { Reveal } from "./Reveal";

const ROADMAP_ITEMS = [
  {
    icon: Globe,
    title: "Expanded fiat corridors",
    description: "On/off-ramp support beyond just one! — more African currencies, more local rails.",
  },
  {
    icon: Landmark,
    title: "More banking rails",
    description: "Direct bank transfer and card integrations layered on top of existing ramps.",
  },
  {
    icon: Layers3,
    title: "More chains",
    description: "Broader CCTP and Gateway coverage as Circle adds support for new networks.",
  },
  {
    icon: Store,
    title: "Merchant tools",
    description: "Invoicing, recurring payments, and settlement reporting for businesses.",
  },
] as const;

export function RoadmapSection() {
  return (
    <Section id="roadmap" className="py-16 sm:py-24">
      <Reveal className="max-w-2xl mx-auto text-center mb-12 sm:mb-16">
        <Eyebrow>Coming Soon</Eyebrow>
        <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight text-balance">
          What&apos;s next for UnitPay
        </h2>
      </Reveal>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {ROADMAP_ITEMS.map(({ icon: Icon, title, description }, i) => (
          <Reveal key={title} delay={i * 80}>
            <div className="h-full rounded-2xl border border-dashed border-border bg-surface/40 p-5 sm:p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-surface-elevated flex items-center justify-center">
                <Icon className="w-5 h-5 text-accent" />
              </div>
              <p className="font-semibold text-foreground">{title}</p>
              <p className="text-sm text-muted leading-relaxed">{description}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
