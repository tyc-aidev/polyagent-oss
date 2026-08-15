export const dynamic = "force-dynamic";

import { listAlphaCatalog } from "@/lib/api/alphas";
import { AlphaLab } from "./alpha-lab";

export default function AlphasPage() {
  const alphas = listAlphaCatalog();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Alpha Lab</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Discover catalog alphas, inspect market features, and replay paper backtests against
          stored or imported snapshots.
        </p>
      </div>
      <AlphaLab alphas={alphas} />
    </div>
  );
}
