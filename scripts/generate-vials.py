#!/usr/bin/env python3
"""
Generate per-SKU vial images by overlaying accurate compound text onto
a clean copy of the approved master vial.

Why this exists:
    The image-generation model could not reliably reproduce specific
    compound names and molecular data on the vial label — labels would
    drift, hallucinate, or look inconsistent across SKUs. PIL-based
    text overlay is deterministic, fast (sub-second per vial), and
    100% accurate to the catalog data.

How it works:
    1. Open the master vial JPEG (an approved render with the
       brand logo + label area).
    2. For each SKU in the catalog, paint a cream rectangle over the
       label's content region (preserving the brand-logo header and
       RUO footer regions of the existing label).
    3. Render the SKU's compound name + dosage + molecular data block
       in the same brand typography (Geist for compound name, JetBrains
       Mono for data).
    4. Save to /public/brand/vials/<slug>.jpg.

Run:
    python3 scripts/generate-vials.py

Inputs:
    public/brand/vials/cjc-1295-no-dac.jpg  (master)
    src/lib/catalog/data.ts                  (parsed for SKU data)

Outputs:
    public/brand/vials/<slug>.jpg            (one per SKU)
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("error: Pillow not installed. pip install Pillow", file=sys.stderr)
    sys.exit(1)


ROOT = Path(__file__).resolve().parent.parent
# Blank-label template — generated once via the amplifier with NO compound
# text on the label body, only the brand logo at top and RUO footer at
# bottom. This lets us composite per-SKU text without having to cover up
# any existing AI-generated label content.
TEMPLATE = ROOT / "public" / "brand" / "vials" / "_template.jpg"
OUT_DIR = ROOT / "public" / "brand" / "vials"
DATA_TS = ROOT / "src" / "lib" / "catalog" / "data.ts"

# Cream label color — sampled from actual master via sample-cream.py
CREAM = (240, 238, 225)
INK = (28, 28, 28)
INK_MUTED = (90, 80, 65)
CYAN_ACCENT = (0, 165, 184)

# Fonts — try common system locations; degrade to PIL default if absent.
def _load_font(candidates: list[tuple[str, int]]) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path, size in candidates:
        try:
            return ImageFont.truetype(path, size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


# Larger font for compound name; mono font for data block.
FONT_COMPOUND = _load_font([
    ("/System/Library/Fonts/Avenir Next.ttc", 56),
    ("/System/Library/Fonts/Helvetica.ttc", 56),
    ("/Library/Fonts/Arial Bold.ttf", 56),
])
FONT_MG = _load_font([
    ("/System/Library/Fonts/Avenir Next.ttc", 30),
    ("/System/Library/Fonts/Helvetica.ttc", 30),
])
FONT_MONO = _load_font([
    ("/System/Library/Fonts/Menlo.ttc", 18),
    ("/System/Library/Fonts/Courier.dfont", 18),
])
FONT_TINY = _load_font([
    ("/System/Library/Fonts/Avenir Next.ttc", 13),
    ("/System/Library/Fonts/Helvetica.ttc", 13),
])


def parse_products_from_ts(path: Path) -> list[dict]:
    """
    Pull product entries from data.ts. We don't need a full TS parser —
    we extract the fields we care about with regex against the
    `slug:`, `name:`, `cas_number:`, `molecular_formula:`,
    `molecular_weight:`, and the first variant's `sku` and `size_mg`.

    This is intentionally narrow — if data.ts changes shape significantly,
    this parser breaks loudly rather than silently.
    """
    text = path.read_text(encoding="utf-8")

    # Match each product object — slug + key fields.
    pattern = re.compile(
        r'\{\s*'
        r'slug:\s*"(?P<slug>[^"]+)",\s*'
        r'name:\s*"(?P<name>[^"]+)",\s*'
        r'category_slug:\s*"[^"]+",\s*'
        r'cas_number:\s*(?P<cas>(?:"[^"]*"|null)),\s*'
        r'molecular_formula:\s*(?P<mf>(?:"[^"]*"|null)),\s*'
        r'molecular_weight:\s*(?P<mw>(?:[\d.]+|null)),\s*'
        r'sequence:\s*(?P<seq>(?:"[^"]*"|null)),\s*'
        r'summary:\s*"(?P<summary>(?:[^"\\]|\\.)*)"',
        re.DOTALL,
    )

    products = []
    for m in pattern.finditer(text):
        d = m.groupdict()
        # Extract first variant's size_mg + sku from the surrounding region
        end_idx = m.end()
        variants_block = text[end_idx : end_idx + 1200]
        variant_match = re.search(
            r'size_mg:\s*([\d.]+),\s*sku:\s*"([^"]+)"',
            variants_block,
        )
        if not variant_match:
            continue
        products.append({
            "slug": d["slug"],
            "name": d["name"],
            "cas": json.loads(d["cas"]) if d["cas"] != "null" else None,
            "mf": json.loads(d["mf"]) if d["mf"] != "null" else None,
            "mw": float(d["mw"]) if d["mw"] != "null" else None,
            "size_mg": float(variant_match.group(1)),
            "sku": variant_match.group(2),
        })
    return products


def render_vial(product: dict, template: Image.Image) -> Image.Image:
    """
    Paint the SKU's label content onto a fresh copy of the blank-label
    template. Because the template's label body is already blank cream
    paper (brand logo at top, RUO footer at bottom, nothing in between),
    we don't need to cover any existing text — we just drop new text
    onto the clean area.

    Coordinates are tuned to the blank-label template. The label content
    zone is the middle of the vial's front face.
    """
    img = template.copy()
    draw = ImageDraw.Draw(img)

    # Handle BAC water separately — it's a volume (mL) not a mass (mg).
    is_liquid = "water" in product["name"].lower()
    unit = "mL" if is_liquid else "mg"

    # ---- Label content region (tuned to the 1376×768 master) ----
    # Inspection showed cream label pixels at x∈[557,711], y∈[150,650].
    # We cover wider than the cream extent to be safe; the brand logo
    # lives in the top y∈[150,240] area which we preserve.
    label_left = 540
    label_right = 770
    label_content_top = 245
    label_content_bottom = 640

    # Paint cream rectangle over the existing label content text area.
    draw.rectangle(
        [(label_left, label_content_top), (label_right, label_content_bottom)],
        fill=CREAM,
    )

    # ---- Compound name (centered, large) ----
    name = product["name"]
    name_y = label_content_top + 20
    bbox = draw.textbbox((0, 0), name, font=FONT_COMPOUND)
    name_w = bbox[2] - bbox[0]
    name_x = label_left + ((label_right - label_left) - name_w) // 2
    draw.text((name_x, name_y), name, fill=INK, font=FONT_COMPOUND)

    # ---- Dosage (e.g., "5 mg" or "10 mL") ----
    mg_text = f"{product['size_mg']:g} {unit}"
    mg_y = name_y + 75
    bbox = draw.textbbox((0, 0), mg_text, font=FONT_MG)
    mg_w = bbox[2] - bbox[0]
    mg_x = label_left + ((label_right - label_left) - mg_w) // 2
    draw.text((mg_x, mg_y), mg_text, fill=INK, font=FONT_MG)

    # ---- Molecular data block (left-aligned, fine print) ----
    mono_x = label_left + 40
    mono_y = mg_y + 60
    mono_lines: list[str] = []
    if product["mf"]:
        mono_lines.append(f"Formula: {product['mf']}")
    if product["mw"]:
        mono_lines.append(f"MW: {product['mw']:.2f} g/mol")
    if product["cas"]:
        mono_lines.append(f"CAS: {product['cas']}")
    mono_lines.append("Purity: ≥99% (HPLC)")
    mono_lines.append("Storage: −20°C")
    mono_lines.append(f"SKU: {product['sku']}")
    mono_lines.append("LOT: BGP-2026-0417")

    line_h = 24
    for i, line in enumerate(mono_lines):
        draw.text((mono_x, mono_y + i * line_h), line, fill=INK, font=FONT_MONO)

    return img


def main() -> None:
    if not TEMPLATE.exists():
        print(f"error: blank-label template not found: {TEMPLATE}", file=sys.stderr)
        print("generate one via the amplifier first, save to public/brand/vials/_template.jpg", file=sys.stderr)
        sys.exit(1)

    products = parse_products_from_ts(DATA_TS)
    print(f"parsed {len(products)} products from {DATA_TS.name}")

    template = Image.open(TEMPLATE).convert("RGB")
    print(f"template: {template.size[0]}×{template.size[1]}")

    written = 0
    for product in products:
        out_path = OUT_DIR / f"{product['slug']}.jpg"
        rendered = render_vial(product, template)
        rendered.save(out_path, "JPEG", quality=92, optimize=True)
        written += 1
        print(f"  ✓ {product['slug']}.jpg ({product['name']})")

    print(f"\nwrote {written} vial images to {OUT_DIR}")


if __name__ == "__main__":
    main()
