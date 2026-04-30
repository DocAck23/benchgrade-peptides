#!/usr/bin/env python3
"""
Convert Glacial Indifference .otf files to .woff2 for HTTP/2-friendly
self-hosting via next/font/local.

Why: codex Review #1 (sub-project A · Foundation, finding H6) flagged
that the original plan's `@font-face` + `.otf` approach is suboptimal
for Next 16. `.woff2` is half the size, ships compressed, and is what
`next/font/local` recommends.

Usage:
  python3 scripts/convert-fonts-to-woff2.py
"""

from __future__ import annotations
import sys
from pathlib import Path

try:
    from fontTools.ttLib import TTFont
except ImportError:
    sys.exit(
        "fonttools not installed. Install with:\n"
        "  pip3 install --user --break-system-packages fonttools brotli"
    )


def convert(otf_path: Path) -> Path:
    """Read an OTF file, write the .woff2 next to it. Returns the woff2 path."""
    woff2_path = otf_path.with_suffix(".woff2")
    font = TTFont(str(otf_path))
    font.flavor = "woff2"
    font.save(str(woff2_path))
    return woff2_path


def main() -> int:
    fonts_dir = Path("public/fonts/glacial-indifference")
    if not fonts_dir.exists():
        sys.exit(f"Fonts directory not found: {fonts_dir.absolute()}")

    otf_files = sorted(fonts_dir.glob("*.otf"))
    if not otf_files:
        sys.exit(f"No .otf files in {fonts_dir.absolute()}")

    for otf in otf_files:
        woff2 = convert(otf)
        print(
            f"  {otf.name} ({otf.stat().st_size:,} bytes)"
            f"  →  {woff2.name} ({woff2.stat().st_size:,} bytes)"
        )

    print("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
