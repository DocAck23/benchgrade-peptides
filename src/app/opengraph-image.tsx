import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };
export const alt = "Bench Grade Peptides — research-grade synthetic peptides";

async function logoDataUrl() {
  const bytes = await readFile(
    path.join(process.cwd(), "public/brand/logo-mark-gold.png")
  );
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

export default async function Image() {
  const logo = await logoDataUrl();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 80,
          background: "#4A0E1A",
          color: "#FDFAF1",
          fontFamily: "system-ui, serif",
        }}
      >
        <div
          style={{
            fontSize: 18,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#B89254",
            marginBottom: 28,
          }}
        >
          Made in USA · Verified per lot
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo}
          width={300}
          height={300}
          alt=""
          style={{ display: "block", marginBottom: 28 }}
        />

        <div
          style={{
            fontSize: 56,
            color: "#FDFAF1",
            letterSpacing: -1,
            textAlign: "center",
            maxWidth: 980,
            lineHeight: 1.15,
            marginBottom: 18,
          }}
        >
          Research-grade synthetic peptides.
        </div>
        <div
          style={{
            fontSize: 24,
            color: "#D4C8A8",
            letterSpacing: 1,
            textAlign: "center",
            maxWidth: 880,
            lineHeight: 1.4,
          }}
        >
          HPLC-verified · COA per lot · Cold-chain shipped
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 36,
            display: "flex",
            alignItems: "center",
            gap: 18,
            fontFamily: "ui-monospace, monospace",
            fontSize: 18,
            color: "#B89254",
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          benchgradepeptides.com
        </div>
      </div>
    ),
    size
  );
}
