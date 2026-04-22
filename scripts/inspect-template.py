#!/usr/bin/env python3
"""
Inspect the blank-label template to find the label's cream region boundaries.

Samples pixels along horizontal scan-lines and reports the leftmost
and rightmost cream-colored pixels. Cream label is roughly RGB
(242, 235, 220); dark backdrop is (60, 58, 53).
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "public" / "brand" / "vials" / "_template.jpg"

# Cream color signature — any pixel within this tolerance counts as "label"
CREAM_RGB = (240, 230, 215)
TOLERANCE = 35  # L1 (Manhattan) distance threshold

def is_cream(r: int, g: int, b: int) -> bool:
    return (abs(r - CREAM_RGB[0]) + abs(g - CREAM_RGB[1]) + abs(b - CREAM_RGB[2])) < TOLERANCE

def main() -> None:
    img = Image.open(TEMPLATE).convert("RGB")
    w, h = img.size
    print(f"Template size: {w}×{h}")

    # Scan every 25px vertically; find cream-region horizontal extent at each y
    print("\nScanning cream extent by y:")
    first_cream_y = None
    last_cream_y = None
    min_left = w
    max_right = 0
    for y in range(0, h, 25):
        row = [is_cream(*img.getpixel((x, y))) for x in range(w)]
        if any(row):
            left = next(i for i, c in enumerate(row) if c)
            right = w - 1 - next(i for i, c in enumerate(reversed(row)) if c)
            cream_width = sum(row)
            if cream_width > 20:  # filter out noise
                if first_cream_y is None:
                    first_cream_y = y
                last_cream_y = y
                min_left = min(min_left, left)
                max_right = max(max_right, right)
                print(f"  y={y:4}: left={left:4} right={right:4} width={cream_width}")

    print(f"\nCream region bounding box:")
    print(f"  y: {first_cream_y} .. {last_cream_y}")
    print(f"  x: {min_left} .. {max_right}")

if __name__ == "__main__":
    main()
