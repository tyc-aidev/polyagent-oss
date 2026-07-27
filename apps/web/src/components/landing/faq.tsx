import { faqs } from "@/lib/landing-content";
import { Section, SectionHeading } from "./section";

export function LandingFaq() {
  return (
    <Section id="faq" className="space-y-10">
      <SectionHeading
        eyebrow="FAQ"
        title="Questions and answers"
        description="Straight answers about paper trading, data, and deployment."
      />
      <div className="divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
        {faqs.map((item) => (
          <details key={item.question} className="group px-5 py-1">
            <summary className="cursor-pointer list-none py-4 text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-4">
                {item.question}
                <span className="text-muted-foreground transition-transform group-open:rotate-45">
                  +
                </span>
              </span>
            </summary>
            <p className="pb-4 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
