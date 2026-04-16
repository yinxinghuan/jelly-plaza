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

API_BASE = "https://u545921-y536-57d94c97.westd.seetacloud.com:8443/api/v1"
POLL_INTERVAL = 10  # seconds

PROJECT_DIR = Path(__file__).parent.parent
INPUT_DIR = PROJECT_DIR / "public" / "characters"
OUTPUT_BASE = PROJECT_DIR / "public" / "layers"

CHARACTERS = ["isaya", "algram", "jenny"]

  # Layer tags are now returned dynamically by the API (21 layers with L/R split)


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


def download_layers(task_id: str, result: dict, out_dir: Path) -> None:
    """Download individual layer PNGs + save metadata from task result."""
    import urllib.parse
    base = f"{API_BASE}/tasks/{task_id}/files"
    out_dir.mkdir(parents=True, exist_ok=True)

    # Save metadata from task result (API no longer serves /files/metadata)
    meta_path = out_dir / "metadata.json"
    meta_path.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"  [dl] metadata → {meta_path}")

    # Individual layers (tags may contain spaces, need URL encoding)
    layers_info = result.get("layers", [])
    for layer in layers_info:
        tag = layer["tag"]
        encoded_tag = urllib.parse.quote(tag)
        resp = requests.get(f"{base}/layer/{encoded_tag}.png", timeout=30)
        if resp.status_code == 404:
            print(f"  [dl] {tag}.png → 404, skipping")
            continue
        resp.raise_for_status()
        # Sanitize filename: replace spaces with underscores
        safe_name = tag.replace(" ", "_").replace("/", "_")
        layer_path = out_dir / f"{safe_name}.png"
        layer_path.write_bytes(resp.content)
        size_kb = len(resp.content) // 1024
        print(f"  [dl] {tag} → {safe_name}.png ({size_kb} KB)")


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
    result_data = result.get("result", {})
    layers_info = result_data.get("layers", [])
    tags = [l["tag"] for l in layers_info]
    print(f"  [info] {len(tags)} layers: {tags}")
    print(f"  [info] frame_size: {result_data.get('frame_size')}")

    download_layers(task_id, result_data, out_dir)

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
