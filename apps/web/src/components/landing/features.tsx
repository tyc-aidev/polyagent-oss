import {
  Bot,
  CalendarClock,
  ChartLine,
  HardDrive,
  ListTree,
  Store,
} from "lucide-react";
import { features } from "@/lib/landing-content";
import { Section, SectionHeading } from "./section";

const icons = [Bot, ChartLine, Store, CalendarClock, ListTree, HardDrive];

export function LandingFeatures() {
  return (
    <Section id="features" className="space-y-10">
      <SectionHeading
        eyebrow="Features"
        title="Everything you need to experiment with market bots"
        description="From market discovery to scheduled ticks and decision history — built for paper trading research."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, index) => {
          const Icon = icons[index % icons.length];
          return (
            <article
              key={feature.title}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 transition-colors hover:border-zinc-700 hover:bg-zinc-900/70"
            >
              <div className="mb-3 inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-2 text-teal-400">
                <Icon className="size-5" aria-hidden />
              </div>
              <h3 className="text-base font-semibold text-zinc-50">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{feature.description}</p>
            </article>
          );
        })}
      </div>
    </Section>
  );
}
