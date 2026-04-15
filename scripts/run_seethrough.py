#!/usr/bin/env python3
"""
Submit character images to See-through API for layer decomposition.
Downloads 17 semantic layer PNGs per character.

Usage:
  ~/miniconda3/bin/python3 scripts/run_seethrough.py
"""
import json
import sys
import time
from pathlib import Path

import requests
from PIL import Image

API_BASE = "https://u545921-2wvn-c338e6ee.westb.seetacloud.com:8443/api/v1"
POLL_INTERVAL = 10  # seconds

PROJECT_DIR = Path(__file__).parent.parent
INPUT_DIR = PROJECT_DIR / "public" / "characters"
OUTPUT_BASE = PROJECT_DIR / "public" / "layers"

CHARACTERS = ["isaya", "algram", "jenny"]

LAYER_TAGS = [
    "headwear", "back_hair", "handwear", "footwear", "legwear",
    "neck", "bottomwear", "topwear", "ears", "face",
    "nose", "mouth", "eyebrow", "eyelash", "eyewhite",
    "front_hair", "irides",
]


def prepare_image(src: Path, out_dir: Path) -> Path:
    """RGBA → RGB white bg, pad to square 1152×1152."""
    img = Image.open(src).convert("RGBA")
    w, h = img.size
    size = max(w, h, 1152)

    bg = Image.new("RGB", (size, size), (255, 255, 255))
    offset_x = (size - w) // 2
    offset_y = (size - h) // 2
    bg.paste(img, (offset_x, offset_y), img)

    out = out_dir / "input_padded.png"
    bg.save(out)
    print(f"  [prep] {src.name} ({w}x{h}) → padded {size}x{size}")
    return out


def submit_task(image_path: Path) -> str:
    config = {
        "resolution": 1280,
        "inference_steps": 30,
        "save_to_psd": False,
    }
    with open(image_path, "rb") as f:
        resp = requests.post(
            f"{API_BASE}/tasks",
            files={"image": (image_path.name, f, "image/png")},
            data={"config": json.dumps(config)},
            timeout=30,
        )
    resp.raise_for_status()
    data = resp.json()
    task_id = data["task_id"]
    print(f"  [submit] task_id={task_id}")
    return task_id


def poll_task(task_id: str) -> dict:
    url = f"{API_BASE}/tasks/{task_id}"
    while True:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        status = data["status"]
        progress = data.get("progress") or {}
        msg = progress.get("message", "")
        pct = progress.get("stage_progress") or 0
        print(f"  [poll] {status} {msg} ({pct:.0%})")

        if status == "completed":
            return data
        elif status == "failed":
            print(f"  [error] {data.get('error', 'unknown')}")
            return None

        time.sleep(POLL_INTERVAL)


def download_layers(task_id: str, layer_tags: list[str], out_dir: Path) -> dict:
    """Download individual layer PNGs. Returns metadata with positions."""
    base = f"{API_BASE}/tasks/{task_id}/files"
    out_dir.mkdir(parents=True, exist_ok=True)

    # Metadata
    resp = requests.get(f"{base}/metadata", timeout=15)
    resp.raise_for_status()
    metadata = resp.json()
    meta_path = out_dir / "metadata.json"
    meta_path.write_text(json.dumps(metadata, indent=2, ensure_ascii=False))
    print(f"  [dl] metadata → {meta_path}")

    # Individual layers
    for tag in layer_tags:
        resp = requests.get(f"{base}/layer/{tag}.png", timeout=30)
        if resp.status_code == 404:
            print(f"  [dl] {tag}.png → 404, skipping")
            continue
        resp.raise_for_status()
        layer_path = out_dir / f"{tag}.png"
        layer_path.write_bytes(resp.content)
        size_kb = len(resp.content) // 1024
        print(f"  [dl] {tag}.png ({size_kb} KB)")

    return metadata


def process_character(name: str) -> bool:
    print(f"\n{'='*60}")
    print(f"  Processing: {name}")
    print(f"{'='*60}")

    input_path = INPUT_DIR / f"{name}.png"
    if not input_path.exists():
        print(f"  ✗ Input not found: {input_path}")
        return False

    out_dir = OUTPUT_BASE / name
    # Check if already processed
    if (out_dir / "metadata.json").exists():
        print(f"  ⏭ Already processed: {out_dir}")
        return True

    out_dir.mkdir(parents=True, exist_ok=True)

    # Step 1: Prepare
    padded = prepare_image(input_path, out_dir)

    # Step 2: Submit
    task_id = submit_task(padded)

    # Step 3: Poll
    result = poll_task(task_id)
    if result is None:
        return False

    # Step 4: Download layers
    layers_info = result.get("result", {}).get("layers", [])
    tags = [l["tag"] for l in layers_info]
    print(f"  [info] {len(tags)} layers: {tags}")

    download_layers(task_id, tags, out_dir)

    # Clean up padded input
    (out_dir / "input_padded.png").unlink(missing_ok=True)

    print(f"  ✓ Done: {out_dir}")
    return True


def main():
    results = {}
    for name in CHARACTERS:
        ok = process_character(name)
        results[name] = ok

    print(f"\n{'='*60}")
    for name, ok in results.items():
        print(f"  {'✓' if ok else '✗'} {name}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
