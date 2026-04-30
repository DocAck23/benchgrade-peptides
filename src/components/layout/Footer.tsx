import Link from "next/link";
import Image from "next/image";
import { Logo } from "@/components/brand/Logo";
import { RUO_STATEMENTS } from "@/lib/compliance";
import { BRAND } from "@/lib/brand";
import { ROUTES } from "@/lib/routes";

/**
 * Sub-project A · Foundation, commit 12 of 22.
 *
 * v2 changes from v1:
 *   - BG monogram crest above the wordmark (Q5 lock: favicon + footer crest)
 *   - Lockup at v2 size="footer" (280 px) via the Pinyon-script PNG
 *   - Mobile column stack: 2 cols on mobile (sm), 4 cols at ≥1024 px
 *   - Tagline rewritten in v2 voice ("Synthesized in Tampa. Vialed in
 *     Orlando. HPLC-verified per lot."), in Glacial italic-style
 *   - Asset paths + brand name pulled from BRAND module
 *   - Route hrefs pulled from ROUTES (Foundation contract Rule 2)
 */

const FOOTER_COLUMNS = [
  {
    heading: "Catalog",
    links: [
      { href: ROUTES.CATALOG, label: "All compounds" },
      { href: ROUTES.CATEGORY("growth-hormone-secretagogues"), label: "GH secretagogues" },
      { href: ROUTES.CATEGORY("tissue-repair"), label: "Tissue-repair research" },
      { href: ROUTES.CATEGORY("neuropeptides"), label: "Neuropeptide research" },
      { href: ROUTES.CATEGORY("metabolic"), label: "Metabolic research" },
    ],
  },
  {
    heading: "Information",
    links: [
      { href: ROUTES.COMPLIANCE, label: "Compliance & RUO" },
      { href: ROUTES.SHIPPING, label: "Shipping & handling" },
      { href: ROUTES.PAYMENTS, label: "Payment methods" },
      { href: ROUTES.COA, label: "Certificates of Analysis" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: ROUTES.TERMS, label: "Terms of Sale" },
      { href: ROUTES.PRIVACY, label: "Privacy Policy" },
      { href: ROUTES.CONTACT, label: "Contact" },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer data-surface="wine" className="mt-32 border-t rule-wine">
      <div className="max-w-[1280px] mx-auto px-6 lg:px-10 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {/* Brand column — monogram crest stacks above the wordmark lockup. */}
          <div className="col-span-2 md:col-span-1 flex flex-col items-start">
            {/* BG monogram crest — Q5 lock. Sits above the wordmark like a wax seal. */}
            <Image
              src={BRAND.monogram}
              alt=""
              aria-hidden="true"
              width={80}
              height={80}
              className="block w-[clamp(56px,8vw,80px)] h-auto opacity-95 mb-4"
            />
            <Logo size="footer" surface="wine" asStatic />
            <p className="mt-6 max-w-xs text-base leading-relaxed font-editorial italic">
              {BRAND.tagline} HPLC-verified per lot.
            </p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.heading}>
              <h3
                className="font-ui uppercase text-[12px] tracking-[0.18em] mb-4 font-bold"
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
            approved by the FDA for any use other than laboratory research. By purchasing, the researcher certifies
            research use per our{" "}
            <Link
              href={ROUTES.TERMS}
              className="underline decoration-current/40 hover:decoration-current"
            >
              Terms of Sale
            </Link>
            .
          </p>
          <p className="text-xs whitespace-nowrap opacity-75">
            © {new Date().getFullYear()} {BRAND.legalName}
          </p>
        </div>
      </div>
    </footer>
  );
}
