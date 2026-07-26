import { ArrowRight, CheckCircle2 } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { Eyebrow, Section } from "./Section";
import { Reveal } from "./Reveal";

const CODE_SNIPPET = `import { UnitPay } from "@unitpay/sdk";

const unitpay = new UnitPay({ apiKey: process.env.UNITPAY_KEY });

const payment = await unitpay.payments.create({
  amount: "250.00",
  currency: "USDC",
  chain: "arc",
  destination: merchant.walletAddress,
});

// Gasless, settled in seconds.
console.log(payment.status); // "confirmed"`;

const CHECKLIST = [
  "REST API + SDKs for wallets, transfers, and settlement",
  "Webhooks for real-time payment status",
  "Sandbox on Arc Testnet — no production keys required to start",
];

export function BuildersSection() {
  return (
    <Section id="builders" className="py-16 sm:py-24">
      <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <Reveal>
          <Eyebrow>Built for Builders</Eyebrow>
          <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight text-balance mb-4">
            Plug UnitPay into your business
          </h2>
          <p className="text-muted leading-relaxed mb-6">
            Accept and send USDC payments from your own product with a few lines of code.
            Whether you&apos;re a fintech, marketplace, or payroll platform — UnitPay&apos;s API
            gives you the same rails powering the wallet.
          </p>

          <ul className="space-y-3 mb-8">
            {CHECKLIST.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-muted">
                <CheckCircle2 className="w-4.5 h-4.5 text-primary shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col sm:flex-row gap-3">
            <LinkButton href="https://docs.unitflow.finance" size="lg">
              View Developer Docs
              <ArrowRight className="w-4 h-4" />
            </LinkButton>
            <LinkButton href="/onboarding/wallet" variant="secondary" size="lg">
              Get API Access
            </LinkButton>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="rounded-2xl border border-border bg-[#0b0d13] overflow-hidden shadow-lg shadow-black/20">
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border/60">
              <span className="w-2.5 h-2.5 rounded-full bg-error/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-warning/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-success/70" />
              <span className="ml-2 text-xs text-subtle font-mono">payment.ts</span>
            </div>
            <pre className="p-4 sm:p-5 overflow-x-auto text-[12px] sm:text-[13px] leading-relaxed font-mono text-foreground/90">
              <code>{CODE_SNIPPET}</code>
            </pre>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
