# Wegen NFT Trait Store

## Overview

A full-stack Web3 NFT trait marketplace on Ethereum. Users connect their Ethereum wallets and purchase traits for their Wegen NFTs. Traits go into a Trait Locker and can be applied/removed from NFTs. Includes an admin panel.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Wallet**: ethers.js (window.ethereum)

## Artifacts

- `artifacts/wegen-trait-store` — React + Vite frontend at `/`
- `artifacts/api-server` — Express API server at `/api`

## Features

- **Store** (`/`): Browse all traits with category filtering. Each trait shows image, name, category, ETH price, supply, and rarity badge (common/uncommon/rare/legendary). Connect wallet to purchase.
- **Locker** (`/locker`): View all owned traits. Shows whether each is equipped to an NFT.
- **My Wegens** (`/nfts`): View Wegen NFTs, apply locker traits to them, remove equipped traits (returns to locker).
- **Admin** (`/admin`): Create/edit/delete traits, set prices and quantities, view sales stats.

## Wallet Integration

Uses ethers.js with `window.ethereum` for wallet connections. Wallet address gates locker and NFT pages. Purchases simulate a blockchain flow with a confirmation dialog before calling the API.

## Database Schema

- `traits` — NFT traits with price, supply, rarity, category
- `locker_items` — User-owned traits (wallet → trait mapping), with `equipped_to_token_id` when applied
- `wegen_nfts` — User's Wegen NFT records

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Admin Notes

- Admin panel at `/admin` has no auth by default — add auth if deploying publicly
- NFT wallet address seeded as `0xDEMOwallet` for demo purposes
- Real NFT ownership would come from on-chain reads (not implemented — backend stores NFT records)
