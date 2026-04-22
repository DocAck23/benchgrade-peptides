#!/usr/bin/env python3
"""
Debug helper — draws a red border box at proposed cover-rectangle
coordinates on a copy of the master, so we can visually verify alignment.
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "public" / "brand" / "vials" / "_template.jpg"
OUT = ROOT / "public" / "brand" / "vials" / "_debug_bounds.jpg"

# Current coordinates used by generate-vials.py
LABEL_LEFT = 500
LABEL_RIGHT = 940
CONTENT_TOP = 240
CONTENT_BOTTOM = 650

img = Image.open(TEMPLATE).convert("RGB")
draw = ImageDraw.Draw(img)

# Red border box
draw.rectangle(
    [(LABEL_LEFT, CONTENT_TOP), (LABEL_RIGHT, CONTENT_BOTTOM)],
    outline=(255, 0, 0),
    width=4,
)

# Corner labels
for x, y, text in [
    (LABEL_LEFT, CONTENT_TOP, f"({LABEL_LEFT},{CONTENT_TOP})"),
    (LABEL_RIGHT, CONTENT_TOP, f"({LABEL_RIGHT},{CONTENT_TOP})"),
    (LABEL_LEFT, CONTENT_BOTTOM, f"({LABEL_LEFT},{CONTENT_BOTTOM})"),
    (LABEL_RIGHT, CONTENT_BOTTOM, f"({LABEL_RIGHT},{CONTENT_BOTTOM})"),
]:
    draw.text((x, y), text, fill=(255, 0, 0))

img.save(OUT, "JPEG", quality=85)
print(f"Saved debug image: {OUT}")
print(f"Template size: {img.size[0]}×{img.size[1]}")
print(f"Proposed cover rect: x[{LABEL_LEFT},{LABEL_RIGHT}] y[{CONTENT_TOP},{CONTENT_BOTTOM}]")
