---
name: EVM-only wallet connect
description: Wallet connection in the Wegen NFT Trait Store is EVM-only; a prior additive Solana connect path was removed by user request.
---

The app's wallet connection flow (MetaMask, Phantom, Backpack, OKX, WalletConnect, etc.) is EVM-only. All detected wallets connect via their EIP-1193 / `.ethereum` provider (or WalletConnect) and authenticate with a SIWE-style nonce + signature verified server-side.

WalletConnect (Reown AppKit) is available for mobile browsers that have no injected extension. Set `VITE_WALLETCONNECT_PROJECT_ID` for production; a demo project ID is used in development when unset.

An earlier version of the app also had an additive Solana connect option (native Solana SIWE / display-only). It was removed because it confused users — connecting a wallet that supports both chains showed a second identity with no clear purpose for trait purchases.

**Why:** the user explicitly asked for the app to "use EVM addresses when it connects to user wallets," i.e. wallet connection should be single-chain (EVM) end to end.

**How to apply:** if asked to add multi-chain wallet support back (Solana, or any non-EVM chain) as a secondary/cosmetic identity, confirm with the user first — this was a deliberate removal, not an oversight. Backend Solana auth routes may still exist for legacy sessions but the frontend does not offer Solana connect and clears legacy Solana sessions on load.
