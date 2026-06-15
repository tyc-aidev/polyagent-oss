import { DashboardNav } from "@/components/dashboard-nav";
import { DisclaimerBanner } from "@/components/disclaimer-banner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4 space-y-4">
        <DashboardNav />
        <DisclaimerBanner />
      </header>
      <main className="px-6 py-8">{children}</main>
    </div>
  );
}