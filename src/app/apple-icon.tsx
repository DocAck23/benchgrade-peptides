import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

async function logoDataUrl() {
  const bytes = await readFile(
    path.join(process.cwd(), "public/brand/logo-mark-gold.png")
  );
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

/**
 * Apple touch icon — 180×180, used as the iOS home-screen "app" icon
 * and the iOS share-sheet thumbnail. The full laurel + wordmark logo
 * is legible at this size, so we render the actual brand mark on a
 * wine field rather than a monogram.
 */
export default async function AppleIcon() {
  const logo = await logoDataUrl();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#4A0E1A",
          padding: 16,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo}
          width={148}
          height={148}
          alt=""
          style={{ display: "block" }}
        />
      </div>
    ),
    size
  );
}
