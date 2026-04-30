#!/usr/bin/env python3
"""
Regenerate the v2 brand wordmark variants from a source asset.

Source: a PNG (or PNG-embedded SVG) of the gold metallic wordmark on a
flat wine background, e.g. /Users/ahmed/Downloads/Bench Grade-2/1.svg.

Output (written to public/brand/):
  - logo-gold.png    — chroma-keyed: metallic gradient on transparent
  - logo-wine.png    — alpha-tinted wine fill on transparent
  - logo-red.png     — alpha-tinted red fill on transparent
  - logo-cream.png   — alpha-tinted cream fill on transparent
  - logo-black.png   — alpha-tinted black fill on transparent
  - logo-mask.png    — pure alpha (for CSS mask-image use, future-proof)

Plus the BG monogram from a separate source:
  - bg-monogram-wine.png
  - bg-monogram-mask.png

Usage:
  python3 scripts/extract-logo-variants.py [--source PATH] [--monogram PATH]

Codex Review #1 (sub-project A · Foundation) flagged that the visual
companion bash scripts inlined this logic — making it a one-shot recipe
that drifts. Keeping it in-repo means the next time the source asset
updates, regeneration is `python3 scripts/extract-logo-variants.py`.
"""

from __future__ import annotations
import argparse
import os
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit(
        "Pillow not installed. Install with: pip3 install Pillow\n"
        "Or run: python3 -m pip install --user Pillow"
    )


PALETTE = {
    "wine": (74, 14, 26),       # #4A0E1A
    "red": (113, 25, 17),       # #711911
    "cream": (253, 250, 241),   # #FDFAF1
    "black": (0, 0, 0),
}


def chroma_key_wine_bg(im: Image.Image) -> Image.Image:
    """Replace pixels close to wine #711911 with transparency.

    The brand source PNG places the gold wordmark on a flat brick-red
    background (#711911 in the actual asset, not #4A0E1A — checked
    pixel-by-pixel during extraction). This heuristic keeps any pixel
    that is NOT a dark, low-blue, low-green red as opaque, drops the
    rest to alpha 0.
    """
    rgba = im.convert("RGBA")
    px = rgba.load()
    W, H = rgba.size
    for y in range(H):
        for x in range(W):
            r, g, b, _ = px[x, y]
            is_wine_bg = r > g and r > b and r < 140 and b < 60 and g < 60
            if is_wine_bg:
                px[x, y] = (r, g, b, 0)
            else:
                # Soft fade for anti-aliased edges.
                wine_score = max(0, 140 - r) + max(0, 60 - b) + max(0, 60 - g)
                new_a = max(0, min(255, 255 - int(wine_score * 0.7)))
                px[x, y] = (r, g, b, new_a)
    return rgba


def tight_bbox_crop(im: Image.Image, alpha_threshold: int = 30, pad: int = 40) -> Image.Image:
    """Crop the image to the bounding box of pixels with alpha > threshold."""
    alpha = im.split()[-1]
    bw = alpha.point(lambda v: 255 if v > alpha_threshold else 0)
    bbox = bw.getbbox()
    if not bbox:
        return im
    W, H = im.size
    bbox = (
        max(0, bbox[0] - pad),
        max(0, bbox[1] - pad),
        min(W, bbox[2] + pad),
        min(H, bbox[3] + pad),
    )
    return im.crop(bbox)


def alpha_tint(source_alpha: Image.Image, rgb: tuple[int, int, int]) -> Image.Image:
    """Recolor a transparent image to a flat fill while preserving alpha."""
    W, H = source_alpha.size
    fill = Image.new("RGBA", (W, H), (*rgb, 255))
    transparent = Image.new("RGBA", (W, H), (*rgb, 0))
    alpha_only = source_alpha.split()[-1]
    return Image.composite(fill, transparent, alpha_only)


def build_mask(source_alpha: Image.Image) -> Image.Image:
    """Pure alpha mask — black wherever the wordmark exists, fully transparent elsewhere.
    Useful for CSS mask-image to recolor at render time without per-variant assets.
    """
    return alpha_tint(source_alpha, (0, 0, 0))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source",
        default=str(Path.home() / "Downloads/Bench Grade/1.png"),
        help="Source wordmark PNG (gold metallic on wine background).",
    )
    parser.add_argument(
        "--monogram",
        default=str(Path.home() / "Downloads/Bench Grade/4.png"),
        help="Source monogram PNG (BG mark on white background).",
    )
    parser.add_argument(
        "--out",
        default="public/brand",
        help="Output directory (relative to repo root).",
    )
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    src = Path(args.source)
    if not src.exists():
        sys.exit(f"Source not found: {src}")

    print(f"Source: {src}")
    print(f"Output: {out_dir.absolute()}")

    # 1. Chroma-key the gold metallic wordmark on transparent.
    print("\n[1/3] Extracting gold metallic wordmark...")
    im = Image.open(src)
    gold = chroma_key_wine_bg(im)
    gold = tight_bbox_crop(gold)
    gold_path = out_dir / "logo-gold.png"
    gold.save(gold_path, optimize=True)
    print(f"  → {gold_path} ({gold.size}, {gold_path.stat().st_size:,} bytes)")

    # 2. Generate flat-color variants from the gold's alpha channel.
    print("\n[2/3] Generating flat-color variants...")
    for name, rgb in PALETTE.items():
        v = alpha_tint(gold, rgb)
        path = out_dir / f"logo-{name}.png"
        v.save(path, optimize=True)
        print(f"  → {path} ({path.stat().st_size:,} bytes)")

    # Pure alpha mask for future CSS mask-image recoloring.
    mask = build_mask(gold)
    mask_path = out_dir / "logo-mask.png"
    mask.save(mask_path, optimize=True)
    print(f"  → {mask_path} ({mask_path.stat().st_size:,} bytes)")

    # 3. BG monogram — extracted from the white-background source.
    monogram_src = Path(args.monogram)
    if monogram_src.exists():
        print(f"\n[3/3] Extracting BG monogram from {monogram_src}...")
        mim = Image.open(monogram_src).convert("RGBA")
        # Crop top half (monogram lives above the wax seal in source 4.png)
        W, H = mim.size
        top = mim.crop((0, 0, W, H // 2))
        # Key out near-white background.
        px = top.load()
        TW, TH = top.size
        for y in range(TH):
            for x in range(TW):
                r, g, b, _ = px[x, y]
                if r > 230 and g > 230 and b > 230:
                    px[x, y] = (r, g, b, 0)
                elif min(r, g, b) > 180:
                    new_a = max(0, 255 - (min(r, g, b) - 180) * 3)
                    px[x, y] = (r, g, b, new_a)
        mono = tight_bbox_crop(top, pad=30)
        wine_mono = alpha_tint(mono, PALETTE["wine"])
        wine_mono_path = out_dir / "bg-monogram-wine.png"
        wine_mono.save(wine_mono_path, optimize=True)
        print(f"  → {wine_mono_path} ({wine_mono_path.stat().st_size:,} bytes)")

        mono_mask = build_mask(mono)
        mono_mask_path = out_dir / "bg-monogram-mask.png"
        mono_mask.save(mono_mask_path, optimize=True)
        print(f"  → {mono_mask_path} ({mono_mask_path.stat().st_size:,} bytes)")
    else:
        print(f"\n[3/3] Skipped monogram extraction — source not at {monogram_src}")

    print("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
