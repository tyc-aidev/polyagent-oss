import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { hero, site } from "@/lib/landing-content";
import { Section } from "./section";

export function LandingHero() {
  return (
    <Section className="relative overflow-hidden pb-12 pt-20 sm:pb-16 sm:pt-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(20,184,166,0.18),transparent)]"
      />
      <div className="mx-auto max-w-3xl text-center">
        <p className="mb-4 inline-flex items-center rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs font-medium text-teal-300">
          {hero.eyebrow}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl sm:leading-tight">
          {hero.title}
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-zinc-400">{hero.subtitle}</p>
        <p className="mt-3 text-sm text-amber-200/80">{site.disclaimer}</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={hero.primaryCta.href}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-teal-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60 sm:w-auto"
          >
            {hero.primaryCta.label}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link
            href={hero.secondaryCta.href}
            className="inline-flex w-full items-center justify-center rounded-md border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-100 transition-colors hover:border-zinc-500 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50 sm:w-auto"
          >
            {hero.secondaryCta.label}
          </Link>
        </div>
      </div>
    </Section>
  );
}
