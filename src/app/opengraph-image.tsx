import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };
export const alt = "Bench Grade Peptides — research-grade synthetic peptides";

export default async function Image() {
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
        <div
          style={{
            fontSize: 22,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: "#4a4a4a",
          }}
        >
          Bench Grade Peptides
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 130,
              fontWeight: 700,
              lineHeight: 1.0,
              letterSpacing: -3,
              maxWidth: 1050,
            }}
          >
            Research-grade synthetic peptides.
          </div>
          <div style={{ fontSize: 34, color: "#4a4a4a", maxWidth: 900 }}>
            HPLC-verified. COA per lot. Cold-chain shipped. For laboratory research use only.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "ui-monospace, monospace",
            fontSize: 24,
            color: "#0A5C7D",
          }}
        >
          <span>benchgradepeptides.com</span>
          <span>56 compounds · ≥99% purity</span>
        </div>
      </div>
    ),
    size
  );
}
