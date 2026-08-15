import {
  Bot,
  CalendarClock,
  ChartLine,
  FlaskConical,
  HardDrive,
  ListTree,
  Store,
} from "lucide-react";
import { features } from "@/lib/landing-content";
import { Section, SectionHeading } from "./section";

const icons = [Bot, ChartLine, Store, FlaskConical, CalendarClock, ListTree, HardDrive];

export function LandingFeatures() {
  return (
    <Section id="features" className="space-y-10">
      <SectionHeading
        eyebrow="Features"
        title="Everything you need to experiment with market bots"
        description="From market discovery and catalog alphas to scheduled ticks and decision history — built for paper trading research."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, index) => {
          const Icon = icons[index % icons.length];
          return (
            <article
              key={feature.title}
              className="rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/30 hover:bg-card"
            >
              <div className="mb-3 inline-flex rounded-lg border border-border bg-primary-muted p-2 text-primary">
                <Icon className="size-5" aria-hidden />
              </div>
              <h3 className="text-base font-semibold text-foreground">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </article>
          );
        })}
      </div>
    </Section>
  );
}
