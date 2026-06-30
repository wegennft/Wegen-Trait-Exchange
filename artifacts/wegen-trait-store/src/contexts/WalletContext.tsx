import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { BrowserProvider, Eip1193Provider, hexlify, toUtf8Bytes } from "ethers";
import {
  detectSolanaWallets,
  connectSolanaWallet,
  restoreSolanaSession,
  type SolanaProvider,
} from "@/wallet/solana-adapter";

// ─── Wallet detection ───────────────────────────────────────────────────────

export type WalletId =
  | "metamask"
  | "phantom"
  | "backpack"
  | "coinbase"
  | "okx"
  | "trust"
  | "rabby"
  | "rainbow"
  | "brave"
  | "injected";

/** Which chain families this wallet's injected provider can sign for */
export type WalletChain = "evm" | "evm+sol";

export interface DetectedWallet {
  id: WalletId;
  name: string;
  provider: Eip1193Provider;
  chain: WalletChain;
}

type EvmProvider = Eip1193Provider & {
  isMetaMask?: boolean;
  isPhantom?: boolean;
  isCoinbaseWallet?: boolean;
  isRabby?: boolean;
  isBraveWallet?: boolean;
  isBackpack?: boolean;
  isTrust?: boolean;
  isRainbow?: boolean;
};

type AnyWindow = Window & {
  ethereum?: EvmProvider;
  phantom?: { ethereum?: Eip1193Provider; solana?: unknown };
  backpack?: { ethereum?: Eip1193Provider; isBackpack?: boolean };
  coinbaseWalletExtension?: Eip1193Provider;
  okxwallet?: Eip1193Provider;
  trustwallet?: { ethereum?: Eip1193Provider };
};

export function detectWallets(): DetectedWallet[] {
  const w = window as AnyWindow;
  const results: DetectedWallet[] = [];
  const seen = new Set<unknown>();

  const tryAdd = (
    id: WalletId,
    name: string,
    provider: Eip1193Provider | undefined,
    chain: WalletChain = "evm",
  ) => {
    if (!provider?.request || seen.has(provider)) return;
    seen.add(provider);
    results.push({ id, name, provider, chain });
  };

  // 1. Phantom – always exposes its own namespace
  tryAdd("phantom", "Phantom", w.phantom?.ethereum, "evm+sol");

  // 2. Backpack – dedicated namespace takes priority over window.ethereum flag
  tryAdd("backpack", "Backpack", w.backpack?.ethereum, "evm+sol");

  // 3. Coinbase Wallet – has its own extension object separate from window.ethereum
  tryAdd("coinbase", "Coinbase Wallet", w.coinbaseWalletExtension, "evm");

  // 4. OKX Wallet – dedicated window.okxwallet namespace
  tryAdd("okx", "OKX Wallet", w.okxwallet, "evm+sol");

  // 5. Trust Wallet – dedicated window.trustwallet namespace
  tryAdd("trust", "Trust Wallet", w.trustwallet?.ethereum, "evm");

  // 6. window.ethereum – check specific flags, deduplicate
  const eth = w.ethereum;
  if (eth?.request && !seen.has(eth)) {
    if (eth.isBackpack) {
      tryAdd("backpack", "Backpack", eth, "evm+sol");
    } else if (eth.isCoinbaseWallet) {
      tryAdd("coinbase", "Coinbase Wallet", eth, "evm");
    } else if (eth.isRabby) {
      tryAdd("rabby", "Rabby", eth, "evm");
    } else if (eth.isRainbow) {
      tryAdd("rainbow", "Rainbow", eth, "evm");
    } else if (eth.isBraveWallet) {
      tryAdd("brave", "Brave Wallet", eth, "evm");
    } else if (eth.isMetaMask) {
      tryAdd("metamask", "MetaMask", eth, "evm");
    } else {
      tryAdd("injected", "Browser Wallet", eth, "evm");
    }
  }

  return results;
}

// ─── Context types ───────────────────────────────────────────────────────────

export type ConnectStep = "requesting" | "signing" | null;

interface WalletContextState {
  // ── EVM (existing — unchanged) ──────────────────────────────────────
  walletAddress: string | null;
  isConnected: boolean;
  isVerified: boolean;
  isConnecting: boolean;
  connectStep: ConnectStep;
  chainId: string | null;
  connect: (provider?: Eip1193Provider) => Promise<void>;
  disconnect: () => void;

  // ── Solana (additive — Locker/purchase still use EVM) ───────────────
  /** Base58 Solana public key, or null when no Solana wallet is connected. */
  solanaAddress: string | null;
  isSolanaConnected: boolean;
  isSolanaConnecting: boolean;
  /**
   * Connect a native Solana wallet. Resolves with the base58 public key.
   * Does NOT affect the EVM session or server auth (server only supports EVM).
   */
  connectSolana: (provider: SolanaProvider) => Promise<string>;
  disconnectSolana: () => void;
}

const WalletContext = createContext<WalletContextState | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: ReactNode }) {
  // ── EVM state (unchanged) ─────────────────────────────────────────────────
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [chainId, setChainId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectStep, setConnectStep] = useState<ConnectStep>(null);

  // ── Solana state (new, additive) ──────────────────────────────────────────
  const [solanaAddress, setSolanaAddress] = useState<string | null>(null);
  const [isSolanaConnecting, setIsSolanaConnecting] = useState(false);
  const [_activeSolanaProvider, setActiveSolanaProvider] = useState<SolanaProvider | null>(null);

  // Restore an existing server session on mount
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => (r.ok ? (r.json() as Promise<{ walletAddress: string }>) : null))
      .then((data) => {
        if (data?.walletAddress) {
          setWalletAddress(data.walletAddress);
          setIsVerified(true);
        }
      })
      .catch(() => {});
  }, []);

  // Silently restore a trusted Solana session on mount (never prompts)
  useEffect(() => {
    const solWallets = detectSolanaWallets();
    if (!solWallets.length) return;
    void restoreSolanaSession(solWallets[0].provider).then((addr) => {
      if (addr) {
        setSolanaAddress(addr);
        setActiveSolanaProvider(solWallets[0].provider);
      }
    });
  }, []);

  const handleAccountsChanged = useCallback((accounts: string[]) => {
    if (accounts.length === 0) {
      setWalletAddress(null);
      setIsVerified(false);
      fetch("/api/auth/disconnect", { method: "POST" }).catch(() => {});
    }
  }, []);

  const handleChainChanged = useCallback((chain: string) => {
    setChainId(chain);
  }, []);

  // Listen on whatever wallet is currently active (best-effort)
  useEffect(() => {
    const wallets = detectWallets();
    if (!wallets.length) return;
    const eth = wallets[0].provider;
    type Listenable = { on?: (e: string, cb: (v: unknown) => void) => void; removeListener?: (e: string, cb: (v: unknown) => void) => void };
    const l = eth as unknown as Listenable;
    l.on?.("accountsChanged", handleAccountsChanged as (v: unknown) => void);
    l.on?.("chainChanged", handleChainChanged as (v: unknown) => void);
    return () => {
      l.removeListener?.("accountsChanged", handleAccountsChanged as (v: unknown) => void);
      l.removeListener?.("chainChanged", handleChainChanged as (v: unknown) => void);
    };
  }, [handleAccountsChanged, handleChainChanged]);

  const connect = async (eth?: Eip1193Provider) => {
    const resolvedEth: Eip1193Provider | null = eth ?? (() => {
      const wallets = detectWallets();
      if (wallets.length === 0) return null;
      return wallets.find(w => w.id === "metamask")?.provider
          ?? wallets.find(w => w.id === "injected")?.provider
          ?? wallets[0].provider;
    })();

    if (!resolvedEth) {
      throw Object.assign(
        new Error(
          "No Ethereum wallet detected. Install MetaMask, Backpack, Phantom, or another EVM wallet, then refresh.\n" +
          "Note: wallet extensions don't work inside iframes — open the app in its own tab."
        ),
        { code: -32603 }
      );
    }

    setIsConnecting(true);
    setConnectStep("requesting");
    try {
      type RawProvider = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
      const raw = resolvedEth as unknown as RawProvider;

      // 1. Request account access
      const accounts = await raw.request({ method: "eth_requestAccounts", params: [] }) as string[];
      if (!accounts.length) throw new Error("No accounts returned from wallet");
      const address = accounts[0].toLowerCase();

      // 2. Get chain ID
      const chainHex = await raw.request({ method: "eth_chainId" }) as string;
      const networkChainId = parseInt(chainHex, 16).toString();
      setChainId(networkChainId);

      // 3. Fetch one-time nonce challenge
      const nonceRes = await fetch(
        `/api/auth/nonce?address=${encodeURIComponent(address)}&chainId=${encodeURIComponent(networkChainId)}`,
      );
      if (!nonceRes.ok) throw new Error("Failed to fetch sign-in challenge");
      const { message } = (await nonceRes.json()) as { nonce: string; message: string };

      // 4. Sign — try ethers signMessage first (MetaMask), fall back to raw personal_sign
      //    (needed for Phantom, Backpack, and other wallets that reject the ethers wrapper)
      setConnectStep("signing");
      let signature: string;
      try {
        const browserProvider = new BrowserProvider(resolvedEth);
        const signer = await browserProvider.getSigner();
        signature = await signer.signMessage(message);
      } catch (signErr) {
        const code = (signErr as { code?: number }).code;
        if (code === -32000 || code === 32000 || code === 4200) {
          const hexMsg = hexlify(toUtf8Bytes(message));
          signature = await raw.request({
            method: "personal_sign",
            params: [hexMsg, address],
          }) as string;
        } else {
          throw signErr;
        }
      }

      // 5. Server verifies signature and creates a session
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, message, signature }),
      });
      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Signature verification failed");
      }

      setWalletAddress(address);
      setIsVerified(true);
    } catch (error) {
      throw error;
    } finally {
      setIsConnecting(false);
      setConnectStep(null);
    }
  };

  const disconnect = () => {
    setWalletAddress(null);
    setIsVerified(false);
    setChainId(null);
    fetch("/api/auth/disconnect", { method: "POST" }).catch(() => {});
  };

  // ── Solana connect / disconnect ───────────────────────────────────────────

  const connectSolana = async (provider: SolanaProvider): Promise<string> => {
    setIsSolanaConnecting(true);
    try {
      const address = await connectSolanaWallet(provider);
      setSolanaAddress(address);
      setActiveSolanaProvider(provider);

      // Listen for Solana account changes
      provider.on("accountChanged", (publicKey: unknown) => {
        if (!publicKey) {
          setSolanaAddress(null);
          setActiveSolanaProvider(null);
        } else {
          setSolanaAddress(String(publicKey));
        }
      });
      provider.on("disconnect", () => {
        setSolanaAddress(null);
        setActiveSolanaProvider(null);
      });

      return address;
    } finally {
      setIsSolanaConnecting(false);
    }
  };

  const disconnectSolana = () => {
    setSolanaAddress(null);
    setActiveSolanaProvider(null);
  };

  return (
    <WalletContext.Provider
      value={{
        // EVM (unchanged)
        walletAddress,
        isConnected: !!walletAddress && isVerified,
        isVerified,
        isConnecting,
        connectStep,
        chainId,
        connect,
        disconnect,
        // Solana (additive)
        solanaAddress,
        isSolanaConnected: !!solanaAddress,
        isSolanaConnecting,
        connectSolana,
        disconnectSolana,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used within a WalletProvider");
  return context;
}
