import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn("scroll-mt-24 px-6 py-16 sm:py-20", className)}>
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={cn("max-w-2xl space-y-3", align === "center" && "mx-auto text-center")}>
      {eyebrow ? (
        <p className="text-sm font-medium uppercase tracking-wider text-teal-400/90">{eyebrow}</p>
      ) : null}
      <h2 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">{title}</h2>
      {description ? <p className="text-base leading-relaxed text-zinc-400">{description}</p> : null}
    </div>
  );
}
