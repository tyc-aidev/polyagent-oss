import { DashboardNav } from "@/components/dashboard-nav";
import { DisclaimerBanner } from "@/components/disclaimer-banner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl space-y-3 px-6 py-4">
          <DashboardNav />
          <DisclaimerBanner />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
