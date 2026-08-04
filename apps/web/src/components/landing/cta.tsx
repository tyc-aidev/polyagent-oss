import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cta } from "@/lib/landing-content";
import { Section } from "./section";

export function LandingCta() {
  return (
    <Section>
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card px-6 py-12 text-center shadow-sm sm:px-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--primary-muted),transparent_60%)]"
        />
        <div className="relative mx-auto max-w-xl space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {cta.title}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{cta.subtitle}</p>
          <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
            <Link href={cta.primaryCta.href} className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto">
                {cta.primaryCta.label}
              </Button>
            </Link>
            <Link href={cta.secondaryCta.href} className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                {cta.secondaryCta.label}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </Section>
  );
}
