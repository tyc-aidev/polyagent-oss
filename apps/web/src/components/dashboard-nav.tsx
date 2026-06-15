import Link from "next/link";

const links = [
  { href: "/markets", label: "Markets" },
  { href: "/bots", label: "Bots" },
  { href: "/demo", label: "Demo" },
];

export function DashboardNav() {
  return (
    <nav className="flex items-center gap-6 text-sm">
      <Link href="/" className="font-semibold text-teal-400">
        PolyAgent OSS
      </Link>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="text-zinc-300 hover:text-white transition-colors"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}