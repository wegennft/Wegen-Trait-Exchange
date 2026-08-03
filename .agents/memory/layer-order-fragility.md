---
name: Layer order fragility
description: Three separate places hardcode or store trait layer order; they can drift out of sync and cause wrong compositing.
---

# Layer order — three sources of truth that must agree

## The rule
Whenever layer order is adjusted anywhere, verify all three locations match:

1. **DB `store_settings.layer_order`** (per collection) — source used by `variant-preview-image` and `compose-preview` server endpoints. Front = index 0. Correct Wegens value: `["Headgear","Eyes","Mouth","Clothes","Body","Background"]`.
2. **`CATEGORY_LAYER_ORDER` in `Locker.tsx`** — hardcoded z-index map for CSS stacking in the Trait Locker. Must have `"headgear"` as an explicit key (DB category is that exact string). Correct values: background=0, body=1~2, clothes=3, mouth=4, eyes=5, headgear=6.
3. **`LAYER_ORDER` in `Store.tsx` NFT preview panel** — hardcoded per-collection array for CSS stacking of locker-equipped overlays. Back-to-front, so last entry = topmost. Correct Wegens value: `["Background","Body","Clothes","Mouth","Eyes","Headgear"]`.

## Why
The DB layer order was set to `["Mouth","Headgear",...]` by an admin, placing Mouth in front of Headgear. This caused the purple dragon hat (Headgear) to render behind Mouth in all server-composited images. The Locker had `"headgear"` missing as a key so it fell through to z=3 (same as Clothes), also wrong.

## How to apply
- Bug report: "hat/headgear trait renders behind other traits" → check all three locations above.
- Admin saves new layer order → remind them the Locker and Store CSS arrays are still hardcoded (Task #55 tracks making Locker dynamic).
- Never add a new category to the server defaultOrder without also updating both CSS locations.
