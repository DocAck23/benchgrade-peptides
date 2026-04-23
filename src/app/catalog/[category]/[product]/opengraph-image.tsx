import { ImageResponse } from "next/og";
import { getProductBySlug } from "@/lib/catalog/data";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

interface PageProps {
  params: Promise<{ category: string; product: string }>;
}

export default async function Image({ params }: PageProps) {
  const { product: productSlug } = await params;
  const product = getProductBySlug(productSlug);
  if (!product) {
    return new ImageResponse(
      (
        <div style={fallbackStyle}>
          <div style={{ fontSize: 64, fontWeight: 700 }}>Bench Grade Peptides</div>
        </div>
      ),
      size
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#F7F4EE",
          color: "#1A1A1A",
          fontFamily: "system-ui",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 22, letterSpacing: 4, textTransform: "uppercase", color: "#4a4a4a" }}>
            Bench Grade Peptides · Research Use Only
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {product.molecular_formula && (
            <div style={{ fontSize: 28, fontFamily: "ui-monospace, monospace", color: "#4a4a4a" }}>
              {product.molecular_formula}
            </div>
          )}
          <div style={{ fontSize: 120, fontWeight: 700, lineHeight: 1.0, letterSpacing: -2 }}>
            {product.name}
          </div>
          <div style={{ fontSize: 32, color: "#4a4a4a", maxWidth: 900, lineHeight: 1.3 }}>
            {product.summary.length > 140 ? product.summary.slice(0, 137) + "..." : product.summary}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            fontFamily: "ui-monospace, monospace",
            fontSize: 24,
            color: "#0A5C7D",
          }}
        >
          <span>HPLC ≥99% · COA per lot</span>
          <span>
            from ${Math.min(...product.variants.map((v) => v.retail_price)).toFixed(2)}
          </span>
        </div>
      </div>
    ),
    size
  );
}

const fallbackStyle = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#F7F4EE",
  color: "#1A1A1A",
  fontFamily: "system-ui",
} as const;
