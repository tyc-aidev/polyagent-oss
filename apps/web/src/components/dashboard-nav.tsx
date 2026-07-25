"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/markets", label: "Markets" },
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
    <nav className="flex items-center gap-1 text-sm" aria-label="Main">
      <Link
        href="/"
        className={cn(
          "mr-4 font-semibold transition-colors",
          pathname === "/" ? "text-teal-300" : "text-teal-400 hover:text-teal-300",
        )}
      >
        PolyAgent OSS
      </Link>
      <ul className="flex items-center gap-1">
        {links.map((link) => {
          const active = isActivePath(pathname, link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center rounded-md px-3 py-1.5 font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
                  active
                    ? "bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
