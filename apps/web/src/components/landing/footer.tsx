import Link from "next/link";
import { footerLinks, site } from "@/lib/landing-content";

export function LandingFooter() {
  return (
    <footer className="border-t border-zinc-800 px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm space-y-2">
          <p className="text-sm font-semibold text-teal-400">{site.name}</p>
          <p className="text-sm text-zinc-500">{site.tagline}</p>
          <p className="text-xs text-zinc-600">{site.disclaimer}</p>
        </div>
        <div className="flex flex-col gap-4 sm:items-end">
          <nav className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Footer">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
              >
                {link.label}
              </Link>
            ))}
            <a
              href={site.github}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
            >
              GitHub
            </a>
          </nav>
          <p className="text-xs text-zinc-600">© {new Date().getFullYear()} {site.name}</p>
        </div>
      </div>
    </footer>
  );
}
