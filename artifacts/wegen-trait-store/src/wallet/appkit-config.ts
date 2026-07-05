/**
 * Reown AppKit (WalletConnect) — mobile + desktop wallet picker.
 * Supports MetaMask, Backpack, Coinbase, Rainbow, and 300+ wallets.
 */
import { createAppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { mainnet, sepolia } from "@reown/appkit/networks";

const configuredProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
/** Reown demo project ID — localhost only; replace with your own for production. */
const DEMO_PROJECT_ID = "b56e18d47c2ab683b10814fe9495";
const projectId = configuredProjectId || DEMO_PROJECT_ID;

export const isWalletConnectConfigured = Boolean(configuredProjectId || import.meta.env.DEV);

createAppKit({
    adapters: [new EthersAdapter()],
    networks: [mainnet, sepolia],
    projectId,
    metadata: {
      name: "Wegen Trait Store",
      description: "NFT trait marketplace for Wegens",
      url: typeof window !== "undefined" ? window.location.origin : "https://wegennft.com",
      icons: ["https://avatars.githubusercontent.com/u/wegennft"],
    },
    featuredWalletIds: [
      "c57ca95b47569711a94855e651bbf6e589c081be", // MetaMask
      "fd20dc426fb37566d803205b19bbc1d4096b248ac", // Backpack
      "4622a2b2d6af1c9844944390e9e7fd117727783a", // Coinbase Wallet
      "1ae92b26df02f0ac9c3d71ffaa698c22ad4471fb", // Rainbow
      "19177a98252e07ddfc9af2083ba8ecb07a2970d8", // Rabby
      "68f358ad827461aa7b1155a5a4b7a5d0ecf3dbad", // Trust Wallet
      "971e689d0a5be527bac79629b4ee9c925c08947f", // OKX Wallet
    ],
    features: {
      analytics: false,
    },
  });
