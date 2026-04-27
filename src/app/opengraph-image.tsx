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
  // Layout choices for messaging-card legibility:
  //   • Horizontal split (logo left, text right) — iMessage and WhatsApp
  //     rich-link cards crop hard from the top + bottom on phones, so a
  //     vertical stack ends up crushed. A side-by-side layout keeps the
  //     critical elements at full size even when the card is rendered
  //     at a small height.
  //   • Big, single primary line — at thumbnail size only one line of
  //     copy is actually readable.
  //   • No absolute-positioned footer — preview cards crop bottoms.
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
          padding: "48px 80px",
          background: "#4A0E1A",
          color: "#FDFAF1",
          fontFamily: "system-ui, serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo}
          width={280}
          height={280}
          alt=""
          style={{ display: "block", marginBottom: 24 }}
        />

        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: "#FDFAF1",
            letterSpacing: -1.5,
            lineHeight: 1.05,
            textAlign: "center",
            marginBottom: 22,
            maxWidth: 1000,
          }}
        >
          Research-grade synthetic peptides.
        </div>
        <div
          style={{
            fontSize: 28,
            color: "#D4C8A8",
            letterSpacing: 0.5,
            lineHeight: 1.35,
            textAlign: "center",
            maxWidth: 900,
          }}
        >
          HPLC-verified · COA per lot · Cold-chain shipped
        </div>
      </div>
    ),
    size
  );
}
