#!/usr/bin/env python3
"""Per-SKU label SVG generator — Variant B layout, 2026-04-25 standard.

Layout standard agreed with founder 2026-04-25:
  1. Vertical divider between F6 logo and content (all sizes)
  2. No redundant ingredient text on blends — formula/MW shown beneath
     the RESEARCH block when the data has them; otherwise a single
     "Composite blend · see COA" line is shown.
  3. RESEARCH category block on every vial:
       - RESEARCH PEPTIDE for single peptides + coded incretin SKUs
       - RESEARCH BLEND   for KLOW / GLOW / BPC+TB / CJC+Ipa blends
       - RESEARCH LIQUID  for liquid-blend 10ml SKUs (L-Carn, LC120,
                          LC216, Super Human Blend)
  4. "3mL/10mL Multi-Dose Vial" moved to the bottom-right strip
     (3ml: same row as the COA URL; 10ml: right column above bottom strip).
  5. Designated QR-code placeholder — dashed gold rectangle + "QR · COA · per LOT"
     instruction text. Sits in right column directly below the RESEARCH block.
       - 3ml: 50×50 px (~13.5mm at 300 DPI — phone-readable)
       - 10ml: 80×80 px (~27mm — easy scan)
     Manufacturer prints the live QR per-LOT into this area.
"""
import re
from pathlib import Path
from textwrap import dedent

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "src" / "lib" / "catalog" / "data.ts"
OUT_DIR = ROOT / "research" / "per-sku-labels"
OUT_DIR.mkdir(parents=True, exist_ok=True)

LOT = "H.012526"
EXP = "01.2028"


# ---------- catalog parser ----------
def extract_products(src: str):
    m = re.search(r"export const PRODUCTS:[^=]+=\s*\[", src)
    arr_start = m.end()
    depth = 1
    i = arr_start
    while i < len(src) and depth > 0:
        c = src[i]
        if c == "[":
            depth += 1
        elif c == "]":
            depth -= 1
        i += 1
    body = src[arr_start: i - 1]

    blocks = []
    depth = 0
    start = None
    for j, c in enumerate(body):
        if c == "{":
            if depth == 0:
                start = j
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0 and start is not None:
                blocks.append(body[start:j + 1])
                start = None

    for b in blocks:
        prod = parse_product(b)
        if prod:
            yield prod


def parse_product(block: str) -> dict | None:
    def field(name, default=None):
        m = re.search(rf'{name}:\s*("(?:[^"\\]|\\.)*"|null|true|false|[\d\.]+)', block)
        if not m:
            return default
        raw = m.group(1)
        if raw == "null":
            return None
        if raw.startswith('"'):
            return raw[1:-1]
        return raw

    slug = field("slug")
    if not slug:
        return None
    name = field("name")
    container = field("container") or "vial-3ml"
    cas = field("cas_number")
    formula = field("molecular_formula")
    mw = field("molecular_weight")
    if mw and mw not in ("null",):
        try:
            mw = float(mw)
        except ValueError:
            mw = None

    variants = []
    vm = re.search(r"variants:\s*\[(.*?)\]\s*,?\s*\}", block, re.DOTALL)
    if vm:
        for vmatch in re.finditer(
            r'\{\s*size_mg:\s*([\d\.]+)\s*,\s*pack_size:\s*(\d+)\s*,\s*sku:\s*"([^"]+)"',
            vm.group(1),
        ):
            variants.append({
                "size_mg": float(vmatch.group(1)),
                "pack_size": int(vmatch.group(2)),
                "sku": vmatch.group(3),
            })

    return {
        "slug": slug, "name": name, "container": container,
        "cas": cas, "formula": formula, "mw": mw,
        "variants": variants,
    }


# ---------- helpers ----------
def shrink_with(text: str) -> str:
    return re.sub(r"\bwith\b", "w/", text, flags=re.IGNORECASE)


def display_name_for(name: str) -> str:
    """Strip dose suffix and apply name-shortening rules."""
    # IGNORECASE so we strip both "10mg" and "10mL" — the catalog mixes
    # cases (Super Human Blend 10mL, L-Carnitine 10mL, etc.) and a
    # case-sensitive match was leaving "10mL" stuck on the end of names.
    s = re.sub(r"\s+\d+(?:\.\d+)?\s*/\s*\d+(?:\.\d+)?\s*(?:mg|ml|g)\s*$", "", name, flags=re.IGNORECASE)
    s = re.sub(r"\s+\d+(?:\.\d+)?(?:mg|ml|g)\s*$", "", s, flags=re.IGNORECASE)
    # Also strip a parenthetical "(liquid)" qualifier from liquid SKUs —
    # the RESEARCH LIQUID category block already conveys this.
    s = re.sub(r"\s*\(liquid\)\s*", " ", s, flags=re.IGNORECASE).strip()
    s = s.replace("CJC-1295 (no DAC) + Ipamorelin", "CJC-1295 + Ipamorelin")
    s = s.replace("CJC-1295 (no DAC)", "CJC-1295")
    # Strip generic-name parentheticals so the SKU code stays the focus
    # of the name line and we don't overrun the LOT/EXP box.
    s = re.sub(r"\s*\([^)]*\)\s*$", "", s).strip()
    return shrink_with(s)


def combo_dose_label(name: str) -> str | None:
    m = re.search(r"\s(\d+(?:\.\d+)?)\s*/\s*(\d+(?:\.\d+)?)\s*mg\s*$", name, flags=re.IGNORECASE)
    if not m:
        return None
    return f"{m.group(1)}/{m.group(2)} MG"


def name_font_size(text: str, container: str) -> int:
    """Tuned 2026-04-25 to keep the longest catalog names off the LOT/EXP
    box. 10ml right-edge of the name area is x≈515 (LOT box). Name starts
    at x=275, so width budget is ~240px. At ~12px per char average for
    weight-700 Cormorant, sizes below keep us under that budget."""
    L = len(text)
    if container == "vial-10ml":
        if L <= 10: return 32
        if L <= 14: return 28
        if L <= 17: return 24
        if L <= 21: return 20
        return 17
    # 3ml: name area ≈ 135px wide (x=190 → LOT box at x=325)
    if L <= 10: return 22
    if L <= 14: return 18
    if L <= 18: return 15
    if L <= 22: return 12
    return 10


def fmt_mw(mw):
    if mw is None:
        return None
    return f"{mw:.2f}".rstrip("0").rstrip(".") + " g/mol"


BLEND_SLUGS = {
    "klow-blend", "glow-blend", "bpc-tb-5-5mg", "bpc-tb-10-10mg",
    "cjc-ipa-5-5mg", "super-human-blend-10ml",
}
LIQUID_BLEND_SLUGS = {
    "l-carnitine-10ml", "lc120-10ml", "lc216-10ml", "super-human-blend-10ml",
}


def is_blend(prod) -> bool:
    return prod["slug"] in BLEND_SLUGS or "blend" in (prod["name"] or "").lower()


def research_category(prod) -> str:
    """Gold pill text — every vial gets one of these."""
    if prod["slug"] in LIQUID_BLEND_SLUGS:
        return "RESEARCH LIQUID"
    if is_blend(prod):
        return "RESEARCH BLEND"
    return "RESEARCH PEPTIDE"


# ---------- SVG templates ----------
STYLE = dedent("""
  <defs>
    <style>
      .maroon { fill: #5C1A1A; }
      .gold { fill: #B8923A; }
      .cream { fill: #F2EAD9; }
      .gold-stroke { stroke: #B8923A; fill: none; }
      .gold-stroke-dashed { stroke: #B8923A; fill: none; stroke-dasharray: 3,2; }
      .display { font-family: 'Cormorant Garamond', 'Times New Roman', serif; }
      .sans { font-family: 'Inter', -apple-system, sans-serif; }
      .mono { font-family: 'JetBrains Mono', ui-monospace, Menlo, monospace; }
    </style>
  </defs>
""").strip()


def qr_placeholder_svg(x, y, size, label_size=6) -> str:
    """Dashed gold-bordered placeholder rectangle. Manufacturer prints the
    live LOT-specific QR into this exact box at fulfillment time.
    Inside: tiny "QR · COA" hint text so the print zone is unambiguous."""
    half = size / 2
    return dedent(f"""
  <g transform="translate({x},{y})">
    <rect width="{size}" height="{size}" class="gold-stroke-dashed" stroke-width="0.7"/>
    <text x="{half}" y="{half - 2}" text-anchor="middle" class="gold mono"
          font-size="{label_size}" font-weight="600" letter-spacing="1">QR</text>
    <text x="{half}" y="{half + 8}" text-anchor="middle" class="gold mono"
          font-size="{label_size - 1}" letter-spacing="0.5" opacity="0.85">COA · per LOT</text>
  </g>""").strip()


def label_3ml_svg(prod, variant) -> str:
    """450 × 225 SVG — Variant B, full standard."""
    name = display_name_for(prod["name"])
    dose_label = combo_dose_label(prod["name"]) or f"{variant['size_mg']:g} MG"
    sku = variant["sku"]
    fsize = name_font_size(name, "vial-3ml")
    category = research_category(prod)

    parts = []
    parts.append('<?xml version="1.0" encoding="UTF-8"?>')
    parts.append(
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"\n'
        '     width="450" height="225" viewBox="0 0 450 225"\n'
        '     font-family="\'Cormorant Garamond\', \'Times New Roman\', serif">'
    )
    parts.append(f'  <!-- BGP · {sku} · {name} {dose_label} · 3ml maroon vial label -->')
    parts.append(STYLE)
    parts.append('  <rect width="450" height="225" class="maroon"/>')

    # F6 logo on the LEFT — sized to logo aspect (1.40) to fill the space
    # between the label edge and the divider. Centered vertically.
    parts.append(
        '  <image x="1" y="28" width="174" height="124"\n'
        '         xlink:href="../vial-templates/F6-gold-vector.svg"\n'
        '         preserveAspectRatio="xMidYMid meet"/>'
    )
    # Vertical divider
    parts.append('  <line x1="178" y1="20" x2="178" y2="170" class="gold-stroke" stroke-width="1.5" opacity="0.7"/>')

    # LEFT COLUMN — peptide info
    parts.append(
        f'  <text x="190" y="44" class="cream display" font-size="{fsize}" '
        f'font-weight="700" letter-spacing="-0.3">{name}</text>'
    )
    pill_w = max(56, 16 + 7 * len(dose_label))
    parts.append(
        f'  <g transform="translate(190,52)">\n'
        f'    <rect width="{pill_w}" height="20" class="gold-stroke" stroke-width="1" rx="2"/>\n'
        f'    <text x="{pill_w/2:.1f}" y="14" text-anchor="middle" class="gold mono" '
        f'font-size="10" font-weight="600" letter-spacing="1">{dose_label}</text>\n'
        '  </g>'
    )

    # Formula + MW under dose pill — only when data has them
    has_lab_data = bool(prod.get("formula")) or bool(prod.get("mw"))
    if has_lab_data:
        lines = []
        if prod.get("formula"):
            lines.append(("Formula", prod["formula"]))
        if prod.get("mw"):
            lines.append(("MW", fmt_mw(prod["mw"])))
        if prod.get("cas"):
            lines.append(("CAS", prod["cas"]))
        tspans = "\n".join(
            f'      <tspan x="0" y="{i*10}"><tspan class="gold">{label}  </tspan>{value}</tspan>'
            for i, (label, value) in enumerate(lines[:3])
        )
        parts.append(
            '  <g transform="translate(190,86)">\n'
            '    <text class="cream mono" font-size="6" letter-spacing="0.4">\n'
            f'{tspans}\n'
            '    </text>\n'
            '  </g>'
        )
    elif is_blend(prod):
        parts.append(
            '  <text x="190" y="92" class="cream mono" font-size="6" letter-spacing="0.4" opacity="0.85">'
            'Composite blend · see COA</text>'
        )
    else:
        # Coded incretin
        parts.append(
            '  <text x="190" y="92" class="cream mono" font-size="6" letter-spacing="0.4" opacity="0.85">'
            'Identity disclosed per LOT</text>'
        )

    # RIGHT COLUMN
    # LOT/EXP box at top-right
    parts.append(
        '  <g transform="translate(325,22)">\n'
        '    <rect width="118" height="42" class="gold-stroke" stroke-width="1"/>\n'
        '    <text x="10" y="17" class="gold mono" font-size="8.5" letter-spacing="1.5">LOT</text>\n'
        f'    <text x="108" y="17" text-anchor="end" class="cream mono" font-size="10" font-weight="600" letter-spacing="0.8">{LOT}</text>\n'
        '    <line x1="10" y1="23" x2="108" y2="23" class="gold-stroke" stroke-width="0.4" opacity="0.4"/>\n'
        '    <text x="10" y="35" class="gold mono" font-size="8.5" letter-spacing="1.5">EXP</text>\n'
        f'    <text x="108" y="35" text-anchor="end" class="cream mono" font-size="10" font-weight="600" letter-spacing="0.8">{EXP}</text>\n'
        '  </g>'
    )
    # RESEARCH category block
    parts.append(
        '  <g transform="translate(325,72)">\n'
        '    <rect width="118" height="20" class="gold" rx="2"/>\n'
        f'    <text x="59" y="14" text-anchor="middle" class="maroon mono" '
        f'font-size="8.5" font-weight="700" letter-spacing="1.6">{category}</text>\n'
        '  </g>'
    )
    # QR placeholder (50×50, ~13.5mm) — manufacturer prints live QR per LOT
    parts.append(qr_placeholder_svg(343, 100, 50, label_size=6))

    # 99% PURITY banner — full content-area width
    parts.append(
        '  <g transform="translate(190,158)">\n'
        '    <rect width="250" height="20" class="gold"/>\n'
        '    <text x="125" y="14" text-anchor="middle" class="maroon mono" '
        'font-size="9.5" font-weight="700" letter-spacing="2.4">99% PURITY · HPLC VERIFIED</text>\n'
        '  </g>'
    )

    # Bottom strip
    parts.append(
        '  <text x="225" y="190" text-anchor="middle" class="cream mono" font-size="6" letter-spacing="1.2" opacity="0.85">'
        'FOR RESEARCH USE ONLY · NOT FOR HUMAN OR VETERINARY USE</text>'
    )
    parts.append(
        '  <text x="225" y="202" text-anchor="middle" class="gold mono" font-size="6.5" letter-spacing="1.4">'
        'EST. 2026 · MADE IN USA · BENCH GRADE PEPTIDES LLC</text>'
    )
    parts.append(
        f'  <text x="10" y="216" class="cream mono" font-size="6.2" letter-spacing="0.8" opacity="0.8">SKU {sku}</text>'
    )
    parts.append(
        '  <text x="440" y="216" text-anchor="end" class="cream mono" font-size="6.2" letter-spacing="0.6" opacity="0.85">'
        '3mL Multi-Dose · benchgradepeptides.com/coa</text>'
    )
    parts.append('</svg>')
    return "\n".join(parts)


def label_10ml_svg(prod, variant) -> str:
    """675 × 375 SVG — same standard, scaled up + STORAGE/USE blocks."""
    name = display_name_for(prod["name"])
    dose_label = combo_dose_label(prod["name"]) or f"{variant['size_mg']:g} MG"
    sku = variant["sku"]
    fsize = name_font_size(name, "vial-10ml")
    category = research_category(prod)
    is_liquid_blend = prod["slug"] in LIQUID_BLEND_SLUGS

    parts = []
    parts.append('<?xml version="1.0" encoding="UTF-8"?>')
    parts.append(
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"\n'
        '     width="675" height="375" viewBox="0 0 675 375"\n'
        '     font-family="\'Cormorant Garamond\', \'Times New Roman\', serif">'
    )
    parts.append(f'  <!-- BGP · {sku} · {name} {dose_label} · 10ml maroon vial label -->')
    parts.append(STYLE)
    parts.append('  <rect width="675" height="375" class="maroon"/>')

    # F6 logo + divider
    parts.append(
        '  <image x="2" y="65" width="280" height="200"\n'
        '         xlink:href="../vial-templates/F6-gold-vector.svg"\n'
        '         preserveAspectRatio="xMidYMid meet"/>'
    )
    parts.append('  <line x1="284" y1="22" x2="284" y2="290" class="gold-stroke" stroke-width="1.5" opacity="0.7"/>')

    # LEFT COLUMN — name + dose pills
    parts.append(
        f'  <text x="295" y="64" class="cream display" font-size="{fsize}" '
        f'font-weight="700" letter-spacing="-0.4">{name}</text>'
    )
    label_for_pill = "10 ML" if is_liquid_blend else dose_label
    main_pill_w = max(105, 24 + 10 * len(label_for_pill))
    parts.append(
        f'  <g transform="translate(295,80)">\n'
        f'    <rect width="{main_pill_w}" height="32" class="gold-stroke" stroke-width="1.2" rx="3"/>\n'
        f'    <text x="{main_pill_w/2:.1f}" y="22" text-anchor="middle" class="gold mono" '
        f'font-size="15" font-weight="600" letter-spacing="1.3">{label_for_pill}</text>\n'
        '  </g>'
    )
    if not is_liquid_blend:
        ml_x = 295 + main_pill_w + 8
        parts.append(
            f'  <g transform="translate({ml_x},80)">\n'
            '    <rect width="80" height="32" class="gold-stroke" stroke-width="1.2" rx="3"/>\n'
            '    <text x="40" y="22" text-anchor="middle" class="gold mono" '
            'font-size="13" font-weight="600" letter-spacing="1.3">10 ML</text>\n'
            '  </g>'
        )

    # Formula / MW / CAS — under the pill row
    has_lab_data = bool(prod.get("formula")) or bool(prod.get("mw"))
    if has_lab_data:
        lines = []
        if prod.get("formula"): lines.append(("Formula", prod["formula"]))
        if prod.get("mw"):      lines.append(("MW", fmt_mw(prod["mw"])))
        if prod.get("cas"):     lines.append(("CAS", prod["cas"]))
        tspans = "\n".join(
            f'      <tspan x="0" y="{i*13}"><tspan class="gold">{label}  </tspan>{value}</tspan>'
            for i, (label, value) in enumerate(lines[:3])
        )
        parts.append(
            '  <g transform="translate(295,140)">\n'
            '    <text class="cream mono" font-size="9" letter-spacing="0.5">\n'
            f'{tspans}\n'
            '    </text>\n'
            '  </g>'
        )
    elif is_blend(prod):
        parts.append(
            '  <text x="295" y="148" class="cream mono" font-size="9" letter-spacing="0.5" opacity="0.85">'
            'Composite blend · see COA</text>'
        )
    else:
        parts.append(
            '  <text x="295" y="148" class="cream mono" font-size="9" letter-spacing="0.5" opacity="0.85">'
            'Full identity on per-batch COA</text>'
        )

    # RIGHT COLUMN — LOT/EXP, RESEARCH, QR, multi-dose
    parts.append(
        '  <g transform="translate(515,28)">\n'
        '    <rect width="140" height="58" class="gold-stroke" stroke-width="1.2"/>\n'
        '    <text x="12" y="22" class="gold mono" font-size="10" letter-spacing="1.5">LOT</text>\n'
        f'    <text x="130" y="22" text-anchor="end" class="cream mono" font-size="14" font-weight="600" letter-spacing="1">{LOT}</text>\n'
        '    <line x1="12" y1="32" x2="130" y2="32" class="gold-stroke" stroke-width="0.4" opacity="0.4"/>\n'
        '    <text x="12" y="50" class="gold mono" font-size="10" letter-spacing="1.5">EXP</text>\n'
        f'    <text x="130" y="50" text-anchor="end" class="cream mono" font-size="14" font-weight="600" letter-spacing="1">{EXP}</text>\n'
        '  </g>'
    )
    parts.append(
        '  <g transform="translate(515,98)">\n'
        '    <rect width="140" height="24" class="gold" rx="2"/>\n'
        f'    <text x="70" y="17" text-anchor="middle" class="maroon mono" '
        f'font-size="10" font-weight="700" letter-spacing="2">{category}</text>\n'
        '  </g>'
    )
    # QR placeholder (80×80, ~27mm) — comfortably scannable
    parts.append(qr_placeholder_svg(545, 132, 80, label_size=8))
    # Multi-Dose Vial line — right column under QR
    multidose_text = ("10mL Multi-Dose · Reconstitute w/ BAC water"
                      if not is_liquid_blend
                      else "10mL Multi-Dose · Liquid blend")
    parts.append(
        f'  <text x="585" y="232" text-anchor="middle" class="cream sans" font-size="9" '
        f'letter-spacing="0.4">{multidose_text}</text>'
    )

    # 99% PURITY banner — full content width
    parts.append(
        '  <g transform="translate(295,250)">\n'
        '    <rect width="360" height="32" class="gold"/>\n'
        '    <text x="180" y="22" text-anchor="middle" class="maroon mono" '
        'font-size="14" font-weight="700" letter-spacing="3.2">99% PURITY · HPLC VERIFIED</text>\n'
        '  </g>'
    )

    # STORAGE / USE blocks
    parts.append(
        '  <g transform="translate(295,300)">\n'
        '    <text class="cream mono" font-size="8.5" letter-spacing="1">\n'
        '      <tspan x="0" y="0" class="gold">STORAGE</tspan>\n'
        '      <tspan x="0" y="13">Store at room temp.</tspan>\n'
        '      <tspan x="0" y="24">Refrigerate after opening.</tspan>\n'
        '    </text>\n'
        '    <text class="cream mono" font-size="8.5" letter-spacing="1" transform="translate(180,0)">\n'
        '      <tspan x="0" y="0" class="gold">USE</tspan>\n'
        '      <tspan x="0" y="13">Research only. Not for</tspan>\n'
        '      <tspan x="0" y="24">human or veterinary use.</tspan>\n'
        '    </text>\n'
        '  </g>'
    )

    # Bottom strip
    parts.append('  <line x1="20" y1="345" x2="655" y2="345" class="gold-stroke" stroke-width="0.4" opacity="0.4"/>')
    parts.append(
        '  <text x="20" y="358" class="gold mono" font-size="9" letter-spacing="1.5">'
        'EST. 2026 · MADE IN USA · BENCH GRADE PEPTIDES LLC</text>'
    )
    parts.append(
        f'  <text x="655" y="358" text-anchor="end" class="cream mono" font-size="8" letter-spacing="0.8" opacity="0.85">SKU {sku} · benchgradepeptides.com/coa</text>'
    )
    parts.append('</svg>')
    return "\n".join(parts)


def supply_label_svg(name: str, sku: str, copy: str) -> str:
    """BAC Water / Acetic Acid Water — supply 10ml label."""
    parts = []
    parts.append('<?xml version="1.0" encoding="UTF-8"?>')
    parts.append(
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"\n'
        '     width="675" height="375" viewBox="0 0 675 375"\n'
        '     font-family="\'Cormorant Garamond\', \'Times New Roman\', serif">'
    )
    parts.append(f'  <!-- BGP · {sku} · {name} · supply label -->')
    parts.append(STYLE)
    parts.append('  <rect width="675" height="375" class="maroon"/>')
    parts.append(
        '  <image x="2" y="65" width="280" height="200"\n'
        '         xlink:href="../vial-templates/F6-gold-vector.svg"\n'
        '         preserveAspectRatio="xMidYMid meet"/>'
    )
    parts.append('  <line x1="284" y1="22" x2="284" y2="290" class="gold-stroke" stroke-width="1.5" opacity="0.7"/>')

    fsize = name_font_size(name, "vial-10ml")
    parts.append(
        f'  <text x="295" y="64" class="cream display" font-size="{fsize}" '
        f'font-weight="700" letter-spacing="-0.4">{name}</text>'
    )
    parts.append(
        '  <g transform="translate(295,80)">\n'
        '    <rect width="105" height="32" class="gold-stroke" stroke-width="1.2" rx="3"/>\n'
        '    <text x="52" y="22" text-anchor="middle" class="gold mono" '
        'font-size="15" font-weight="600" letter-spacing="1.3">10 ML</text>\n'
        '  </g>'
    )
    parts.append(
        f'  <text x="295" y="135" class="cream sans" font-size="8.5" letter-spacing="0.3">{shrink_with(copy)}</text>'
    )
    # LOT/EXP
    parts.append(
        '  <g transform="translate(515,28)">\n'
        '    <rect width="140" height="58" class="gold-stroke" stroke-width="1.2"/>\n'
        '    <text x="12" y="22" class="gold mono" font-size="10" letter-spacing="1.5">LOT</text>\n'
        f'    <text x="130" y="22" text-anchor="end" class="cream mono" font-size="14" font-weight="600" letter-spacing="1">{LOT}</text>\n'
        '    <line x1="12" y1="32" x2="130" y2="32" class="gold-stroke" stroke-width="0.4" opacity="0.4"/>\n'
        '    <text x="12" y="50" class="gold mono" font-size="10" letter-spacing="1.5">EXP</text>\n'
        f'    <text x="130" y="50" text-anchor="end" class="cream mono" font-size="14" font-weight="600" letter-spacing="1">{EXP}</text>\n'
        '  </g>'
    )
    # Category block — supplies get "STERILE DILUENT"
    parts.append(
        '  <g transform="translate(515,98)">\n'
        '    <rect width="140" height="24" class="gold" rx="2"/>\n'
        '    <text x="70" y="17" text-anchor="middle" class="maroon mono" '
        'font-size="10" font-weight="700" letter-spacing="2">STERILE DILUENT</text>\n'
        '  </g>'
    )
    # QR placeholder
    parts.append(qr_placeholder_svg(545, 132, 80, label_size=8))
    # Multi-Dose
    parts.append(
        '  <text x="585" y="232" text-anchor="middle" class="cream sans" font-size="9" '
        'letter-spacing="0.4">10mL Multi-Dose · Sterile-filtered</text>'
    )
    # Banner
    parts.append(
        '  <g transform="translate(295,250)">\n'
        '    <rect width="360" height="32" class="gold"/>\n'
        '    <text x="180" y="22" text-anchor="middle" class="maroon mono" '
        'font-size="10.5" font-weight="700" letter-spacing="1.6">FOR LABORATORY USE · STERILE-FILTERED</text>\n'
        '  </g>'
    )
    parts.append(
        '  <text x="295" y="305" class="cream mono" font-size="9" letter-spacing="1.4" opacity="0.85">'
        'SUPPLY ITEM · NOT A DRUG · NOT FOR HUMAN OR VETERINARY USE</text>'
    )
    parts.append('  <line x1="20" y1="345" x2="655" y2="345" class="gold-stroke" stroke-width="0.4" opacity="0.4"/>')
    parts.append(
        '  <text x="20" y="358" class="gold mono" font-size="9" letter-spacing="1.5">'
        'EST. 2026 · MADE IN USA · BENCH GRADE PEPTIDES LLC</text>'
    )
    parts.append(
        f'  <text x="655" y="358" text-anchor="end" class="cream mono" font-size="8" letter-spacing="0.8" opacity="0.85">SKU {sku} · benchgradepeptides.com/coa</text>'
    )
    parts.append('</svg>')
    return "\n".join(parts)


# ---------- run ----------
src = CATALOG.read_text()
products = list(extract_products(src))

for f in OUT_DIR.glob("*.svg"):
    f.unlink()

generated = []
skipped = []

for prod in products:
    container = prod["container"]
    if container in ("capsule-bottle", "topical-bottle"):
        skipped.append(f"{prod['slug']} ({container})")
        continue
    for variant in prod["variants"]:
        if container == "vial-3ml":
            svg = label_3ml_svg(prod, variant)
        elif container == "vial-10ml":
            svg = label_10ml_svg(prod, variant)
        else:
            continue
        out = OUT_DIR / f"{variant['sku']}.svg"
        out.write_text(svg + "\n")
        generated.append({
            "sku": variant["sku"],
            "name": display_name_for(prod["name"]),
            "dose": variant["size_mg"],
            "container": container,
            "filename": out.name,
        })

for special in [
    ("BAC Water", "BGP-BACW-10ML", "Bacteriostatic 0.9% Sodium Chloride · Sterile reconstitution diluent"),
    ("Acetic Acid Water", "BGP-AAW-10ML", "0.6% Acetic Acid in sterile water · Reconstitution diluent for select compounds"),
]:
    name, sku, copy = special
    out = OUT_DIR / f"{sku}.svg"
    out.write_text(supply_label_svg(name, sku, copy) + "\n")
    generated.append({
        "sku": sku, "name": name, "dose": 0,
        "container": "supply-10ml", "filename": out.name,
    })

print(f"generated {len(generated)} per-SKU SVGs into {OUT_DIR.relative_to(ROOT)}/")
print(f"skipped (no label needed): {len(skipped)} products")

import json
manifest = sorted(generated, key=lambda r: (r["container"], r["name"], r["dose"]))
(OUT_DIR.parent / "per-sku-manifest.json").write_text(json.dumps(manifest, indent=2))
print(f"wrote manifest with {len(manifest)} entries")
