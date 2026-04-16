#!/usr/bin/env python3
"""
Post-process See-through layers: remove content bleed across body zones.

Problem: full-frame layers (topwear, legwear, face, etc.) have AI segmentation
noise that leaks content into distant body zones, making upper/lower body
separation impossible.

Solution: mask each layer to its expected zone with smooth feathered edges.

Usage:
  ~/miniconda3/bin/python3 scripts/clean_layer_bleed.py [character]
  ~/miniconda3/bin/python3 scripts/clean_layer_bleed.py isaya
  ~/miniconda3/bin/python3 scripts/clean_layer_bleed.py --all
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

PROJECT_DIR = Path(__file__).parent.parent
LAYERS_BASE = PROJECT_DIR / "public" / "layers"

CHARACTERS = ["isaya", "algram", "jenny"]


def feather_mask(h: int, w: int, y_top: int, y_bottom: int, feather: int = 30) -> np.ndarray:
    """
    Create a vertical mask: 1.0 inside [y_top, y_bottom], smooth fade at edges.
    Returns float32 array (h, w) in [0, 1].
    """
    mask = np.zeros((h, w), dtype=np.float32)
    for y in range(h):
        if y < y_top - feather:
            mask[y] = 0.0
        elif y < y_top:
            # Fade in
            mask[y] = (y - (y_top - feather)) / feather
        elif y <= y_bottom:
            mask[y] = 1.0
        elif y < y_bottom + feather:
            # Fade out
            mask[y] = 1.0 - (y - y_bottom) / feather
        else:
            mask[y] = 0.0
    return mask


def find_body_landmarks(char_dir: Path, meta: dict) -> dict:
    """
    Auto-detect body zone boundaries from layer content.
    Returns dict with y-coordinates for zone transitions.
    """
    W, H = meta["frame_size"]

    # Use specific layers to find landmarks
    landmarks = {}

    for l in meta["layers"]:
        tag = l["tag"]
        x1, y1, x2, y2 = l["xyxy"]
        safe = tag.replace(" ", "_").replace("/", "_")
        path = char_dir / f"{safe}.png"
        if not path.exists():
            continue

        img = np.array(Image.open(path).convert("RGBA"))
        alpha = img[:, :, 3]

        if tag == "face":
            # Face bottom → neck/torso transition
            visible_rows = np.where(alpha.max(axis=1) > 50)[0]
            if len(visible_rows) > 0:
                # Main face content (ignore scattered bleed)
                # Find the row where cumulative alpha reaches 95%
                row_sums = np.array([alpha[r].sum() for r in visible_rows])
                cumsum = np.cumsum(row_sums)
                total = cumsum[-1]
                idx_95 = np.searchsorted(cumsum, total * 0.95)
                landmarks["face_bottom"] = int(visible_rows[min(idx_95, len(visible_rows) - 1)])

        elif tag == "topwear":
            # Topwear: find where main content starts and the waist line
            if x1 == 0 and y1 == 0:  # full frame
                visible_rows = np.where(alpha.max(axis=1) > 50)[0]
                if len(visible_rows) > 0:
                    landmarks["topwear_top"] = int(visible_rows[0])
                    # Waist = where topwear content drops off
                    row_sums = np.array([alpha[r].sum() for r in visible_rows])
                    cumsum = np.cumsum(row_sums)
                    total = cumsum[-1]
                    idx_85 = np.searchsorted(cumsum, total * 0.85)
                    landmarks["waist"] = int(visible_rows[min(idx_85, len(visible_rows) - 1)])

        elif tag == "bottomwear":
            visible_rows = np.where(alpha.max(axis=1) > 50)[0]
            if len(visible_rows) > 0:
                landmarks["bottomwear_top"] = int(visible_rows[0])
                landmarks["bottomwear_bottom"] = int(visible_rows[-1])

        elif tag == "legwear":
            visible_rows = np.where(alpha.max(axis=1) > 50)[0]
            if len(visible_rows) > 0:
                landmarks["legwear_top"] = int(visible_rows[0])

        elif tag == "footwear":
            visible_rows = np.where(alpha.max(axis=1) > 50)[0]
            if len(visible_rows) > 0:
                landmarks["footwear_top"] = int(visible_rows[0])

    return landmarks


# Zone rules: (tag, zone_top_key, zone_bottom_key)
# Each layer will be masked to only keep content within its zone.
# Keys reference landmarks dict; None means frame edge.
ZONE_RULES = {
    # HEAD zone: keep above face_bottom + margin
    "face":       ("top", "face_bottom+60"),
    "nose":       ("top", "face_bottom+60"),
    "mouth":      ("top", "face_bottom+60"),
    "neck":       ("face_bottom-30", "waist+20"),
    "headwear":   ("top", "face_bottom+80"),
    "eyewear":    ("top", "face_bottom+60"),

    # UPPER BODY: from shoulder to waist
    "topwear":    ("topwear_top-10", "waist+40"),

    # LOWER BODY
    "bottomwear": ("bottomwear_top-10", "bottomwear_bottom+20"),
    "legwear":    ("legwear_top-10", "footwear_top+20"),
    "footwear":   ("footwear_top-10", "bottom"),

    # HAIR: head zone + some torso for long hair
    "front hair": ("top", "waist"),
    "back hair":  ("top", "waist"),
}


def resolve_bound(expr: str, landmarks: dict, frame_h: int) -> int:
    """Resolve a bound expression like 'face_bottom+60' to a Y value."""
    if expr == "top":
        return 0
    if expr == "bottom":
        return frame_h

    # Parse "landmark_name+offset" or "landmark_name-offset"
    for op in ["+", "-"]:
        if op in expr:
            parts = expr.split(op)
            key = parts[0].strip()
            offset = int(parts[1].strip())
            base = landmarks.get(key)
            if base is None:
                return 0 if op == "-" else frame_h
            return base + offset if op == "+" else base - offset

    # Just a landmark name
    val = landmarks.get(expr)
    return val if val is not None else frame_h


def clean_character(char: str, dry_run: bool = False) -> None:
    char_dir = LAYERS_BASE / char
    meta_path = char_dir / "metadata.json"
    if not meta_path.exists():
        print(f"  ✗ No metadata for {char}")
        return

    with open(meta_path) as f:
        meta = json.load(f)

    W, H = meta["frame_size"]

    # Detect body landmarks
    landmarks = find_body_landmarks(char_dir, meta)
    print(f"\n  Landmarks:")
    for k, v in sorted(landmarks.items()):
        print(f"    {k}: y={v}")

    # Process each full-frame layer
    cleaned = 0
    for l in meta["layers"]:
        tag = l["tag"]
        x1, y1, x2, y2 = l["xyxy"]
        is_full = (x1 == 0 and y1 == 0 and x2 == W and y2 == H)

        if tag not in ZONE_RULES:
            continue
        if not is_full:
            continue  # cropped layers don't need cleaning

        safe = tag.replace(" ", "_").replace("/", "_")
        path = char_dir / f"{safe}.png"
        if not path.exists():
            continue

        top_expr, bottom_expr = ZONE_RULES[tag]
        zone_top = resolve_bound(top_expr, landmarks, H)
        zone_bottom = resolve_bound(bottom_expr, landmarks, H)

        # Load and check current bleed
        img = Image.open(path).convert("RGBA")
        arr = np.array(img)
        alpha = arr[:, :, 3].astype(float)
        total = alpha.sum()

        if total < 100 * 255:
            continue

        # Content outside zone
        outside = alpha.copy()
        outside[max(0, zone_top):min(H, zone_bottom)] = 0
        bleed_pct = outside.sum() / total

        if bleed_pct < 0.01:
            # Less than 1% bleed, skip
            continue

        # Apply feathered mask
        mask = feather_mask(H, W, zone_top, zone_bottom, feather=25)
        new_alpha = (arr[:, :, 3].astype(float) * mask).clip(0, 255).astype(np.uint8)

        removed = int((arr[:, :, 3].astype(float) - new_alpha.astype(float)).clip(0).sum())
        print(f"  {'[DRY]' if dry_run else '     '} {tag:15s}  zone y={zone_top}-{zone_bottom}  "
              f"bleed={bleed_pct:.1%}  removed={removed/255:.0f}px")

        if not dry_run:
            arr[:, :, 3] = new_alpha
            Image.fromarray(arr).save(path)
            cleaned += 1

    print(f"\n  {'[DRY RUN]' if dry_run else f'Cleaned {cleaned} layers'}")


def main():
    args = sys.argv[1:]
    dry_run = "--dry-run" in args
    args = [a for a in args if not a.startswith("--")]

    if not args or "all" in args:
        targets = CHARACTERS
    else:
        targets = args

    for char in targets:
        print(f"\n{'='*60}")
        print(f"  {char.upper()}")
        print(f"{'='*60}")
        clean_character(char, dry_run=dry_run)


if __name__ == "__main__":
    main()
