import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/**
 * Favicon — at 32px the laurel mark from the full logo is illegible,
 * so we use a simplified BG monogram in brand gold on a wine field.
 * Visible against both the dark Safari/Chrome tab bar and the cream
 * pinned-tab tray.
 */
export default function Icon() {
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
          color: "#B89254",
          fontSize: 38,
          fontWeight: 700,
          fontFamily: "Georgia, 'Times New Roman', serif",
          letterSpacing: -1,
          lineHeight: 1,
        }}
      >
        B
      </div>
    ),
    size
  );
}
