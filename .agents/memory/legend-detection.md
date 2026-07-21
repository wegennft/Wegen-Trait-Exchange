---
name: Legend detection
description: How isLegend is computed for NFTs and why collection-awareness matters
---

## Rule
`isLegend` is set via two paths:
1. **DB path**: token ID exists in the `legends` table AND `nftCollection` matches the NFT's collection (`wegens` or `wegenettes`)
2. **On-chain path**: NFT has any of these `trait_type` attributes: `"golden ticket"`, `"legend"`, or `"team"` (case-insensitive)

The DB query MUST filter by `nftCollection` — both collections share the same token ID space, so Wegenette #508 and Wegen #508 are different NFTs.

## Why
Without the collection filter, a Wegenette in the legends table would incorrectly flag a Wegen with the same token ID as a legend (false positive). The on-chain "Legend" and "Team" trait_types are the real identifiers for 1/1s and were initially omitted (only "Golden Ticket" was checked).

## How to apply
- In `/api/nfts/:wallet`: split token IDs by `isWegenette`, run two parallel DB queries (one per collection), build two separate Sets, check the correct Set per NFT.
- In `/api/legends/mine`: use `fetchOnChainWegens(walletAddress)` for ownership (not `wegen_nfts` DB table — real wallets' NFTs live on-chain only). Fall back to DB-only records for seeded demo wallets.
- In `apply-trait`: look up the NFT's collection before querying legends table.
