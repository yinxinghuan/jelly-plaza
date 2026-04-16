#!/usr/bin/env python3
"""
Compress layer PNGs: crop to content bbox + convert to WebP.
Updates metadata.json xyxy to reflect new crop positions.

Usage:
  ~/miniconda3/bin/python3 scripts/compress_layers.py [--all | character]
"""
import json, sys
from pathlib import Path
from PIL import Image

BASE = Path(__file__).parent.parent / "public" / "layers"
CHARACTERS = ["isaya", "algram", "jenny"]
WEBP_QUALITY = 90  # good quality, much smaller than PNG


def compress_character(char: str) -> None:
    char_dir = BASE / char
    meta_path = char_dir / "metadata.json"
    with open(meta_path) as f:
        meta = json.load(f)

    total_before = 0
    total_after = 0

    for l in meta["layers"]:
        tag = l["tag"]
        safe = tag.replace(" ", "_").replace("/", "_")
        png_path = char_dir / f"{safe}.png"
        webp_path = char_dir / f"{safe}.webp"

        if not png_path.exists():
            continue

        img = Image.open(png_path).convert("RGBA")
        before_size = png_path.stat().st_size
        total_before += before_size

        bbox = img.getbbox()
        if not bbox:
            # Empty layer — write tiny webp
            img.crop((0, 0, 1, 1)).save(webp_path, "WEBP", quality=WEBP_QUALITY)
            l["xyxy"] = [0, 0, 1, 1]
        else:
            ox1, oy1 = l["xyxy"][0], l["xyxy"][1]
            # Crop to content
            cropped = img.crop(bbox)
            cropped.save(webp_path, "WEBP", quality=WEBP_QUALITY)
            # Update xyxy: shift by original offset + crop offset
            l["xyxy"] = [
                ox1 + bbox[0],
                oy1 + bbox[1],
                ox1 + bbox[2],
                oy1 + bbox[3],
            ]

        after_size = webp_path.stat().st_size
        total_after += after_size

        # Remove old PNG
        png_path.unlink()

        saved = before_size - after_size
        if saved > 10240:
            print(f"  {safe:20s} {before_size//1024:5d}KB → {after_size//1024:3d}KB (save {saved//1024}KB)")

    # Update file references in metadata: .png → .webp is handled by buildLayers

    meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False))
    print(f"  Total: {total_before//1024}KB → {total_after//1024}KB (save {(total_before-total_after)//1024}KB)")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    targets = CHARACTERS if not args or "--all" in sys.argv else args

    for char in targets:
        print(f"\n{char}:")
        compress_character(char)


if __name__ == "__main__":
    main()
