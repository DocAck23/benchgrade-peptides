"""Tight-crop the transparent F6 PNGs to the bounding box of opaque pixels.
After background removal the canvas still includes the original rectangle
of empty cream/maroon pixels — those reserve layout space when embedded.
Cropping to the alpha-channel bbox makes the visible logo fill the
container exactly.
"""
from PIL import Image
from pathlib import Path

ROOT = Path("/Users/ahmed/Research Only Peptides/benchgrade-peptides/research/vial-templates")


def tight_crop(in_path: Path, out_path: Path, alpha_threshold: int = 32) -> None:
    img = Image.open(in_path).convert("RGBA")
    alpha = img.split()[-1]
    # threshold so faint halo pixels don't widen the bbox
    mask = alpha.point(lambda v: 255 if v >= alpha_threshold else 0)
    bbox = mask.getbbox()
    if bbox is None:
        print(f"!! {in_path} is fully transparent")
        return
    cropped = img.crop(bbox)
    cropped.save(out_path, "PNG", optimize=True)
    w0, h0 = img.size
    w1, h1 = cropped.size
    print(f"{in_path.name}: {w0}x{h0} → {w1}x{h1} (saved {out_path.name})")


tight_crop(ROOT / "F6-gold-transparent.png",   ROOT / "F6-gold-tight.png",   alpha_threshold=140)
tight_crop(ROOT / "F6-maroon-transparent.png", ROOT / "F6-maroon-tight.png", alpha_threshold=140)
