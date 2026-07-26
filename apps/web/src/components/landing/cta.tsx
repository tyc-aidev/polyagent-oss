import Link from "next/link";
import { cta } from "@/lib/landing-content";
import { Section } from "./section";

export function LandingCta() {
  return (
    <Section>
      <div className="relative overflow-hidden rounded-2xl border border-teal-500/20 bg-gradient-to-br from-teal-950/60 via-zinc-900 to-zinc-950 px-6 py-12 text-center sm:px-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(20,184,166,0.15),transparent_60%)]"
        />
        <div className="relative mx-auto max-w-xl space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            {cta.title}
          </h2>
          <p className="text-sm leading-relaxed text-zinc-400 sm:text-base">{cta.subtitle}</p>
          <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
            <Link
              href={cta.primaryCta.href}
              className="inline-flex w-full items-center justify-center rounded-md bg-teal-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-500 sm:w-auto"
            >
              {cta.primaryCta.label}
            </Link>
            <Link
              href={cta.secondaryCta.href}
              className="inline-flex w-full items-center justify-center rounded-md border border-zinc-600 px-5 py-2.5 text-sm font-medium text-zinc-100 transition-colors hover:border-zinc-400 hover:bg-zinc-900/80 sm:w-auto"
            >
              {cta.secondaryCta.label}
            </Link>
          </div>
        </div>
      </div>
    </Section>
  );
}
