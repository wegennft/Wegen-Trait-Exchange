# Wegen NFT Trait Store

A full-stack Web3 NFT trait marketplace on Ethereum. Users connect their Ethereum wallets and purchase traits for their Wegen NFTs. Traits go into a Trait Locker and can be applied to or removed from NFTs. Includes an admin panel for managing traits, pricing, and store settings.

## Features

- **Store** (`/`) — Browse all traits with category filtering. Each trait shows its image, name, category, ETH price, supply, and rarity badge (common/uncommon/rare/legendary). Connect a wallet to purchase.
- **Locker** (`/locker`) — View all owned traits and whether each is currently equipped to an NFT.
- **My Wegens** (`/nfts`) — View Wegen NFTs, apply locker traits to them, and remove equipped traits (returns them to the locker).
- **Admin** (`/admin`) — Create, edit, and delete traits; set prices and quantities; view sales stats; configure game/bounty settings (including celebration GIF/MP4 uploads for bounty completions).

## Tech Stack

- **Monorepo**: pnpm workspaces
- **Runtime**: Node.js 24
- **Language**: TypeScript 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (generates typed client hooks + Zod schemas from an OpenAPI spec)
- **Build**: esbuild (CJS bundle) for the API server
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Wallet**: ethers.js (`window.ethereum`)

## Project Structure

This is a pnpm monorepo. Deployable services live in `artifacts/`, shared code lives in `lib/`.

```
artifacts/
  wegen-trait-store/   React + Vite frontend, served at /
  api-server/          Express API server, served at /api
lib/
  db/                  Drizzle schema + database access
  api-spec/            OpenAPI spec + Orval codegen output
  ...                  other shared packages
scripts/                Utility scripts
```

## Database Schema

- `traits` — NFT traits with price, supply, rarity, and category.
- `locker_items` — User-owned traits (wallet → trait mapping), with `equipped_to_token_id` when applied to an NFT.
- `wegen_nfts` — User's Wegen NFT records.
- `store_settings` — Global store/game configuration (e.g. bounty celebration media).

## Wallet Integration

The frontend uses ethers.js with `window.ethereum` to connect wallets. A connected wallet address gates access to the Locker and My Wegens pages. Purchases simulate a blockchain flow with a confirmation dialog before calling the API.

> Note: NFT ownership is currently tracked in the backend database (seeded with a demo wallet), not read on-chain. Real ownership verification would require on-chain reads, which are not yet implemented.

## Getting Started

Install dependencies:

```bash
pnpm install
```

Push the database schema (dev only):

```bash
pnpm --filter @workspace/db run push
```

Regenerate API client hooks and Zod schemas from the OpenAPI spec (after changing the API contract):

```bash
pnpm --filter @workspace/api-spec run codegen
```

Run the API server locally:

```bash
pnpm --filter @workspace/api-server run dev
```

Run the frontend locally:

```bash
pnpm --filter @workspace/wegen-trait-store run dev
```

Typecheck and build the whole monorepo:

```bash
pnpm run typecheck
pnpm run build
```

## Admin Notes

- The admin panel at `/admin` has no authentication by default — add auth before deploying publicly.
- The demo NFT wallet address is seeded as `0xDEMOwallet`.

## License

MIT
