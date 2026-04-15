#!/usr/bin/env python3
"""
Generate 3 full-body character illustrations for Jelly Plaza.
Uses img2img API with existing character sprites as references.
Green screen background → remove green → transparent PNG.

Characters:
  1. Isaya — blue-haired girl, black hoodie, headphones
  2. Algram — guitar boy, beige jacket + green hoodie
  3. Jenny — coffee girl, purple hoodie, round glasses

Usage:
  ~/miniconda3/bin/python3 scripts/gen_characters.py
"""
import datetime
import hashlib
import hmac
import json
import os
import ssl
import subprocess
import sys
import time
import urllib.request
import urllib.error
import urllib.parse

from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
OUTPUT_DIR = PROJECT_DIR / "raw_characters"
FINAL_DIR = PROJECT_DIR / "public" / "characters"

# Reference images (existing character sprites)
REFS = {
    "isaya": Path("/Users/yin/code/games/bsod/src/BSOD/img/isaya_idle.png"),
    "algram": Path("/Users/yin/code/games/convenience-store-v2/src/ConvenienceStore/img/guitarist_normal.png"),
    "jenny": Path("/Users/yin/code/games/convenience-store-v2/src/ConvenienceStore/img/coder_normal.png"),
}

# ── Prompts ──────────────────────────────────────────────────────────────────
# Full-body standing poses, casual plaza vibe, green screen for easy removal
COMMON_SUFFIX = (
    "full body standing pose, anime illustration style, "
    "casual relaxed posture, facing slightly to the side, "
    "feet visible, shoes on ground, "
    "solid flat bright green background #00FF00, green screen background, "
    "high quality, clean lines, soft shadows"
)

PROMPTS = {
    "isaya": (
        "anime girl, long straight light blue hair past shoulders, pale skin, blue-gray eyes, "
        "black oversized hoodie with front pocket, dark navy shorts, black shoes, "
        "large black over-ear headphones on top of head covering ears, "
        "NO BANGS, NO FRINGE, hair parted in the middle, "
        "quiet gentle expression, one hand slightly in hoodie pocket, "
        f"{COMMON_SUFFIX}"
    ),
    "algram": (
        "anime teenage boy, messy spiky brown hair, warm brown eyes, Asian features, "
        "beige jacket open over teal green hoodie, white t-shirt underneath, "
        "acoustic guitar on back with brown leather strap visible on shoulder, "
        "dark blue jeans, brown casual sneakers, "
        "confident friendly smile, one hand raised in casual wave, "
        f"{COMMON_SUFFIX}"
    ),
    "jenny": (
        "anime girl, shoulder-length brown hair with side part, bright green eyes, "
        "large black round glasses, fair skin, "
        "oversized purple hoodie, dark leggings, white canvas sneakers, "
        "holding a coffee cup in one hand, relaxed smile, "
        f"{COMMON_SUFFIX}"
    ),
}

# ── API Config ───────────────────────────────────────────────────────────────
API_URL = "http://aiservice.wdabuliu.com:8019/genl_image"
API_TIMEOUT = 360
RATE_LIMIT_S = 78
USER_ID = 123456  # Must be int

# Cloudflare R2
R2_ACCOUNT_ID = "bdccd2c68ff0d2e622994d24dbb1bae3"
R2_ACCESS_KEY = "b203adb7561b4f8800cbc1fa02424467"
R2_SECRET_KEY = "e7926e4175b7a0914496b9c999afd914cd1e4af7db8f83e0cf2bfad9773fa2b0"
R2_BUCKET = "aigram"

_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE


# ── Helpers ──────────────────────────────────────────────────────────────────

def _sign(key, msg):
    return hmac.new(key, msg.encode(), hashlib.sha256).digest()


def upload_local_image(path: str) -> str:
    """Upload a local image to Cloudflare R2 → public CDN URL."""
    print(f"  ↑ Uploading {os.path.basename(path)} to R2…")
    with open(path, "rb") as f:
        data = f.read()

    obj_key = "refs/jelly-plaza/" + os.path.basename(path)
    host = f"{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
    now = datetime.datetime.utcnow()
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")
    region = "auto"
    service = "s3"

    content_type = "image/png"
    content_hash = hashlib.sha256(data).hexdigest()
    canon_uri = "/" + R2_BUCKET + "/" + urllib.parse.quote(obj_key, safe="/")

    canon_headers = (
        f"content-type:{content_type}\n"
        f"host:{host}\n"
        f"x-amz-content-sha256:{content_hash}\n"
        f"x-amz-date:{amz_date}\n"
    )
    signed_headers = "content-type;host;x-amz-content-sha256;x-amz-date"

    canon_req = "\n".join([
        "PUT", canon_uri, "",
        canon_headers, signed_headers, content_hash,
    ])

    cred_scope = f"{date_stamp}/{region}/{service}/aws4_request"
    str_to_sign = "\n".join([
        "AWS4-HMAC-SHA256", amz_date, cred_scope,
        hashlib.sha256(canon_req.encode()).hexdigest(),
    ])

    k_date = _sign(("AWS4" + R2_SECRET_KEY).encode(), date_stamp)
    k_region = _sign(k_date, region)
    k_service = _sign(k_region, service)
    k_signing = _sign(k_service, "aws4_request")
    signature = hmac.new(k_signing, str_to_sign.encode(), hashlib.sha256).hexdigest()

    auth = (
        f"AWS4-HMAC-SHA256 Credential={R2_ACCESS_KEY}/{cred_scope}, "
        f"SignedHeaders={signed_headers}, Signature={signature}"
    )

    url = f"https://{host}/{R2_BUCKET}/{urllib.parse.quote(obj_key, safe='/')}"
    req = urllib.request.Request(url, data=data, method="PUT", headers={
        "Content-Type": content_type,
        "Host": host,
        "x-amz-content-sha256": content_hash,
        "x-amz-date": amz_date,
        "Authorization": auth,
    })

    with urllib.request.urlopen(req, timeout=60, context=_SSL_CTX) as resp:
        resp.read()

    public_url = f"https://images.aiwaves.tech/{obj_key}"
    print(f"  ✓ Uploaded → {public_url}")
    return public_url


def call_api(ref_url: str, prompt: str) -> str | None:
    payload = json.dumps({
        "query": "",
        "params": {
            "url": ref_url,
            "prompt": prompt,
            "user_id": USER_ID,
        },
    }).encode()
    req = urllib.request.Request(
        API_URL, data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=API_TIMEOUT) as resp:
            result = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            result = json.loads(body)
        except Exception:
            print(f"  ✗ HTTP {e.code}: {body[:200]}")
            return None
    code = result.get("code")
    if code == 200:
        return result["url"]
    if code == 429:
        raise RuntimeError("rate_limit")
    print(f"  ✗ API code={code}")
    return None


def download_image(url: str, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    src_ext = os.path.splitext(url.split("?")[0])[1].lower()
    dst_ext = out_path.suffix.lower()
    tmp_path = str(out_path) + src_ext if src_ext != dst_ext else str(out_path)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30, context=_SSL_CTX) as resp:
        data = resp.read()
    with open(tmp_path, "wb") as f:
        f.write(data)
    if src_ext != dst_ext and dst_ext == ".png":
        subprocess.run(["sips", "-s", "format", "png", tmp_path, "--out", str(out_path)],
                       check=True, capture_output=True)
        os.remove(tmp_path)
    elif tmp_path != str(out_path):
        os.rename(tmp_path, str(out_path))
    size_kb = out_path.stat().st_size // 1024
    print(f"  ✓ Saved → {out_path} ({size_kb} KB)")


def remove_green(input_path: Path, output_path: Path, threshold: int = 30) -> None:
    """Remove green screen pixels by setting their alpha to 0."""
    from PIL import Image
    import numpy as np

    img = Image.open(input_path).convert("RGBA")
    data = np.array(img, dtype=np.float32)
    r, g, b, a = data[:, :, 0], data[:, :, 1], data[:, :, 2], data[:, :, 3]

    # greenness = how much greener than the other channels
    greenness = g - np.maximum(r, b)
    mask = greenness > threshold

    # Fade alpha based on greenness strength (smooth edges)
    fade = np.clip((greenness - threshold) / 40.0, 0, 1)
    data[:, :, 3] = np.where(mask, a * (1.0 - fade), a)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(data.astype(np.uint8)).save(output_path)
    print(f"  ✓ Green removed → {output_path}")


def generate_character(name: str) -> bool:
    """Generate a single character: img2img → download → remove green."""
    print(f"\n{'='*60}")
    print(f"  Generating: {name}")
    print(f"{'='*60}")

    ref_path = REFS[name]
    if not ref_path.exists():
        print(f"  ✗ Reference not found: {ref_path}")
        return False

    prompt = PROMPTS[name]
    raw_path = OUTPUT_DIR / f"{name}_raw.png"
    final_path = FINAL_DIR / f"{name}.png"

    # Skip if already generated
    if final_path.exists():
        print(f"  ⏭ Already exists: {final_path}")
        return True

    # Upload reference
    ref_url = upload_local_image(str(ref_path))

    # Call API (with rate limit retry)
    print(f"  → Calling API…")
    while True:
        try:
            result_url = call_api(ref_url, prompt)
        except RuntimeError as e:
            if str(e) == "rate_limit":
                print(f"  ⏳ Rate limited — waiting {RATE_LIMIT_S}s…")
                time.sleep(RATE_LIMIT_S)
                continue
            raise
        break

    if not result_url:
        print(f"  ✗ Generation failed for {name}")
        return False

    # Download
    download_image(result_url, raw_path)

    # Remove green background
    remove_green(raw_path, final_path)

    return True


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    FINAL_DIR.mkdir(parents=True, exist_ok=True)

    names = ["isaya", "algram", "jenny"]
    results = {}

    for i, name in enumerate(names):
        ok = generate_character(name)
        results[name] = ok

        # Rate limit between generations
        if i < len(names) - 1 and ok:
            print(f"\n  ⏳ Waiting {RATE_LIMIT_S}s for rate limit…")
            time.sleep(RATE_LIMIT_S)

    print(f"\n{'='*60}")
    print(f"  Results:")
    for name, ok in results.items():
        status = "✓" if ok else "✗"
        print(f"    {status} {name}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
