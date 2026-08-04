"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { MarketSnapshot } from "@polyagent/shared";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

type SortKey = "question" | "yesPrice" | "noPrice" | "volume24h" | "id";
type SortDir = "asc" | "desc";

const columns: { key: SortKey; label: string; className?: string; align?: "left" | "right" }[] = [
  { key: "question", label: "Market" },
  { key: "yesPrice", label: "YES", align: "right" },
  { key: "noPrice", label: "NO", align: "right" },
  { key: "volume24h", label: "Volume 24h", align: "right" },
  { key: "id", label: "ID", className: "font-mono" },
];

function compareMarkets(a: MarketSnapshot, b: MarketSnapshot, key: SortKey, dir: SortDir): number {
  const mul = dir === "asc" ? 1 : -1;
  const av = a[key];
  const bv = b[key];

  if (typeof av === "number" && typeof bv === "number") {
    return (av - bv) * mul;
  }

  return String(av).localeCompare(String(bv), undefined, { sensitivity: "base" }) * mul;
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) {
    return <ArrowUpDown className="size-3.5 opacity-50" aria-hidden />;
  }
  return dir === "asc" ? (
    <ArrowUp className="size-3.5 text-primary" aria-hidden />
  ) : (
    <ArrowDown className="size-3.5 text-primary" aria-hidden />
  );
}

export function MarketsTable({ markets }: { markets: MarketSnapshot[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("volume24h");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    return [...markets].sort((a, b) => compareMarkets(a, b, sortKey, sortDir));
  }, [markets, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "question" || key === "id" ? "asc" : "desc");
  }

  if (markets.length === 0) {
    return <p className="text-sm text-muted-foreground">No markets found.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {columns.map((col) => {
            const active = sortKey === col.key;
            return (
              <TableHead
                key={col.key}
                className={cn(col.align === "right" && "text-right", col.className)}
                aria-sort={
                  active ? (sortDir === "asc" ? "ascending" : "descending") : "none"
                }
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSort(col.key)}
                  className={cn(
                    "h-8 gap-1.5 px-2 font-medium uppercase tracking-wide",
                    col.align === "right" && "ml-auto",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {col.label}
                  <SortIcon active={active} dir={sortDir} />
                </Button>
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((market) => (
          <TableRow key={market.id}>
            <TableCell className="max-w-md py-3">
              <p className="font-medium text-foreground">{market.question}</p>
              <p className="text-xs text-muted-foreground">{market.slug}</p>
            </TableCell>
            <TableCell className="py-3 text-right tabular-nums text-success">
              {formatPrice(market.yesPrice)}
            </TableCell>
            <TableCell className="py-3 text-right tabular-nums text-destructive">
              {formatPrice(market.noPrice)}
            </TableCell>
            <TableCell className="py-3 text-right tabular-nums text-foreground">
              ${market.volume24h.toLocaleString()}
            </TableCell>
            <TableCell className="py-3 font-mono text-xs text-muted-foreground">
              {market.id}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
