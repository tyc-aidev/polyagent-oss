export interface MarketSnapshot {
  id: string;
  slug: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  volume24h: number;
  liquidity: number;
  endDate?: string;
  resolved: boolean;
  outcome?: "YES" | "NO";
}