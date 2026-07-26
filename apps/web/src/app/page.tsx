import type { Metadata } from "next";
import { LandingCta } from "@/components/landing/cta";
import { LandingFaq } from "@/components/landing/faq";
import { LandingFeatures } from "@/components/landing/features";
import { LandingFooter } from "@/components/landing/footer";
import { LandingHero } from "@/components/landing/hero";
import { LandingHowItWorks } from "@/components/landing/how-it-works";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingStats } from "@/components/landing/stats";
import { site } from "@/lib/landing-content";

export const metadata: Metadata = {
  title: "Paper trading for prediction-market agents",
  description: site.description,
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <LandingNavbar />
      <main>
        <LandingHero />
        <LandingStats />
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingFaq />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
