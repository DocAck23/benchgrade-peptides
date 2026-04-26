import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { RUO_STATEMENTS } from "@/lib/compliance";

const FOOTER_COLUMNS = [
  {
    heading: "Catalogue",
    links: [
      { href: "/catalogue", label: "All compounds" },
      { href: "/catalogue/growth-hormone-secretagogues", label: "GH secretagogues" },
      { href: "/catalogue/tissue-repair", label: "Tissue-repair research" },
      { href: "/catalogue/neuropeptides", label: "Neuropeptide research" },
      { href: "/catalogue/metabolic", label: "Metabolic research" },
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

/**
 * Site footer — wine surface (spec §16.1).
 *
 * The wrapper sets `data-surface="wine"` so globals.css `[data-surface="wine"]`
 * handles bg / text / link / hr inversion declaratively. We do not duplicate
 * those styles here — only typography and layout overrides.
 */
export function Footer() {
  return (
    <footer data-surface="wine" className="mt-32 border-t rule-wine">
      <div className="max-w-[1280px] mx-auto px-6 lg:px-10 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          <div className="col-span-2 md:col-span-1">
            <Logo variant="mark" surface="wine" size="lg" />
            <p
              className="mt-6 max-w-xs text-base leading-relaxed italic"
              style={{ fontFamily: "var(--font-editorial)" }}
            >
              Premium research-grade synthetic peptides. HPLC-verified, COA-per-lot,
              cold-chain shipped.
            </p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.heading}>
              <h3
                className="font-display uppercase text-[12px] tracking-[0.18em] mb-4"
                style={{ color: "var(--color-gold-light)" }}
              >
                {column.heading}
              </h3>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm transition-colors duration-200 ease-out hover:opacity-80"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <hr className="mt-14 mb-8 border-t" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <p className="text-sm sm:text-[15px] max-w-3xl leading-relaxed opacity-95 font-medium">
            {RUO_STATEMENTS.banner} Products are not drugs, supplements, or medical devices and are not
            approved by the FDA for any use other than laboratory research. By purchasing, customer certifies
            research use per our{" "}
            <Link
              href="/terms"
              className="underline decoration-current/40 hover:decoration-current"
            >
              Terms of Sale
            </Link>
            .
          </p>
          <p className="text-xs whitespace-nowrap opacity-75">
            © {new Date().getFullYear()} Bench Grade Peptides LLC
          </p>
        </div>
      </div>
    </footer>
  );
}
