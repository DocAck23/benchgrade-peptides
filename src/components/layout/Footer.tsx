import Link from "next/link";
import { RUO_STATEMENTS } from "@/lib/compliance";

const FOOTER_COLUMNS = [
  {
    heading: "Catalog",
    links: [
      { href: "/catalog", label: "All compounds" },
      { href: "/catalog/growth-hormone-secretagogues", label: "GH secretagogues" },
      { href: "/catalog/tissue-repair", label: "Tissue-repair research" },
      { href: "/catalog/neuropeptides", label: "Neuropeptide research" },
      { href: "/catalog/metabolic", label: "Metabolic research" },
    ],
  },
  {
    heading: "Information",
    links: [
      { href: "/compliance", label: "Compliance & RUO" },
      { href: "/shipping", label: "Shipping & handling" },
      { href: "/payments", label: "Payment methods" },
      { href: "/coa", label: "Certificates of Analysis" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/terms", label: "Terms of Sale" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/contact", label: "Contact" },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="border-t rule bg-[color:var(--color-paper-soft)] mt-32">
      <div className="max-w-[1280px] mx-auto px-6 lg:px-10 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          <div className="col-span-2 md:col-span-1">
            <div className="font-display text-2xl text-[color:var(--color-ink)]">Bench Grade</div>
            <div className="label-eyebrow text-[color:var(--color-ink-muted)] mt-1">Peptides</div>
            <p className="mt-6 text-sm leading-relaxed text-[color:var(--color-ink-soft)] max-w-xs">
              Research-grade synthetic peptides for laboratory use. HPLC-verified, COA-per-lot, cold-chain shipped.
            </p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.heading}>
              <h3 className="label-eyebrow text-[color:var(--color-ink)] mb-4">{column.heading}</h3>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-teal)] transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <hr className="mt-14 mb-8 rule border-t" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <p className="text-xs text-[color:var(--color-ink-muted)] max-w-2xl leading-relaxed">
            {RUO_STATEMENTS.banner} Products are not drugs, supplements, or medical devices and are not
            approved by the FDA for any use other than laboratory research. By purchasing, customer certifies
            research use per our <Link href="/terms" className="underline decoration-[color:var(--color-rule)] hover:decoration-[color:var(--color-teal)]">Terms of Sale</Link>.
          </p>
          <p className="text-xs text-[color:var(--color-ink-muted)] whitespace-nowrap">
            © {new Date().getFullYear()} Bench Grade Peptides LLC
          </p>
        </div>
      </div>
    </footer>
  );
}
