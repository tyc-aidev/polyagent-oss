import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hero, site } from "@/lib/landing-content";
import { Section } from "./section";

export function LandingHero() {
  return (
    <Section className="relative overflow-hidden pb-12 pt-16 sm:pb-16 sm:pt-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,var(--primary-muted),transparent)]"
      />
      <div className="mx-auto max-w-3xl text-center">
        <p className="mb-4 inline-flex items-center rounded-full border border-primary/30 bg-primary-muted px-3 py-1 text-xs font-medium text-primary">
          {hero.eyebrow}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl sm:leading-tight">
          {hero.title}
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{hero.subtitle}</p>
        <p className="mt-3 text-sm text-warning-foreground/90">{site.disclaimer}</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href={hero.primaryCta.href} className="w-full sm:w-auto">
            <Button size="lg" className="w-full gap-2 sm:w-auto">
              {hero.primaryCta.label}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </Link>
          <Link href={hero.secondaryCta.href} className="w-full sm:w-auto">
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              {hero.secondaryCta.label}
            </Button>
          </Link>
        </div>
      </div>
    </Section>
  );
}
