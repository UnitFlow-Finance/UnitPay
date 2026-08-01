import { CreditCard, HandCoins, QrCode, UsersRound, WalletCards, Workflow } from "lucide-react";
import { Eyebrow, Section } from "./Section";
import { Reveal } from "./Reveal";

const UPDATES = [
  {
    icon: HandCoins,
    title: "On-chain P2P marketplace",
    body: "Buy or sell USDC with bank transfer, mobile money, gift cards, bill payments, and other local settlement methods.",
  },
  {
    icon: WalletCards,
    title: "Reusable payout details",
    body: "Save multiple payout accounts per payment method and auto-attach the right one when selling USDC.",
  },
  {
    icon: CreditCard,
    title: "Virtual Mastercard controls",
    body: "Create cards, fund from Gateway balance, freeze spending, copy masked details, and prepare cards for AI-agent policies.",
  },
  {
    icon: QrCode,
    title: "Universal QR flow",
    body: "Scan with camera or upload QR images for wallet IDs, payment links, pods, profiles, and P2P offers.",
  },
  {
    icon: UsersRound,
    title: "Collaborative pods",
    body: "Pool contributions toward shared expenses, donations, purchases, or payment-link funding goals.",
  },
  {
    icon: Workflow,
    title: "Gateway-first settlement",
    body: "Use unified Gateway balances, cross-chain deposits, and linked payment workflows from one dashboard.",
  },
] as const;

export function LatestUpdatesSection() {
  return (
    <Section id="latest" className="py-16 sm:py-24">
      <Reveal className="max-w-2xl mx-auto text-center mb-10 sm:mb-14">
        <Eyebrow>Latest Platform Updates</Eyebrow>
        <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight text-balance">
          More payment paths, fewer manual steps
        </h2>
        <p className="text-sm sm:text-base text-muted leading-relaxed mt-3">
          UnitPay now connects P2P, Gateway, QR, pods, and virtual cards into a tighter operating surface for everyday stablecoin payments.
        </p>
      </Reveal>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {UPDATES.map(({ icon: Icon, title, body }, index) => (
          <Reveal key={title} delay={index * 60}>
            <div className="h-full rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-4 hover:border-primary/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{title}</p>
                <p className="text-sm text-muted leading-relaxed mt-2">{body}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
