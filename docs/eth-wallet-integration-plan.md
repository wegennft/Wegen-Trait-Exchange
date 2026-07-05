# ETH Wallet Integration Plan (Mobile + Desktop)

Branch: `feature/eth-wallet-connect`

Goal: ETH wallets work on **desktop** (browser extensions) and **mobile** (wallet apps via WalletConnect), without breaking the existing trait store.

---

## Current state (already built)

| Piece | File | Status |
|---|---|---|
| EVM connect + SIWE sign-in | [`WalletContext.tsx`](../artifacts/wegen-trait-store/src/contexts/WalletContext.tsx) | Works on desktop with injected wallets |
| Server session auth | [`auth.ts`](../artifacts/api-server/src/routes/auth.ts) | SIWE nonce → sign → session cookie |
| Wallet picker UI | [`Layout.tsx`](../artifacts/wegen-trait-store/src/components/layout/Layout.tsx) | Lists detected browser extensions |
| Connect gate pages | [`WalletConnectGuard.tsx`](../artifacts/wegen-trait-store/src/components/shared/WalletConnectGuard.tsx) | Locker, NFTs, etc. |
| Wrong network banner | [`NetworkMismatchBanner.tsx`](../artifacts/wegen-trait-store/src/components/wallet/NetworkMismatchBanner.tsx) | Mainnet + Sepolia accepted |
| Tx confirm modal | [`TxConfirmModal.tsx`](../artifacts/wegen-trait-store/src/components/wallet/TxConfirmModal.tsx) | Ready for on-chain txs |
| Solana adapter (separate) | [`solana-adapter.ts`](../artifacts/wegen-trait-store/src/wallet/solana-adapter.ts) | Display only — do not break |

**Gap:** No **WalletConnect** → mobile browsers cannot connect (no `window.ethereum` extension).

**Accepted chains today:** Ethereum mainnet (`1`) + Sepolia (`11155111`).

---

## Architecture (target)

```
┌─────────────────────────────────────────────────────────┐
│  Pages (Store, Locker, Nfts, Swap, …)                   │
│  use useWallet() — NO CHANGES to business logic         │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  WalletContext.tsx (shared state — keep same API)       │
│  walletAddress, connect(), disconnect(), chainId, …     │
└──────────────┬───────────────────────────┬────────────────┘
               │                           │
    ┌──────────▼──────────┐     ┌──────────▼──────────────┐
    │ evm-injected.ts     │     │ evm-walletconnect.ts    │
    │ (move from Context) │     │ (NEW — mobile + QR)     │
    │ MetaMask, Rabby…    │     │ Reown AppKit / WC       │
    └──────────┬──────────┘     └──────────┬──────────────┘
               │                           │
               └───────────┬───────────────┘
                           │
              Both produce Eip1193Provider + address
              Both run same SIWE flow (/api/auth/nonce → verify)
```

**Rule from Cap:** Do not rewrite the app. Add an adapter layer; keep `useWallet()` API identical so pages don't change.

---

## Files to touch (in order)

### Step 1 — New adapter layer (no UI changes yet)

| Action | File |
|---|---|
| **CREATE** | `artifacts/wegen-trait-store/src/wallet/evm-injected.ts` |
| **CREATE** | `artifacts/wegen-trait-store/src/wallet/evm-walletconnect.ts` |
| **CREATE** | `artifacts/wegen-trait-store/src/wallet/types.ts` |
| **CREATE** | `artifacts/wegen-trait-store/src/wallet/siwe.ts` |
| **EDIT** | `artifacts/wegen-trait-store/src/contexts/WalletContext.tsx` |

**What each file does:**

- **`types.ts`** — shared types: `EvmConnectionMethod`, `WalletConnectionResult`, error codes
- **`evm-injected.ts`** — move `detectWallets()` + browser extension logic out of `WalletContext.tsx` (copy, don't delete behavior)
- **`evm-walletconnect.ts`** — Reown AppKit (WalletConnect v2) init, connect/disconnect, returns `Eip1193Provider`
- **`siwe.ts`** — extract SIWE flow (nonce fetch → sign → verify) from `WalletContext.connect()` so both adapters reuse it
- **`WalletContext.tsx`** — thin orchestrator: pick injected vs WalletConnect, expose same `connect()` / `disconnect()` / state

### Step 2 — Dependencies + env

| Action | File |
|---|---|
| **EDIT** | `artifacts/wegen-trait-store/package.json` |
| **EDIT** | `pnpm-lock.yaml` (via `pnpm install`) |
| **EDIT** | `.env.example` |
| **EDIT** | `artifacts/wegen-trait-store/.env.example` |

**New packages (recommended):**

- `@reown/appkit` + `@reown/appkit-adapter-ethers` (WalletConnect, mobile + desktop)

**New env var (Cap must add in Replit Secrets):**

- `VITE_WALLETCONNECT_PROJECT_ID` — free at [cloud.reown.com](https://cloud.reown.com)

### Step 3 — UI updates

| Action | File | Why |
|---|---|---|
| **EDIT** | `Layout.tsx` | Add "WalletConnect" / "Mobile wallet" option in picker dialog; show QR on mobile |
| **EDIT** | `WalletConnectGuard.tsx` | Better copy when no extension detected ("Use WalletConnect on mobile") |
| **MAYBE EDIT** | `NetworkMismatchBanner.tsx` | Add "Switch network" helper if WalletConnect supports it |
| **NO CHANGE** | `Store.tsx`, `Locker.tsx`, `Nfts.tsx`, `Swap.tsx`, … | They only call `useWallet()` |

### Step 4 — Server (likely no changes)

| File | Notes |
|---|---|
| `auth.ts` | Already SIWE-compatible — works with any EVM signer |
| Other API routes | Use session `walletAddress` — unchanged |

### Step 5 — Docs + Cap setup

| Action | File |
|---|---|
| **EDIT** | `replit.md` or this doc | Document `VITE_WALLETCONNECT_PROJECT_ID` for Cap |
| **EDIT** | `docs/reviewing-prs-in-replit.md` | Optional: note wallet env var for testing |

---

## Implementation order (checkpoints)

### Checkpoint 1 — Refactor only (zero behavior change)
1. Extract `detectWallets` → `evm-injected.ts`
2. Extract SIWE → `siwe.ts`
3. `WalletContext` calls extracted modules
4. **Test:** desktop MetaMask connect still works

### Checkpoint 2 — Add WalletConnect
1. Install Reown AppKit
2. Implement `evm-walletconnect.ts`
3. Wire into `WalletContext.connect({ method: 'walletconnect' })`
4. **Test:** desktop QR flow + mobile Safari/Chrome

### Checkpoint 3 — UI polish
1. Update wallet picker in `Layout.tsx`
2. Mobile-specific messaging in `WalletConnectGuard.tsx`
3. **Test:** iPhone + Android + desktop Chrome/Firefox

### Checkpoint 4 — Edge cases
1. Account changed → re-verify or disconnect
2. Chain changed → update `chainId`, show banner
3. User rejects sign → friendly error (already partial)
4. Session expired → prompt reconnect
5. **Test:** full purchase flow on Store (connect → cart → buy)

---

## Pages that depend on wallet (regression test list)

After each checkpoint, verify these still load and connect:

| Page | Path | Wallet usage |
|---|---|---|
| Store | `/` | Connect to buy traits |
| Trait Locker | `/locker` | Requires connect |
| My Wegens | `/nfts` | Requires connect |
| Packs & Points | `/bundles-points` | Connect to purchase |
| Trait Swap | `/swap` | Connect to trade |
| My Legends | `/my-legends` | Connect to view |
| Bounties | `/bounties` | Optional (leaderboard highlights your wallet) |
| Admin | `/admin` | No wallet required |

---

## Questions for Cap (before coding Checkpoint 2)

1. **Production chain:** Mainnet only, or Sepolia for staging too?
2. **WalletConnect project ID:** Can Cap create one at cloud.reown.com and add to Replit Secrets?
3. **What's broken today?** Desktop extension? Mobile only? Both?
4. **Solana:** Ignore for this branch — trait purchases are EVM-only per existing code.

---

## Git workflow

```bash
# You're already here:
git checkout feature/eth-wallet-connect

# After each checkpoint:
git add ...
git commit -m "Checkpoint N: ..."

# When ready:
git push -u origin feature/eth-wallet-connect
gh pr create --title "ETH wallet: mobile + desktop" --base main
```

Cap tests in Replit using [`docs/reviewing-prs-in-replit.md`](./reviewing-prs-in-replit.md).

---

## Do NOT touch (unless Cap asks)

- Database schema / Drizzle models
- Trait store purchase API logic
- Solana adapter (separate concern)
- Admin panel
- Migration platform (different repo entirely)
