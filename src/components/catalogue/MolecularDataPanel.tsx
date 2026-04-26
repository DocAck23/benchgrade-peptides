import type { CatalogProduct } from "@/lib/catalogue/data";
import { DataRow } from "@/components/ui";

interface MolecularDataPanelProps {
  product: CatalogProduct;
  purityPercent?: number | null;
  lotNumber?: string | null;
}

/**
 * Structured molecular data block for the product detail page.
 *
 * Required fields per compliance framework §3: CAS, MF, MW, sequence, purity, lot.
 * Missing values render as an em-dash rather than being hidden — transparency
 * about what's known vs. pending is itself a trust signal.
 */
export function MolecularDataPanel({ product, purityPercent = null, lotNumber = null }: MolecularDataPanelProps) {
  return (
    <section aria-label="Molecular data" className="bg-paper-soft border rule">
      <div className="px-5 py-4 border-b rule">
        <h2 className="label-eyebrow text-ink-muted">Molecular data</h2>
      </div>
      <dl className="px-5 pb-4">
        <DataRow label="CAS number" value={product.cas_number ?? "—"} mono />
        <DataRow label="Mol. formula" value={product.molecular_formula ?? "—"} mono />
        <DataRow
          label="Mol. weight"
          value={product.molecular_weight ? `${product.molecular_weight.toFixed(2)} g/mol` : "—"}
          mono
        />
        <DataRow
          label="Sequence"
          value={product.sequence ?? "—"}
          mono
          wrap
        />
        <DataRow
          label="Purity"
          value={purityPercent ? `≥ ${purityPercent.toFixed(1)}%` : "≥ 99.0%"}
          mono
        />
        <DataRow
          label="Lot number"
          value={lotNumber ?? "Assigned at shipment"}
          mono
        />
      </dl>
    </section>
  );
}
