"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { navLinks, site } from "@/lib/landing-content";
import { cn } from "@/lib/utils";

export function LandingNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-teal-400 transition-colors hover:text-teal-300"
        >
          {site.name}
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Landing">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/login"
            className="rounded-md px-3 py-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100"
          >
            Sign in
          </Link>
          <Link
            href="/markets"
            className="inline-flex items-center justify-center rounded-md bg-teal-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60"
          >
            Open dashboard
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-zinc-300 hover:bg-zinc-900 md:hidden"
          aria-expanded={open}
          aria-controls="landing-mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      <div
        id="landing-mobile-nav"
        className={cn(
          "border-t border-zinc-800 bg-zinc-950 md:hidden",
          open ? "block" : "hidden",
        )}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-6 py-4">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <Link
            href="/login"
            className="rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
            onClick={() => setOpen(false)}
          >
            Sign in
          </Link>
          <Link
            href="/markets"
            className="mt-2 inline-flex items-center justify-center rounded-md bg-teal-600 px-3.5 py-2.5 text-sm font-medium text-white hover:bg-teal-500"
            onClick={() => setOpen(false)}
          >
            Open dashboard
          </Link>
        </div>
      </div>
    </header>
  );
}
