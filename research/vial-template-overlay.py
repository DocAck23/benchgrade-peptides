#!/usr/bin/env python3
"""Stamp text overlays onto the BPC-157 vial template to produce
pixel-identical photos for every catalog product. Only these change
per peptide:
  - Compound name
  - Dose pill text
  - Formula
  - MW
  - QR-placeholder caption ("LOT COA QR Code")
Everything else (vial, cap, cream backdrop, wreath, banner, side panel)
is shared across all products since we paste over the same template."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import re, json

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "public" / "brand" / "vials" / "bpc-157-5mg.jpg"
OUT_DIR = ROOT / "public" / "brand" / "vials"

# Colors sampled from the BPC-157 template
MAROON = (60, 22, 14)
CREAM  = (240, 230, 200)
GOLD   = (200, 160, 70)

# Pixel regions on the 1024×1024 template
# (x0, y0, x1, y1) — inclusive of coordinates we will paint over.
# Positions verified visually 2026-04-25 against the BPC-157 template.
NAME_BOX     = (528, 455, 692, 508)   # cream serif compound name
DOSE_BOX     = (572, 534, 628, 554)   # text inside the gold pill — leaves the border alone
DATA_BOX     = (532, 555, 700, 605)   # 3-line mono data block (Formula / MW / CAS)
QR_BOX       = (700, 695, 880, 820)   # caption inside the dashed QR placeholder

# Fonts (system)
SERIF_PATH   = "/System/Library/Fonts/NewYork.ttf"
MONO_PATH    = "/System/Library/Fonts/SFNSMono.ttf"
SANS_PATH    = "/System/Library/Fonts/Helvetica.ttc"


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def stamp(img: Image.Image, name: str, dose: str, formula: str,
          mw: str, cas: str | None) -> Image.Image:
    out = img.copy()
    d = ImageDraw.Draw(out)

    # 1) name — cream serif, auto-sized so the longest names still fit
    name_font_size = 38
    if len(name) > 11: name_font_size = 32
    if len(name) > 16: name_font_size = 26
    if len(name) > 20: name_font_size = 22
    nf = font(SERIF_PATH, name_font_size)

    d.rectangle(NAME_BOX, fill=MAROON)
    # Vertically center inside NAME_BOX
    cx = (NAME_BOX[0] + NAME_BOX[2]) / 2
    cy = (NAME_BOX[1] + NAME_BOX[3]) / 2
    bbox = d.textbbox((0, 0), name, font=nf)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text((cx - tw / 2 - bbox[0], cy - th / 2 - bbox[1]), name, fill=CREAM, font=nf)

    # 2) dose pill text — gold mono. Mask only the inner text area to keep
    # the original gold pill border untouched.
    df = font(MONO_PATH, 14)
    d.rectangle(DOSE_BOX, fill=MAROON)
    cx = (DOSE_BOX[0] + DOSE_BOX[2]) / 2
    cy = (DOSE_BOX[1] + DOSE_BOX[3]) / 2
    bbox = d.textbbox((0, 0), dose, font=df)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text((cx - tw / 2 - bbox[0], cy - th / 2 - bbox[1]), dose, fill=GOLD, font=df)

    # 3) formula / MW / CAS — three lines of mono text
    mf_label = font(MONO_PATH, 11)
    mf_value = font(MONO_PATH, 11)
    d.rectangle(DATA_BOX, fill=MAROON)
    line_y = DATA_BOX[1] + 2
    line_h = 16
    for label, value in [("Formula", formula), ("MW", mw), ("CAS", cas or "—")]:
        if not value or value == "—":
            continue
        d.text((DATA_BOX[0], line_y), f"{label} ", fill=GOLD, font=mf_label)
        prefix_w = d.textlength(f"{label} ", font=mf_label)
        d.text((DATA_BOX[0] + prefix_w + 2, line_y), str(value), fill=CREAM, font=mf_value)
        line_y += line_h

    # 4) QR placeholder caption — centered three-line text
    qf = font(MONO_PATH, 10)
    cx = (QR_BOX[0] + QR_BOX[2]) / 2
    cy = (QR_BOX[1] + QR_BOX[3]) / 2
    lines = ["LOT COA", "QR CODE"]
    total_h = len(lines) * 16
    y = cy - total_h / 2
    for ln in lines:
        bbox = d.textbbox((0, 0), ln, font=qf)
        tw = bbox[2] - bbox[0]
        d.text((cx - tw / 2 - bbox[0], y - bbox[1]), ln, fill=GOLD, font=qf)
        y += 16

    return out


# ---------- catalog parser (lifted from per-sku-labels generate.py) ----------
def parse_catalog():
    src = (ROOT / "src" / "lib" / "catalog" / "data.ts").read_text()
    m = re.search(r"export const PRODUCTS:[^=]+=\s*\[", src)
    arr_start = m.end()
    depth, i = 1, arr_start
    while i < len(src) and depth > 0:
        c = src[i]
        if c == "[": depth += 1
        elif c == "]": depth -= 1
        i += 1
    body = src[arr_start: i - 1]
    blocks, depth, start = [], 0, None
    for j, c in enumerate(body):
        if c == "{":
            if depth == 0: start = j
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0 and start is not None:
                blocks.append(body[start: j + 1])
                start = None

    def field(block, name):
        m = re.search(rf'{name}:\s*("(?:[^"\\]|\\.)*"|null|[\d\.]+)', block)
        if not m: return None
        raw = m.group(1)
        if raw == "null": return None
        if raw.startswith('"'): return raw[1:-1]
        return raw

    out = []
    for b in blocks:
        slug = field(b, "slug")
        if not slug: continue
        name = field(b, "name") or ""
        cas = field(b, "cas_number")
        formula = field(b, "molecular_formula")
        mw = field(b, "molecular_weight")
        # First variant for the dose; sku from there
        vm = re.search(r"variants:\s*\[(.*?)\]\s*,?\s*\}", b, re.DOTALL)
        dose_mg = None
        if vm:
            vmatch = re.search(r"size_mg:\s*([\d\.]+)", vm.group(1))
            if vmatch: dose_mg = float(vmatch.group(1))
        out.append({
            "slug": slug, "name": name, "cas": cas, "formula": formula,
            "mw": float(mw) if mw else None, "dose_mg": dose_mg,
        })
    return out


def display_name(name):
    """Strip dose suffix and parentheticals — same rules as the label generator."""
    s = re.sub(r"\s+\d+(?:\.\d+)?\s*/\s*\d+(?:\.\d+)?\s*(?:mg|ml|g)\s*$", "", name, flags=re.IGNORECASE)
    s = re.sub(r"\s+\d+(?:\.\d+)?(?:mg|ml|g)\s*$", "", s, flags=re.IGNORECASE)
    s = re.sub(r"\s*\(liquid\)\s*", " ", s, flags=re.IGNORECASE).strip()
    s = s.replace("CJC-1295 (no DAC) + Ipamorelin", "CJC-1295 + Ipamorelin")
    s = s.replace("CJC-1295 (no DAC)", "CJC-1295")
    s = re.sub(r"\s*\([^)]*\)\s*$", "", s).strip()
    return re.sub(r"\bwith\b", "w/", s, flags=re.IGNORECASE)


def fmt_mw(mw):
    if mw is None: return ""
    return f"{mw:.2f}".rstrip("0").rstrip(".") + " g/mol"


def output_filename(slug, dose_mg, container):
    if dose_mg and dose_mg >= 1:
        suffix = f"{int(dose_mg)}mg" if dose_mg == int(dose_mg) else f"{dose_mg}mg"
    elif "10ml" in (container or "") or dose_mg == 0:
        suffix = "10ml"
    else:
        suffix = f"{dose_mg}mg"
    return f"{slug}-{suffix}.jpg"


def main():
    template = Image.open(TEMPLATE).convert("RGB")
    products = parse_catalog()
    print(f"products: {len(products)}")
    for p in products:
        out_name = display_name(p["name"])
        dose = p["dose_mg"]
        if dose is None: continue
        if dose >= 1 and dose == int(dose):
            dose_label = f"{int(dose)} MG"
        elif dose >= 1:
            dose_label = f"{dose} MG"
        else:
            dose_label = "10 ML"
        formula = p["formula"] or ""
        mw = fmt_mw(p["mw"]) if p["mw"] else ""
        cas = p["cas"] or None
        # Use blank mw/cas for products without lab data (like coded GLP / blends)
        if not formula and not mw:
            formula, mw, cas = "See COA", "—", "—"
        out = stamp(template, out_name, dose_label, formula, mw, cas)
        # Filename: use lowest-dose variant
        slug = p["slug"]
        # Strip dose suffix from slug if present (e.g. "bpc-157-5mg" → "bpc-157")
        slug_clean = re.sub(r"-\d+(?:\.\d+)?(?:mg|ml)?$", "", slug)
        out_filename = output_filename(slug_clean, dose, "")
        out_path = OUT_DIR / out_filename
        out.save(out_path, quality=92)
        print(f"  wrote {out_filename}")


if __name__ == "__main__":
    main()
