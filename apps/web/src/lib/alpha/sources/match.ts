/**
 * Optional name/time heuristic for FeatureSources that cannot bind an explicit
 * Gamma marketId. Prefer explicit ids; this is a fallback only.
 */
export function scoreMarketNameMatch(question: string, names: string[]): number {
  const haystack = question.toLowerCase();
  let hits = 0;
  for (const name of names) {
    const needle = name.trim().toLowerCase();
    if (needle.length > 0 && haystack.includes(needle)) hits += 1;
  }
  return hits;
}

export function isNearStartTime(
  marketEndDate: string | undefined,
  eventStart: Date,
  windowMs = 6 * 60 * 60 * 1000,
): boolean {
  if (!marketEndDate) return false;
  const end = Date.parse(marketEndDate);
  if (!Number.isFinite(end)) return false;
  return Math.abs(end - eventStart.getTime()) <= windowMs;
}
