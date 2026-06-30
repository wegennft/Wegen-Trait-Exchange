/**
 * NetworkMismatchBanner
 *
 * Shows a dismissible banner when the connected EVM wallet is on a chain
 * other than the expected one. The trait store is deployed on Ethereum
 * mainnet (chainId "1"). When running in dev, Sepolia ("11155111") is
 * also considered valid so testers don't see a constant warning.
 *
 * The banner is a pure read from WalletContext — it never writes or
 * mutates any state, so it cannot break existing functionality.
 */

import { useState } from "react";
import { AlertTriangle, X, ExternalLink } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";

const CHAIN_NAMES: Record<string, string> = {
  "1":        "Ethereum Mainnet",
  "11155111": "Sepolia Testnet",
  "137":      "Polygon",
  "8453":     "Base",
  "42161":    "Arbitrum One",
  "10":       "Optimism",
  "56":       "BNB Chain",
  "43114":    "Avalanche C-Chain",
  "250":      "Fantom",
};

const EXPECTED_CHAINS = new Set(["1", "11155111"]);

interface Props {
  /** Override the set of accepted chain IDs (defaults to mainnet + Sepolia). */
  acceptedChains?: Set<string>;
}

export function NetworkMismatchBanner({ acceptedChains = EXPECTED_CHAINS }: Props) {
  const { isConnected, chainId } = useWallet();
  const [dismissed, setDismissed] = useState(false);

  if (!isConnected || !chainId || acceptedChains.has(chainId) || dismissed) return null;

  const currentName = CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
  const expectedName = "Ethereum Mainnet";

  return (
    <div
      role="alert"
      className="relative z-40 flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
      style={{
        background: "linear-gradient(90deg, rgba(220,53,69,0.12), rgba(220,53,69,0.08))",
        borderBottom: "1px solid rgba(220,53,69,0.35)",
        color: "hsl(0 85% 70%)",
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <span className="font-mono text-xs truncate">
          <strong>Wrong network detected</strong>
          {" — "}you are connected to <strong>{currentName}</strong>.
          {" "}Switch to <strong>{expectedName}</strong> in your wallet to purchase traits.
        </span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <a
          href="https://chainlist.org/chain/1"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-1 text-[11px] font-mono underline-offset-2 hover:underline opacity-80 hover:opacity-100 transition-opacity"
        >
          How to switch <ExternalLink className="w-3 h-3" />
        </a>
        <button
          aria-label="Dismiss network warning"
          onClick={() => setDismissed(true)}
          className="p-1 rounded hover:bg-white/10 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
