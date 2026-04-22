#!/usr/bin/env python3
"""Sample average cream-color in the label region of the master."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
T = ROOT / "public" / "brand" / "vials" / "_template.jpg"

img = Image.open(T).convert("RGB")
# Sample label region (x 565-700, y 500-630 — clean label area under text)
samples = []
for x in range(565, 700, 3):
    for y in range(500, 630, 3):
        samples.append(img.getpixel((x, y)))

avg_r = sum(s[0] for s in samples) // len(samples)
avg_g = sum(s[1] for s in samples) // len(samples)
avg_b = sum(s[2] for s in samples) // len(samples)
print(f"sampled {len(samples)} pixels, avg rgb=({avg_r}, {avg_g}, {avg_b})")

# Show a few individual samples too
for p in samples[:10]:
    print(f"  pixel: {p}")
