---
name: Layer order fragility
description: Three separate places hardcode or store trait layer order; they can drift out of sync and cause wrong compositing.
---

# Layer order — three sources of truth that must agree

## The rule
Whenever layer order is adjusted anywhere, verify all three locations match:

1. **DB `store_settings.layer_order`** (per collection) — source used by `variant-preview-image` and `compose-preview` server endpoints. Front = index 0. Correct Wegens value: `["Headgear","Eyes","Mouth","Clothes","Body","Background"]`.
2. **Locker.tsx** — the non-demo preview is now a single server-composited image from `/api/traits/compose-preview` (on-chain attrs + equipped/hover name overrides, baseImageUrl, optional variantPack), so equipped traits slot INTO the layer stack instead of painting over the flat base image. CSS z-stacking (getZ from /store/config layerOrder, hardcoded map fallback) remains for demo mode and the equipped-traits list ordering. Frontend must mirror server CATEGORY_ALIASES (Skin→Body, Head & Hair/HeadGear→Headgear) when matching override categories.
3. **`LAYER_ORDER` in `Store.tsx` NFT preview panel** — hardcoded per-collection array for CSS stacking of locker-equipped overlays. Back-to-front, so last entry = topmost. Correct Wegens value: `["Background","Body","Clothes","Mouth","Eyes","Headgear"]`.

## Why
The DB layer order was set to `["Mouth","Headgear",...]` by an admin, placing Mouth in front of Headgear. This caused the purple dragon hat (Headgear) to render behind Mouth in all server-composited images. The Locker had `"headgear"` missing as a key so it fell through to z=3 (same as Clothes), also wrong.

## How to apply
- Bug report: "hat/headgear trait renders behind other traits" → check all three locations above.
- Admin saves new layer order → Locker follows automatically via /store/config; Store.tsx preview array is still hardcoded and must be updated by hand.
- Collections differ: wegenettes put Eyes frontmost, wegens put Headgear frontmost — never assume one shared order.
- The Locker has in-panel Wegens/Wegenettes tabs independent of the global collection context: layer order must key off the SELECTED NFT's collection (isWegenette), not the header dropdown.
- Never add a new category to the server defaultOrder without also updating both CSS locations.
