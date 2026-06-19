---
name: On-Chain Metadata Flow
description: How trait loadouts are saved on-chain and served as ERC-721 metadata
---

## Architecture

`POST /api/nfts/:tokenId/confirm-traits` body: `{ walletAddress, variantPack? }`
- Generates a simulated 0x tx hash
- Saves `metadataTxHash`, `metadataUpdatedAt`, `variantPack` to `wegen_nfts`
- `variantPack` read from `req.body` directly (not in Zod ConfirmTraitsBody schema)

`GET /api/metadata/:collection/:tokenId` → ERC-721 JSON (name, description, image URL, attributes)
`GET /api/metadata/:collection/:tokenId/image` → sharp-composited PNG of equipped traits in layer order

**Why:** Users wanted to save their variant skin version on-chain so that's what marketplaces display.

## DB

`wegen_nfts` has columns: `metadata_tx_hash`, `metadata_updated_at`, `variant_pack` (all nullable).

## Image compositing

- Layer order from `store_settings.layer_order` per collection (bottom → top)
- If `variantPack` saved, looks up `trait_variants` table for variant images
- Falls back to purple 1000×1000 placeholder if no equipped traits or fetch fails
- sharp is installed in `@workspace/api-server`

## Frontend (Nfts.tsx)

- "Save to Chain" button appears only when NFT has ≥1 equipped trait
- "On-Chain" green badge shows when `metadataTxHash` is set
- Confirmation dialog: composited image preview + trait list + variant selector + simulated tx flow
- Variant packs fetched from `/api/traits/variant-collections?nftCollection=...`
