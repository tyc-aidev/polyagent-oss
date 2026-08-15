"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const links = [
  { href: "/markets", label: "Markets" },
  { href: "/alphas", label: "Alphas" },
  { href: "/bots", label: "Bots" },
  { href: "/demo", label: "Demo" },
] as const;

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNav() {
  const pathname = usePathname() ?? "/";

  return (
    <nav className="flex items-center justify-between gap-4 text-sm" aria-label="Main">
      <div className="flex min-w-0 items-center gap-1">
        <Link
          href="/"
          className={cn(
            "mr-3 shrink-0 font-semibold tracking-tight transition-colors",
            pathname === "/"
              ? "text-primary"
              : "text-primary hover:opacity-90",
          )}
        >
          PolyAgent OSS
        </Link>
        <ul className="flex items-center gap-0.5 overflow-x-auto">
          {links.map((link) => {
            const active = isActivePath(pathname, link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center rounded-md px-3 py-1.5 font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    active
                      ? "bg-muted text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <ThemeToggle />
    </nav>
  );
}
