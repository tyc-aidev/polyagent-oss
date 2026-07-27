import { stats } from "@/lib/landing-content";
import { Section } from "./section";

export function LandingStats() {
  return (
    <Section className="py-10 sm:py-12">
      <div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-6 shadow-sm sm:grid-cols-4 sm:gap-6">
        {stats.map((item) => (
          <div key={item.label} className="text-center sm:text-left">
            <p className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {item.value}
            </p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}
