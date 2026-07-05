---
name: EVM-only wallet connect
description: Wallet connection in the Wegen NFT Trait Store is EVM-only; a prior additive Solana connect path was removed by user request.
---

The app's wallet connection flow (MetaMask, Phantom, Backpack, OKX, etc.) is EVM-only. All detected wallets connect via their `.ethereum` injected provider and authenticate with a SIWE-style nonce + signature verified server-side.

An earlier version of the app also had an additive, display-only "Native Solana" connect option (separate button, separate `solanaAddress` state) that let users connect a base58 Solana address alongside their EVM session. It was explicitly documented as not used for backend auth or purchases.

This was removed because it confused users — connecting a wallet that supports both chains (e.g. Phantom, Backpack) showed a second, functionally inert Solana address next to the real EVM session, with no clear purpose.

**Why:** the user explicitly asked for the app to "use EVM addresses when it connects to user wallets," i.e. wallet connection should be single-chain (EVM) end to end, not multi-chain with a decorative secondary identity.

**How to apply:** if asked to add multi-chain wallet support back (Solana, or any non-EVM chain) as a secondary/cosmetic identity, confirm with the user first — this was a deliberate removal, not an oversight. If genuine cross-chain functionality (e.g. actual Solana-side purchases) is requested, that's a different, larger feature and should be scoped as such rather than reviving the old additive-but-non-functional pattern.
