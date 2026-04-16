# Jelly Plaza — Layered Character Animation System

## Overview

2D social plaza with AI-segmented layered character animations. Characters are decomposed into ~21 semantic layers (face, hair, arms, etc.) by See-through API, then animated per-zone with CSS + JS.

**Repo**: `/Users/yin/code/games/jelly-plaza/`
**Live**: `https://yinxinghuan.github.io/jelly-plaza/`
**Stack**: React + TypeScript + Less + Vite
**Next goal**: Integrate into chataigram-web (`/Users/yin/code/chataigram-web/`)

---

## Layer Pipeline (standard flow for new characters)

```
1. gen_characters.py        — img2img API → raw full-body PNG (green screen → remove bg)
2. run_seethrough_checked.py — See-through API → 21 layers + quality check (up to 10 retries)
3. detect_pivots.py         — body-arm overlap → shoulder pivot {x%, y%} in metadata.json
4. clean_layer_bleed.py     — feathered zone masks → remove topwear/legwear cross-zone bleed
5. compress_layers.py       — crop to content bbox + PNG→WebP (quality 90)
```

**Result**: ~180KB per character (was 8MB before compression).

---

## Quality Check ("gacha" mechanism)

`run_seethrough_checked.py` validates each API result against 8 gates:

1. Required layers exist (face, neck, front hair, topwear)
2. Eye completeness (6 eye layers with visible content)
3. **Topwear integrity** — must not be cropped past x=35% of frame (Jenny fails ~71% of the time)
4. Corner artifact detection (tiny layers at canvas edges)
5. Neck alpha coverage in transition zone
6. Overall coverage ≥85% of original
7. Face layer ≥5000px
8. **Eye color fidelity** — iris RGB distance from original ≤80

**Auto-fixes applied before check**: `fix_neck_alpha()` (boost α→255), `fix_eye_colors()` (restore RGB from raw image using layer alpha mask).

---

## Layer Structure (metadata.json)

```json
{
  "frame_size": [1280, 1280],
  "layers": [
    {
      "tag": "handwear-r",
      "depth_median": 0.298,           // render order (high=back, low=front)
      "xyxy": [393, 170, 590, 470],   // crop box (updated by compress_layers)
      "pivot": { "x": 94.4, "y": 48.3 },  // shoulder pivot (set by detect_pivots)
      "held_by": "handwear-r"          // for objects layer (set by detect_pivots)
    }
  ]
}
```

**Render order**: metadata order (depth_median descending = back→front).
**Exception**: `fixRenderOrder()` in characters.ts moves neck AFTER topwear (skin shows above collar).

---

## Body Zone System

Each layer maps to a zone via `ZONE_MAP` in `characters.ts`:

| Zone | Layers | Breathing | Purpose |
|------|--------|-----------|---------|
| `jp-zone--torso` | topwear, neck, neckwear, objects | 22px Y + 1.5px X sway | Breathing source |
| `jp-zone--head` | face, nose, mouth, ears, eyes, eyewear, headwear | 18px Y | Follows chest |
| `jp-zone--hair` | front hair, back hair | 20px Y + ±4px X sway | Secondary motion, delayed |
| `jp-zone--arms` | handwear-r, handwear-l | 22px Y (matches torso) | Shoulder stays aligned |
| `jp-zone--lower` | bottomwear, legwear, footwear | none | Feet planted |

**Breathing period**: 3s, all zones same period, phase offsets per character to prevent lockstep.

---

## Arm Animation Architecture

Arms use **nested structure** to separate body-following from rotation:

```html
<div class="jp-arm-wrap jp-zone--arms">   <!-- translateY follows torso -->
  <div class="jp-arm__img">              <!-- rotate from shoulder pivot -->
    <img src="handwear-r.webp" />
  </div>
</div>
```

**Shoulder pivot**: auto-detected by `detect_pivots.py` from arm-body overlap.
- Right arm: typically ~75-95% X, 0-48% Y (top-right of crop)
- Left arm: typically ~1-55% X, 0-2% Y (top-left of crop)

**Held objects** (coffee cup, guitar): `held_by` field in metadata links objects to their hand. During poke, objects get the same rotation with transform-origin recalculated in the object's own coordinate space:

```
shoulderCanvas = (arm.left + arm.width * pivot.x%, arm.top + arm.height * pivot.y%)
objectPivot = ((shoulderCanvas.x - obj.left) / obj.width, (shoulderCanvas.y - obj.top) / obj.height)
```

---

## Poke Reaction (click animation)

**100% DOM-driven** — zero React setState in the poke chain (setState causes re-render which wipes inline styles).

| Phase | Time | Action |
|-------|------|--------|
| 1. Dip | 0-80ms | All zones translateY(+4px), eyes hide |
| 2. Bounce | 80-350ms | Zones translateY(-15px), eyes scale(1.5), right arm rotate(22°), left arm rotate(-12°) |
| 3. Wave | 350-1580ms | Right arm: -25°→+20°→-14°→+8° (decelerating), left arm: -20°→-12° (gentle sway) |
| 4. Settle | 1900ms | All back to 0, eyes scale(1) |
| Cleanup | 2500ms | Clear inline styles, remove `.jp-char--poking`, resume blink timer |

**Key**: `.jp-char--poking` sets `animation: none !important` on all zone classes to let JS transforms take control.

**Blink pause**: idle blink timer is `clearTimeout`'d at poke start, restarted at cleanup.

---

## Known Issues & Constraints

- **Arm rotate detaches at large amplitudes** — rotation from shoulder pivot only works cleanly at small angles (≤25°). For larger movements, consider splitting arm into upper/lower segments.
- **Full-frame objects z-order** — objects like guitar (full-frame layer) cannot be placed inside arm wrapper without breaking z-order. Animated via JS sync instead.
- **See-through API variance** — some character designs (oversized hoodies, same-color accessories) have low success rates (~29% for Jenny). Quality check + retry handles this.
- **Layer bleed** — AI segmentation produces cross-zone pixels. `clean_layer_bleed.py` handles this but must run before compression.

---

## File Reference

| File | Purpose |
|------|---------|
| `src/JellyPlaza/characters.ts` | ZONE_MAP, buildLayers(), fixRenderOrder(), character configs |
| `src/JellyPlaza/components/AnimatedCharacter.tsx` | Blink (refs), poke timeline (DOM-only), arm wrapper rendering |
| `src/JellyPlaza/components/AnimatedCharacter.less` | Zone breathing keyframes, arm swing, poke class override |
| `src/JellyPlaza/types.ts` | LayerConfig (pivot, heldBy), CharacterConfig |
| `scripts/run_seethrough_checked.py` | Layer decomposition + 8-point quality gate |
| `scripts/detect_pivots.py` | Shoulder pivot from body-arm overlap |
| `scripts/clean_layer_bleed.py` | Zone mask + feathered edges |
| `scripts/compress_layers.py` | Crop bbox + PNG→WebP |

---

## CSS Conventions

- Prefix: `jp-` (Jelly Plaza)
- BEM: `.jp-char__stage`, `.jp-zone--torso`, `.jp-layer`
- All `@keyframes` prefixed: `jp-breathe-torso`, `jp-arm-swing`
- Input: `onPointerDown` only
- Images: `draggable={false}`, `pointer-events: none`
