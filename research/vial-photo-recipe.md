# Vial Photo Generation Recipe

Approved 2026-04-25 from BPC-157 5mg prototype. Use this recipe verbatim
for every product so the catalog stays visually consistent.

## Inputs per product

1. **Label PNG** — render the SKU's SVG to PNG at 1800px wide:
   ```
   qlmanage -t -s 1800 -o /tmp research/per-sku-labels/<SKU>.svg
   ```
   Use the lowest-dose SKU per product as the canonical reference.

2. **F6 logo PNG** (constant across all products) — render once:
   ```
   qlmanage -t -s 1500 -o /tmp public/brand/logo-f6.svg
   ```

3. **Upload both** to a public host (tmpfiles.org `/dl/<id>/<name>.png`)
   so the image generator can fetch them.

## Generator call

Pass both reference URLs as `image_urls`. Prompt template:

> Photograph of a 3ml clear glass laboratory vial. Three-quarter front
> view, rotated ~5° to the left. The label wrapped around the vial is
> the EXACT artwork in image 1 (maroon #5C1A1A stock, gold #B8923A
> elements, compound name in cream serif, gold dose pill, formula data,
> RESEARCH PEPTIDE pill, LOT/EXP block, dashed QR placeholder, 99%
> PURITY · HPLC VERIFIED gold banner, FOR RESEARCH USE ONLY caption,
> footer line). The wreath logo on the left side of the label MUST look
> like image 2 — a Victorian chemist leaning into a microscope on a
> desk with flasks beside him, ringed by a gold laurel wreath, with
> "BENCH GRADE PEPTIDES" serif wordmark below. Recognizable chemist +
> microscope, not a generic crest. Matte gold crimp cap with rubber
> stopper, white peptide powder filling ~70% of the vial. Cream
> apothecary backdrop (#F2EAD9), soft warm directional light from
> upper-left, subtle drop shadow, square 1:1 framing, vial fills
> ~70-75% of frame. Catalog product shot — clinical, premium, no props.

## Output

Save each result to `public/brand/vials/<slug>.jpg` where `<slug>` is
the product slug (e.g. `bpc-157.jpg`, `tb-500.jpg`).

## Approved canonical photo (front shot)

- BPC-157 5mg → `public/brand/vials/bpc-157-5mg.jpg`
- Source: https://rqkumunldqvmynqxibca.supabase.co/storage/v1/object/public/generated-images/adhoc-1777151602914.jpeg

## Multi-angle gallery (phase 2)

After all 65 catalog products have a canonical front shot, generate
4 additional angles per product for the product-page 360 gallery:

1. **Front-3/4 (left)** — the canonical (this recipe). Wreath visible,
   compound name centered, hint of LOT/QR on right edge.
2. **Right-quarter** — vial rotated ~30° left. LOT/EXP block, RESEARCH
   PEPTIDE pill, and dashed QR placeholder dominate the visible face.
3. **Right side** — pure profile of the right edge of the label.
4. **Back** — label seam, mostly maroon with minimal text visible.
5. **Left-quarter** — vial rotated ~30° right. Wreath + chemist +
   "BENCH GRADE PEPTIDES" wordmark dominate the face.

Save as `public/brand/vials/<slug>/<angle>.jpg` (front, right-quarter,
right, back, left-quarter).

## Batch plan

`research/vial-photo-batch-plan.json` — 65 products in priority order
(launch lineup first, then alphabetical), each with the SKU code that
should source the label PNG.
