---
name: On-chain NFT lookup (Wegens)
description: How the My Wegens page fetches real NFT ownership from Ethereum
---

# On-chain NFT ownership via Alchemy

**Contract:** `0x31a53ce49c99b0c05085dd76d17669871dacd6c0` (Wegens ERC-721 on Ethereum mainnet)

**Endpoint:** Alchemy demo key — `https://eth-mainnet.g.alchemy.com/nft/v3/demo/getNFTsForOwner`
- No user API key required; Alchemy's public demo endpoint works for read-only NFT ownership queries
- Supports pagination via `pageKey`; `fetchOnChainWegens()` in `nfts.ts` pages automatically (100/page)
- Returns `tokenId`, `name`, and `image.cachedUrl` (Alchemy CDN) for each owned NFT

**Merge strategy (nfts.ts `GET /nfts/:walletAddress`):**
- On-chain = source of truth for ownership + images
- Local DB (`wegen_nfts`) = source of truth for equipped traits, SOC metadata, variantPack
- Merge: build on-chain list, overlay local DB fields for matching tokenIds
- DB-only records (seeded/edge cases) appended at the end

**Why:** Real wallets don't have rows in wegen_nfts unless they've interacted with the trait system. Alchemy gives instant real ownership without any indexing infrastructure.

**How to apply:** If the Alchemy demo key ever rate-limits or stops working, add `ALCHEMY_API_KEY` secret and swap the base URL from `/demo` to `/${process.env.ALCHEMY_API_KEY}`.
