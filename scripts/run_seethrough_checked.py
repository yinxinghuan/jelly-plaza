#!/usr/bin/env python3
"""
See-through API with quality validation + auto-retry.

"抽卡"机制：每次提交用不同 seed，检查分层质量，不合格自动重试。

Usage:
  ~/miniconda3/bin/python3 scripts/run_seethrough_checked.py [character_name]
  ~/miniconda3/bin/python3 scripts/run_seethrough_checked.py jenny
  ~/miniconda3/bin/python3 scripts/run_seethrough_checked.py --all
"""
import json
import os
import random
import shutil
import sys
import time
import urllib.parse
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import requests
from PIL import Image

# ── Config ───────────────────────────────────────────────────────
API_BASE = "https://u545921-y536-57d94c97.westd.seetacloud.com:8443/api/v1"
POLL_INTERVAL = 10
MAX_ATTEMPTS = 10

PROJECT_DIR = Path(__file__).parent.parent
INPUT_DIR = PROJECT_DIR / "public" / "characters"
OUTPUT_BASE = PROJECT_DIR / "public" / "layers"

CHARACTERS = ["isaya", "algram", "jenny"]

# ── Quality Check ────────────────────────────────────────────────

@dataclass
class QualityReport:
    """Quality check result for a set of layers."""
    passed: bool = True
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def fail(self, msg: str):
        self.passed = False
        self.errors.append(msg)

    def warn(self, msg: str):
        self.warnings.append(msg)

    def __str__(self):
        lines = []
        if self.passed:
            lines.append("✓ PASSED")
        else:
            lines.append("✗ FAILED")
        for e in self.errors:
            lines.append(f"  ✗ {e}")
        for w in self.warnings:
            lines.append(f"  ⚠ {w}")
        return "\n".join(lines)


def check_quality(layers_dir: Path, original_img: Image.Image) -> QualityReport:
    """
    Validate layer decomposition quality.

    Checks:
    1. Coverage: composite covers ≥90% of original opaque area
    2. Topwear integrity: not heavily cropped (should cover body center)
    3. Eye completeness: all 6 eye layers exist with content
    4. Neck continuity: no transparent gap in neck zone
    5. No corner artifacts: small layers at canvas edges are artifacts
    6. Face layer exists and is substantial
    """
    report = QualityReport()
    meta_path = layers_dir / "metadata.json"

    if not meta_path.exists():
        report.fail("metadata.json not found")
        return report

    with open(meta_path) as f:
        meta = json.load(f)

    layers = meta.get("layers", [])
    frame_size = meta.get("frame_size", [1280, 1280])
    W, H = frame_size

    tags = {l["tag"] for l in layers}

    # ── Check 1: Required layers exist ──
    required = {"face", "neck", "front hair", "topwear"}
    missing = required - tags
    if missing:
        report.fail(f"Missing required layers: {missing}")

    # ── Check 2: Eye completeness ──
    eye_tags = {"eyewhite-r", "eyewhite-l", "irides-r", "irides-l", "eyelash-r", "eyelash-l"}
    missing_eyes = eye_tags - tags
    if missing_eyes:
        report.fail(f"Missing eye layers: {missing_eyes}")

    for eye_tag in eye_tags & tags:
        safe = eye_tag.replace(" ", "_").replace("/", "_")
        img_path = layers_dir / f"{safe}.png"
        if img_path.exists():
            img = Image.open(img_path).convert("RGBA")
            arr = np.array(img)
            visible = (arr[:, :, 3] > 30).sum()
            if visible < 50:
                report.fail(f"Eye layer '{eye_tag}' nearly empty ({visible}px)")
        else:
            report.fail(f"Eye layer file missing: {safe}.png")

    # ── Check 3: Topwear not heavily cropped ──
    for l in layers:
        if l["tag"] == "topwear":
            x1, y1, x2, y2 = l["xyxy"]
            tw_width = x2 - x1
            tw_height = y2 - y1
            # Topwear should be full-frame or nearly so.
            # A heavily cropped topwear means the clothing got split.
            if not (x1 == 0 and y1 == 0 and x2 == W and y2 == H):
                # Cropped topwear: must start within left 35% of frame
                if x1 > W * 0.35:
                    report.fail(
                        f"Topwear cropped too far right: starts at x={x1} "
                        f"({x1/W:.0%}), clothing likely split"
                    )
                if tw_width < W * 0.5:
                    report.fail(
                        f"Topwear too narrow: {tw_width}px "
                        f"({tw_width/W:.0%} of frame)"
                    )

    # ── Check 4: Corner artifact detection ──
    CORNER_MARGIN = 50  # px from edge
    for l in layers:
        x1, y1, x2, y2 = l["xyxy"]
        w, h = x2 - x1, y2 - y1
        # Tiny layers near corners are usually artifacts
        if w < 30 and h < 30:
            near_corner = (
                (x1 < CORNER_MARGIN or x2 > W - CORNER_MARGIN) and
                (y1 < CORNER_MARGIN or y2 > H - CORNER_MARGIN)
            )
            if near_corner:
                report.warn(f"Possible corner artifact: '{l['tag']}' at ({x1},{y1})-({x2},{y2})")

    # ── Check 5: Neck continuity (composite alpha in neck zone) ──
    # Composite all layers
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for l in layers:
        x1, y1, x2, y2 = l["xyxy"]
        safe = l["tag"].replace(" ", "_").replace("/", "_")
        img_path = layers_dir / f"{safe}.png"
        if not img_path.exists():
            continue
        layer_img = Image.open(img_path).convert("RGBA")
        canvas.paste(layer_img, (x1, y1), layer_img)

    composite = np.array(canvas)

    # Find the character's vertical extent by checking original image
    orig_arr = np.array(original_img.convert("RGBA"))
    orig_alpha = orig_arr[:, :, 3]
    visible_rows = np.where(orig_alpha.max(axis=1) > 128)[0]
    if len(visible_rows) == 0:
        report.fail("Original image has no visible content")
        return report

    char_top = visible_rows[0]
    char_bottom = visible_rows[-1]
    char_height = char_bottom - char_top

    # Neck zone: roughly 15-25% from top of character
    neck_y_start = char_top + int(char_height * 0.15)
    neck_y_end = char_top + int(char_height * 0.28)

    # Find horizontal center (where the character body is)
    visible_cols = np.where(orig_alpha.max(axis=0) > 128)[0]
    char_left = visible_cols[0]
    char_right = visible_cols[-1]
    center_x = (char_left + char_right) // 2
    x_range = slice(center_x - 40, center_x + 40)

    # Check composite alpha in neck zone center
    neck_alpha = composite[neck_y_start:neck_y_end, x_range, 3].astype(float)
    if neck_alpha.size > 0:
        mean_alpha = neck_alpha.mean()
        min_row_alpha = neck_alpha.mean(axis=1).min()
        if min_row_alpha < 150:
            report.warn(f"Weak neck coverage: min_row_alpha={min_row_alpha:.0f} (zone y={neck_y_start}-{neck_y_end})")

    # ── Check 6: Overall coverage ──
    # Original opaque pixels vs composite opaque pixels
    orig_opaque = (orig_alpha > 128).sum()
    comp_alpha = composite[:, :, 3]
    comp_opaque = (comp_alpha > 80).sum()

    if orig_opaque > 0:
        coverage = comp_opaque / orig_opaque
        if coverage < 0.85:
            report.fail(f"Low coverage: {coverage:.0%} of original ({comp_opaque} vs {orig_opaque} px)")
        elif coverage < 0.92:
            report.warn(f"Coverage slightly low: {coverage:.0%}")

    # ── Check 7: Face layer should be substantial ──
    for l in layers:
        if l["tag"] == "face":
            safe = "face"
            img_path = layers_dir / f"{safe}.png"
            if img_path.exists():
                face_arr = np.array(Image.open(img_path).convert("RGBA"))
                face_visible = (face_arr[:, :, 3] > 30).sum()
                if face_visible < 5000:
                    report.fail(f"Face layer too small: {face_visible}px")

    return report


# ── API functions ────────────────────────────────────────────────

def prepare_image(src: Path) -> Path:
    """RGBA → RGB white bg, pad to square ≥1152."""
    img = Image.open(src).convert("RGBA")
    w, h = img.size
    size = max(w, h, 1152)
    bg = Image.new("RGB", (size, size), (255, 255, 255))
    bg.paste(img, ((size - w) // 2, (size - h) // 2), img)
    out = Path("/tmp") / f"{src.stem}_padded.png"
    bg.save(out)
    return out


def submit_task(image_path: Path, seed: int) -> str:
    config = {
        "resolution": 1280,
        "inference_steps": 30,
        "save_to_psd": False,
        "seed": seed,
    }
    with open(image_path, "rb") as f:
        resp = requests.post(
            f"{API_BASE}/tasks",
            files={"image": (image_path.name, f, "image/png")},
            data={"config": json.dumps(config)},
            timeout=30,
        )
    resp.raise_for_status()
    task_id = resp.json()["task_id"]
    return task_id


def poll_task(task_id: str) -> dict | None:
    url = f"{API_BASE}/tasks/{task_id}"
    retries = 0
    while True:
        try:
            resp = requests.get(url, timeout=20)
            resp.raise_for_status()
            data = resp.json()
            retries = 0  # reset on success
        except (requests.exceptions.RequestException, ValueError) as e:
            retries += 1
            if retries > 5:
                print(f"    [ERROR] Too many network failures: {e}")
                return None
            print(f"    [RETRY {retries}/5] {type(e).__name__}, waiting...")
            time.sleep(POLL_INTERVAL * 2)
            continue

        status = data["status"]
        progress = data.get("progress") or {}
        msg = progress.get("message", "")
        pct = progress.get("stage_progress") or 0
        print(f"    [{status}] {msg} ({pct:.0%})")

        if status == "completed":
            return data
        elif status == "failed":
            print(f"    [FAILED] {data.get('error', 'unknown')}")
            return None
        time.sleep(POLL_INTERVAL)


def download_layers(task_id: str, result: dict, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "metadata.json").write_text(json.dumps(result, indent=2, ensure_ascii=False))

    base = f"{API_BASE}/tasks/{task_id}/files"
    for layer in result.get("layers", []):
        tag = layer["tag"]
        encoded = urllib.parse.quote(tag)
        for retry in range(3):
            try:
                resp = requests.get(f"{base}/layer/{encoded}.png", timeout=30)
                if resp.status_code == 404:
                    break
                resp.raise_for_status()
                safe = tag.replace(" ", "_").replace("/", "_")
                (out_dir / f"{safe}.png").write_bytes(resp.content)
                break
            except requests.exceptions.RequestException:
                if retry < 2:
                    time.sleep(5)
                else:
                    print(f"    [WARN] Failed to download {tag} after 3 tries")


def fix_neck_alpha(layers_dir: Path):
    """Boost neck layer alpha to 255 where > threshold."""
    neck_path = layers_dir / "neck.png"
    if not neck_path.exists():
        return
    img = Image.open(neck_path).convert("RGBA")
    arr = np.array(img)
    mask = arr[:, :, 3] > 40
    arr[mask, 3] = 255
    Image.fromarray(arr).save(neck_path)


# ── Main flow ────────────────────────────────────────────────────

def process_character(name: str, force: bool = False) -> bool:
    print(f"\n{'='*60}")
    print(f"  {name}")
    print(f"{'='*60}")

    input_path = INPUT_DIR / f"{name}.png"
    if not input_path.exists():
        print(f"  ✗ Input not found: {input_path}")
        return False

    original = Image.open(input_path)
    out_dir = OUTPUT_BASE / name
    tmp_dir = OUTPUT_BASE / f"{name}_tmp"

    # If existing layers pass quality check, skip
    if not force and out_dir.exists() and (out_dir / "metadata.json").exists():
        report = check_quality(out_dir, original)
        print(f"  Existing layers: {report}")
        if report.passed:
            print("  ⏭ Already good, skipping")
            return True
        print("  → Existing layers failed, re-generating...")

    padded = prepare_image(input_path)

    for attempt in range(1, MAX_ATTEMPTS + 1):
        seed = random.randint(1, 999999)
        print(f"\n  Attempt {attempt}/{MAX_ATTEMPTS} (seed={seed})")

        # Clean tmp
        if tmp_dir.exists():
            shutil.rmtree(tmp_dir)

        # Submit
        task_id = submit_task(padded, seed)
        print(f"    task_id={task_id}")

        # Poll
        data = poll_task(task_id)
        if data is None:
            print("    → Task failed, retrying...")
            continue

        result = data.get("result")
        if result is None:
            print("    → No result in response, retrying...")
            continue

        # Download to tmp
        download_layers(task_id, result, tmp_dir)
        fix_neck_alpha(tmp_dir)

        # Quality check
        report = check_quality(tmp_dir, original)
        print(f"    {report}")

        if report.passed:
            # Replace existing
            if out_dir.exists():
                shutil.rmtree(out_dir)
            tmp_dir.rename(out_dir)
            print(f"\n  ✓ {name} done! (attempt {attempt}, seed {seed})")
            return True
        else:
            print(f"    → Quality check failed, {'retrying...' if attempt < MAX_ATTEMPTS else 'giving up'}")

    # All attempts failed — keep the last one but warn
    print(f"\n  ⚠ {name}: all {MAX_ATTEMPTS} attempts failed quality check")
    if tmp_dir.exists():
        if out_dir.exists():
            shutil.rmtree(out_dir)
        tmp_dir.rename(out_dir)
        print(f"    Using last attempt anyway (manual review needed)")
    return False


def main():
    args = sys.argv[1:]

    if not args or "--all" in args:
        targets = CHARACTERS
        force = "--force" in args
    else:
        targets = [a for a in args if not a.startswith("--")]
        force = "--force" in args

    results = {}
    for name in targets:
        if name not in CHARACTERS:
            print(f"Unknown character: {name}")
            continue
        results[name] = process_character(name, force=force)

    print(f"\n{'='*60}")
    print("  Results:")
    for name, ok in results.items():
        print(f"    {'✓' if ok else '✗'} {name}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
