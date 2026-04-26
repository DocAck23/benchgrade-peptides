#!/usr/bin/env bash
# Trace the F6 logo: wreath+chemist as vector paths (pixel-perfect from
# the source), wordmark "BENCH GRADE PEPTIDES" rendered as clean SVG
# <text> with rule lines above/below — matching the source layout but
# avoiding raster→vector translation issues on the B/E/N letters that
# kept appearing in earlier all-trace versions.
#
# Output:
#   F6-gold-vector.svg    — gold paths + gold text on transparent
#   F6-maroon-vector.svg  — maroon paths + maroon text on transparent

set -euo pipefail
cd "$(dirname "$0")"

python3 - <<'PY'
"""Build a wreath-only PBM (drops the wordmark band so potrace doesn't
trace the imperfectly-rendered letters)."""
from PIL import Image
from pathlib import Path

src = Path("../bgp-logos/F6-bench-wreath-straight-v3.jpg")
out = Path("F6-master.pbm")

img = Image.open(src).convert("L")
bw = img.point(lambda v: 0 if v > 90 else 255)
inv = bw.point(lambda v: 255 - v)
bbox = inv.getbbox()
pad = 4
x0, y0, x1, y1 = bbox
bbox = (max(0, x0 - pad), max(0, y0 - pad),
        min(img.size[0], x1 + pad), min(img.size[1], y1 + pad))
bw = bw.crop(bbox)

# The wordmark band (rule + "BENCH GRADE PEPTIDES" + rule) sits in the
# bottom ~22% of the bbox-cropped image. Remove it so the trace is
# wreath-only.
W, H = bw.size
wreath_only = bw.crop((0, 0, W, int(H * 0.78)))
wreath_only.save(out, "PPM")
print(f"wreath-only PBM: {wreath_only.size}")
PY

# turdsize 2 + opttolerance 0.2 = preserve fine detail
potrace F6-master.pbm -s -o F6-wreath-trace.svg \
    --color "#000000" --turdsize 2 --opttolerance 0.2

python3 - <<'PY'
"""Compose final SVG: traced wreath + clean SVG <text> wordmark below.

The viewBox is widened past the wreath bbox so the wordmark text never
clips. Wreath is centered horizontally in the new wider box; text sits
in a band below, matching the source layout (rule line, BENCH GRADE
PEPTIDES, rule line)."""
import re
from pathlib import Path

trace = Path("F6-wreath-trace.svg").read_text()
m = re.search(r'<svg[^>]*viewBox="([^"]+)"[^>]*>(.*?)</svg>', trace, re.DOTALL)
assert m, "couldn't parse trace SVG"
vbox = [float(x) for x in m.group(1).split()]
inner = m.group(2).strip()
wreath_W = vbox[2]
wreath_H = vbox[3]

# Widen the canvas so a serif wordmark at a comfortable size fits without
# clipping. The wreath itself stays centered; only the bounding box grows.
canvas_W = wreath_W * 1.18

# Wordmark band height: room for a thin top rule, the text, and a thin
# bottom rule. Tuned to roughly match the original source's proportions.
band_H = wreath_W * 0.24
canvas_H = wreath_H + band_H

# Center the wreath horizontally in the wider canvas.
wreath_dx = (canvas_W - wreath_W) / 2

# Wordmark layout
text_y      = wreath_H + band_H * 0.62
font_size   = canvas_W * 0.072
text_width  = canvas_W * 0.78    # forced text width — guarantees no clip
rule_y_top  = wreath_H + band_H * 0.18
rule_y_bot  = wreath_H + band_H * 0.86
rule_x0     = canvas_W * 0.10
rule_x1     = canvas_W * 0.90
rule_w_top  = canvas_W * 0.0030
rule_w_bot  = canvas_W * 0.0022
letter_sp   = canvas_W * 0.009

# Slight edge fade: mask gradient goes from 60% opacity at the very ends
# to full opacity once you're 14% into the wordmark band. Fades the outer
# tips of the rules and softens the leading B/E and trailing E/S of the
# wordmark. Subtle — not overkill.
defs = (
    f'  <defs>\n'
    f'    <linearGradient id="bgpEdgeFade" x1="0%" y1="0%" x2="100%" y2="0%">\n'
    f'      <stop offset="0%" stop-color="white" stop-opacity="0.55"/>\n'
    f'      <stop offset="14%" stop-color="white" stop-opacity="1"/>\n'
    f'      <stop offset="86%" stop-color="white" stop-opacity="1"/>\n'
    f'      <stop offset="100%" stop-color="white" stop-opacity="0.55"/>\n'
    f'    </linearGradient>\n'
    f'    <mask id="bgpFadeMask" maskUnits="userSpaceOnUse" '
    f'x="0" y="{wreath_H:.1f}" width="{canvas_W:.1f}" height="{band_H:.1f}">\n'
    f'      <rect x="0" y="{wreath_H:.1f}" width="{canvas_W:.1f}" height="{band_H:.1f}" '
    f'fill="url(#bgpEdgeFade)"/>\n'
    f'    </mask>\n'
    f'  </defs>'
)

wordmark = (
    f'  <g mask="url(#bgpFadeMask)">\n'
    f'    <line x1="{rule_x0:.1f}" y1="{rule_y_top:.1f}" '
    f'x2="{rule_x1:.1f}" y2="{rule_y_top:.1f}" '
    f'stroke="#000000" stroke-width="{rule_w_top:.2f}" fill="none"/>\n'
    f'    <text x="{canvas_W/2:.1f}" y="{text_y:.1f}" text-anchor="middle" '
    f'font-family="Cormorant Garamond, &quot;Times New Roman&quot;, Times, serif" '
    f'font-size="{font_size:.1f}" font-weight="600" '
    f'letter-spacing="{letter_sp:.2f}" '
    f'textLength="{text_width:.1f}" lengthAdjust="spacingAndGlyphs" '
    f'fill="#000000">BENCH GRADE PEPTIDES</text>\n'
    f'    <line x1="{rule_x0:.1f}" y1="{rule_y_bot:.1f}" '
    f'x2="{rule_x1:.1f}" y2="{rule_y_bot:.1f}" '
    f'stroke="#000000" stroke-width="{rule_w_bot:.2f}" fill="none"/>\n'
    f'  </g>'
)

new_svg = (
    f'<?xml version="1.0" encoding="UTF-8"?>\n'
    f'<svg xmlns="http://www.w3.org/2000/svg" '
    f'viewBox="0 0 {canvas_W:.1f} {canvas_H:.1f}" '
    f'preserveAspectRatio="xMidYMid meet">\n'
    f'{defs}\n'
    f'  <g transform="translate({wreath_dx:.2f} 0)">\n'
    f'{inner}\n'
    f'  </g>\n'
    f'{wordmark}\n'
    f'</svg>\n'
)

Path("F6-master-trace.svg").write_text(new_svg)
print(f"composed F6 master: {canvas_W:.0f} × {canvas_H:.0f}")
PY

python3 - <<'PY'
from pathlib import Path
master = Path("F6-master-trace.svg").read_text()
Path("F6-gold-vector.svg").write_text(
    master.replace('"#000000"', '"#B8923A"').replace("#000000", "#B8923A")
)
Path("F6-maroon-vector.svg").write_text(
    master.replace('"#000000"', '"#5C1A1A"').replace("#000000", "#5C1A1A")
)
print("wrote F6-gold-vector.svg and F6-maroon-vector.svg")
PY

rm -f F6-master.pbm F6-master-trace.svg F6-wreath-trace.svg
ls -la F6-*-vector.svg
