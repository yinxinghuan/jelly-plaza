#!/usr/bin/env python3
"""
Auto-detect arm shoulder pivot from body-arm overlap.

Writes `pivot` field into metadata.json for each handwear layer.
The pivot is where the arm first enters the body (top of overlap region),
expressed as % of the arm crop size.

Usage:
  ~/miniconda3/bin/python3 scripts/detect_pivots.py [--all | character_name]
"""
import json, sys
import numpy as np
from PIL import Image
from pathlib import Path

BASE = Path(__file__).parent.parent / "public" / "layers"
CHARACTERS = ["isaya", "algram", "jenny"]


def detect_pivots(char: str) -> None:
    meta_path = BASE / char / "metadata.json"
    with open(meta_path) as f:
        meta = json.load(f)
    W, H = meta["frame_size"]

    # Build body alpha canvas from topwear
    body = np.zeros((H, W), dtype=np.uint8)
    for l in meta["layers"]:
        if l["tag"] == "topwear":
            x1, y1, x2, y2 = l["xyxy"]
            img = np.array(Image.open(BASE / char / "topwear.png").convert("RGBA"))
            body[y1:y1+img.shape[0], x1:x1+img.shape[1]] = img[:, :, 3]

    changed = False
    for l in meta["layers"]:
        if not l["tag"].startswith("handwear"):
            continue

        x1, y1, x2, y2 = l["xyxy"]
        safe = l["tag"].replace(" ", "_").replace("/", "_")
        arm = np.array(Image.open(BASE / char / f"{safe}.png").convert("RGBA"))

        arm_canvas = np.zeros((H, W), dtype=np.uint8)
        arm_canvas[y1:y1+arm.shape[0], x1:x1+arm.shape[1]] = arm[:, :, 3]

        overlap = (body > 50) & (arm_canvas > 50)
        rows = np.where(overlap.any(axis=1))[0]

        if len(rows) == 0:
            print(f"  {char}/{l['tag']}: no overlap, skipping")
            continue

        top_y = int(rows[0])
        band = overlap[top_y:top_y + 10, :]
        cols = np.where(band.any(axis=0))[0]
        sx = int(cols.mean()) if len(cols) else (x1 + x2) // 2
        sy = top_y

        crop_w, crop_h = x2 - x1, y2 - y1
        pct_x = round((sx - x1) / crop_w * 100, 1)
        pct_y = round((sy - y1) / crop_h * 100, 1)

        l["pivot"] = {"x": pct_x, "y": pct_y}
        changed = True
        print(f"  {char}/{l['tag']}: pivot = ({pct_x}%, {pct_y}%)")

    if changed:
        meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False))
        print(f"  → Updated {meta_path.name}")


def main():
    targets = CHARACTERS if "--all" in sys.argv or len(sys.argv) < 2 else [a for a in sys.argv[1:] if not a.startswith("--")]
    for c in targets:
        print(f"\n{c}:")
        detect_pivots(c)


if __name__ == "__main__":
    main()
