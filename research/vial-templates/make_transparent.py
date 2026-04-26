"""Strip the maroon background from F6 (gold-on-maroon) and the cream
background from F6-maroon-on-cream. Outputs PNGs with transparency so
the logo can sit on either label color.

The approach: each pixel's background-distance is measured in RGB space.
Pixels close to the background color become fully transparent; pixels
far from it stay opaque. A soft falloff in between hides the JPEG halo.
"""
from PIL import Image
import sys
from pathlib import Path

ROOT = Path("/Users/ahmed/Research Only Peptides/benchgrade-peptides/research")


def strip_bg(in_path: Path, out_path: Path, bg_rgb: tuple, hard_dist: int = 60, soft_dist: int = 110) -> None:
    img = Image.open(in_path).convert("RGBA")
    pixels = img.load()
    w, h = img.size
    br, bg, bb = bg_rgb
    for y in range(h):
        for x in range(w):
            r, g, b, _ = pixels[x, y]
            d = ((r - br) ** 2 + (g - bg) ** 2 + (b - bb) ** 2) ** 0.5
            if d <= hard_dist:
                pixels[x, y] = (r, g, b, 0)
            elif d >= soft_dist:
                pixels[x, y] = (r, g, b, 255)
            else:
                # linear falloff
                a = int(255 * (d - hard_dist) / (soft_dist - hard_dist))
                pixels[x, y] = (r, g, b, a)
    img.save(out_path, "PNG", optimize=True)
    print(f"wrote {out_path} ({out_path.stat().st_size // 1024} kB)")


# F6 gold-on-maroon → transparent gold
strip_bg(
    ROOT / "bgp-logos" / "F6-bench-wreath-straight-v3.jpg",
    ROOT / "vial-templates" / "F6-gold-transparent.png",
    bg_rgb=(0x5C, 0x1A, 0x1A),
)

# F6 maroon-on-cream → transparent maroon
strip_bg(
    ROOT / "vial-templates" / "F6-maroon-on-cream.jpg",
    ROOT / "vial-templates" / "F6-maroon-transparent.png",
    bg_rgb=(0xF2, 0xEA, 0xD9),
    hard_dist=50,
    soft_dist=90,
)
