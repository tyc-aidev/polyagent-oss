import { steps } from "@/lib/landing-content";
import { Section, SectionHeading } from "./section";

export function LandingHowItWorks() {
  return (
    <Section id="how-it-works" className="space-y-10">
      <SectionHeading
        eyebrow="How it works"
        title="From market to backtest in four steps"
        description="A simple loop for discovering alphas and evaluating them against live and historical snapshots."
        align="center"
      />
      <ol className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((item) => (
          <li
            key={item.step}
            className="relative rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            <span className="mb-4 inline-flex size-9 items-center justify-center rounded-full bg-primary-muted text-sm font-semibold text-primary ring-1 ring-primary/30">
              {item.step}
            </span>
            <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
