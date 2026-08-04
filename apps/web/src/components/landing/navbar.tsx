"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { navLinks, site } from "@/lib/landing-content";
import { cn } from "@/lib/utils";

export function LandingNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-primary transition-opacity hover:opacity-90"
        >
          {site.name}
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Landing">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-1 md:flex">
          <ThemeToggle />
          <Link
            href="/login"
            className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
          <Link href="/markets">
            <Button size="sm">Open dashboard</Button>
          </Link>
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-expanded={open}
            aria-controls="landing-mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      <div
        id="landing-mobile-nav"
        className={cn("border-t border-border bg-background md:hidden", open ? "block" : "hidden")}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-6 py-4">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <Link
            href="/login"
            className="rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
            onClick={() => setOpen(false)}
          >
            Sign in
          </Link>
          <Link href="/markets" onClick={() => setOpen(false)} className="mt-2">
            <Button className="w-full">Open dashboard</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
