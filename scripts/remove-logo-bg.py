#!/usr/bin/env python3
"""
Strip the warm-paper background from the logo JPEG and emit a transparent PNG.

Approach:
    1. Open the source JPEG.
    2. Sample the background color from the four corners (and average them —
       robust to JPEG compression noise).
    3. For each pixel, compute its distance from the background color.
    4. Pixels within `tolerance` RGB units go fully transparent.
    5. Pixels close to the edge of the tolerance band get a graded alpha for
       anti-aliasing, so the text edges stay smooth.
    6. Save as PNG with a proper alpha channel.

Run:
    python3 scripts/remove-logo-bg.py

Produces:
    public/brand/logo-full.png  (transparent background)
"""
from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("error: Pillow not installed. pip install Pillow", file=sys.stderr)
    sys.exit(1)


ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "brand" / "logo-full.jpg"
OUT = ROOT / "public" / "brand" / "logo-full.png"

# RGB Euclidean distance (max 441.7 for pure black->pure white). Tuned by eye
# for this specific JPEG.
HARD_TRANSPARENT = 35  # pixels closer than this become fully transparent
FEATHER = 18           # graded alpha band beyond the hard cutoff for smooth edges


def color_distance(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    dr = a[0] - b[0]
    dg = a[1] - b[1]
    db = a[2] - b[2]
    # L2 norm
    return (dr * dr + dg * dg + db * db) ** 0.5


def main() -> None:
    if not SRC.exists():
        print(f"error: source file not found: {SRC}", file=sys.stderr)
        sys.exit(1)

    img = Image.open(SRC).convert("RGBA")
    w, h = img.size
    pixels = img.load()
    assert pixels is not None

    # Sample four corners + midpoints of edges for a robust background estimate
    sample_points = [
        (0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
        (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2),
    ]
    samples = [pixels[x, y][:3] for x, y in sample_points]
    bg_r = sum(s[0] for s in samples) / len(samples)
    bg_g = sum(s[1] for s in samples) / len(samples)
    bg_b = sum(s[2] for s in samples) / len(samples)
    bg = (bg_r, bg_g, bg_b)

    print(f"source: {SRC.name} ({w}x{h})")
    print(f"estimated background: rgb({bg_r:.0f}, {bg_g:.0f}, {bg_b:.0f})")

    # Rebuild the image with per-pixel alpha
    new_pixels: list[tuple[int, int, int, int]] = []
    transparent_count = 0
    feathered_count = 0
    total = w * h
    for y in range(h):
        for x in range(w):
            r, g, b, _ = pixels[x, y]
            dist = color_distance((r, g, b), bg)
            if dist <= HARD_TRANSPARENT:
                new_pixels.append((r, g, b, 0))
                transparent_count += 1
            elif dist <= HARD_TRANSPARENT + FEATHER:
                # Graded alpha: alpha rises linearly from 0 to 255 across the feather band
                ratio = (dist - HARD_TRANSPARENT) / FEATHER
                alpha = int(round(ratio * 255))
                new_pixels.append((r, g, b, alpha))
                feathered_count += 1
            else:
                new_pixels.append((r, g, b, 255))

    img.putdata(new_pixels)
    img.save(OUT, "PNG", optimize=True)

    print(f"wrote: {OUT.name}")
    print(
        f"pixels: {total:,} total / "
        f"{transparent_count:,} fully transparent ({transparent_count / total:.1%}) / "
        f"{feathered_count:,} feathered ({feathered_count / total:.1%})"
    )


if __name__ == "__main__":
    main()
