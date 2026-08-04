import Link from "next/link";
import { footerLinks, site } from "@/lib/landing-content";

export function LandingFooter() {
  return (
    <footer className="border-t border-border px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm space-y-2">
          <p className="text-sm font-semibold text-primary">{site.name}</p>
          <p className="text-sm text-muted-foreground">{site.tagline}</p>
          <p className="text-xs text-muted-foreground/80">{site.disclaimer}</p>
        </div>
        <div className="flex flex-col gap-4 sm:items-end">
          <nav className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Footer">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <a
              href={site.github}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              GitHub
            </a>
          </nav>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {site.name}
          </p>
        </div>
      </div>
    </footer>
  );
}
