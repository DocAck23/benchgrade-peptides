import Link from "next/link";

const PRIMARY_NAV = [
  { href: "/catalog", label: "Catalog" },
  { href: "/compliance", label: "Compliance" },
  { href: "/shipping", label: "Shipping" },
  { href: "/about", label: "About" },
] as const;

export function Header() {
  return (
    <header className="border-b rule bg-[color:var(--color-paper)]">
      <div className="max-w-[1280px] mx-auto px-6 lg:px-10 py-6 flex items-center justify-between gap-8">
        <Link href="/" className="flex flex-col leading-none group">
          <span className="font-display text-2xl lg:text-3xl text-[color:var(--color-ink)] tracking-tight">
            Bench Grade
          </span>
          <span className="label-eyebrow text-[color:var(--color-ink-muted)] mt-1 group-hover:text-[color:var(--color-teal)] transition-colors">
            Peptides
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-10">
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-teal)] transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <Link
            href="/account"
            className="hidden md:inline-block text-sm text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-teal)] transition-colors"
          >
            Account
          </Link>
          <Link
            href="/cart"
            className="text-sm px-4 py-2 border rule text-[color:var(--color-ink)] hover:bg-[color:var(--color-paper-soft)] transition-colors"
          >
            Cart
          </Link>
        </div>
      </div>
    </header>
  );
}
