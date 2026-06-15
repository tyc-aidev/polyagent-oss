"use client";

import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";

export function MarketSearch({ initialQuery }: { initialQuery?: string }) {
  const router = useRouter();

  return (
    <Input
      className="max-w-xs"
      placeholder="Search markets..."
      defaultValue={initialQuery}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          const value = event.currentTarget.value.trim();
          router.push(value ? `/markets?q=${encodeURIComponent(value)}` : "/markets");
        }
      }}
    />
  );
}