import { ArrowRight } from "lucide-react";
import { DiscordIcon } from "@/components/icons/SocialIcons";
import { LinkButton } from "@/components/ui/Button";
import { Reveal } from "./Reveal";
import { Section } from "./Section";

export function FinalCta() {
  return (
    <Section className="py-16 sm:py-24">
      <Reveal className="text-center max-w-2xl mx-auto space-y-6">
        <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight text-balance">
          Ready to move money without borders?
        </h2>
        <p className="text-muted leading-relaxed">
          Set up your self-custodied wallet in minutes — no seed phrase, no paperwork.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <LinkButton href="/onboarding/wallet" size="lg" className="w-full sm:w-auto">
            Create Your Wallet
            <ArrowRight className="w-4 h-4" />
          </LinkButton>
          <LinkButton
            href="https://discord.gg/CCw46AqS7"
            variant="secondary"
            size="lg"
            className="w-full sm:w-auto"
          >
            <DiscordIcon className="w-4 h-4" />
            Talk to us
          </LinkButton>
        </div>
        <p className="text-xs text-subtle">
          Already have a wallet?{" "}
          <a href="/onboarding/login" className="text-accent hover:underline">
            Log in
          </a>
          . Join the conversation on{" "}
          <a
            href="https://x.com/UnitFlowFinance"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            X
          </a>{" "}
          or{" "}
          <a
            href="https://discord.gg/CCw46AqS7"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            Discord
          </a>
          .
        </p>
      </Reveal>
    </Section>
  );
}
