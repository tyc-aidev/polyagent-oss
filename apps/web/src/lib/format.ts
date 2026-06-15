export function formatUsd(value: number): string {
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}$${value.toFixed(2)}`;
}

export function formatPrice(value: number): string {
  return `${(value * 100).toFixed(1)}¢`;
}

export function formatDate(value: Date | string): string {
  return new Date(value).toLocaleString();
}