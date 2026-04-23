import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1A1A1A",
          color: "#00A5B8",
          fontSize: 120,
          fontWeight: 700,
          fontFamily: "system-ui",
          letterSpacing: -4,
        }}
      >
        B
      </div>
    ),
    size
  );
}
