import type { Metadata } from "next";
import { LandingHeader } from "@/components/onboarding/LandingHeader";
import { Hero } from "@/components/onboarding/Hero";
import { ProblemSection } from "@/components/onboarding/ProblemSection";
import { SolutionSection } from "@/components/onboarding/SolutionSection";
import { BuildersSection } from "@/components/onboarding/BuildersSection";
import { RoadmapSection } from "@/components/onboarding/RoadmapSection";
import { VisionSection } from "@/components/onboarding/VisionSection";
import { FinalCta } from "@/components/onboarding/FinalCta";
import { LandingFooter } from "@/components/onboarding/LandingFooter";

export const metadata: Metadata = {
  title: "UnitPay — Stablecoin Payments Infrastructure, Built on Arc",
  description:
    "UnitPay is the stablecoin payments layer collapsing fragmented financial rails across Africa and cross-border trade into one platform.",
};

/**
 * `/onboarding` — UnitPay's front door. A product-page-style landing
 * experience: positioning, problem/solution, developer story, roadmap, and
 * long-term vision, all converging on a "Create Your Wallet" CTA that hands
 * off to the actual wallet-creation flow at `/onboarding/wallet`.
 */
export default function OnboardingLandingPage() {
  return (
    <div className="min-h-full flex flex-col">
      <LandingHeader />
      <main className="flex-1">
        <Hero />
        <ProblemSection />
        <SolutionSection />
        <BuildersSection />
        <RoadmapSection />
        <VisionSection />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
