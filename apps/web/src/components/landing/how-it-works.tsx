import { steps } from "@/lib/landing-content";
import { Section, SectionHeading } from "./section";

export function LandingHowItWorks() {
  return (
    <Section id="how-it-works" className="space-y-10">
      <SectionHeading
        eyebrow="How it works"
        title="From market to decision in three steps"
        description="A simple loop for evaluating agent strategies against live market snapshots."
        align="center"
      />
      <ol className="grid gap-6 md:grid-cols-3">
        {steps.map((item) => (
          <li
            key={item.step}
            className="relative rounded-xl border border-zinc-800 bg-zinc-900/40 p-6"
          >
            <span className="mb-4 inline-flex size-9 items-center justify-center rounded-full bg-teal-600/20 text-sm font-semibold text-teal-300 ring-1 ring-teal-500/30">
              {item.step}
            </span>
            <h3 className="text-lg font-semibold text-zinc-50">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{item.description}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
