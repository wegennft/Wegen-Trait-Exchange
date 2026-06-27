import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { BrowserProvider, Eip1193Provider, hexlify, toUtf8Bytes } from "ethers";

// ─── Wallet detection ───────────────────────────────────────────────────────

export type WalletId = "metamask" | "phantom" | "injected";

export interface DetectedWallet {
  id: WalletId;
  name: string;
  provider: Eip1193Provider;
}

type AnyWindow = Window & {
  ethereum?: Eip1193Provider & { isMetaMask?: boolean; isPhantom?: boolean };
  phantom?: { ethereum?: Eip1193Provider & { isPhantom?: boolean } };
};

export function detectWallets(): DetectedWallet[] {
  const w = window as AnyWindow;
  const results: DetectedWallet[] = [];
  const seen = new Set<unknown>();

  // 1. Phantom Ethereum (always its own object under window.phantom.ethereum)
  const phantomEth = w.phantom?.ethereum;
  if (phantomEth?.request) {
    seen.add(phantomEth);
    results.push({ id: "phantom", name: "Phantom", provider: phantomEth });
  }

  // 2. window.ethereum — MetaMask, Coinbase, or generic injected
  const injected = w.ethereum;
  if (injected?.request && !seen.has(injected)) {
    seen.add(injected);
    if (injected.isMetaMask) {
      results.push({ id: "metamask", name: "MetaMask", provider: injected });
    } else {
      results.push({ id: "injected", name: "Browser Wallet", provider: injected });
    }
  }

  return results;
}

// ─── Context types ───────────────────────────────────────────────────────────

export type ConnectStep = "requesting" | "signing" | null;

interface WalletContextState {
  walletAddress: string | null;
  isConnected: boolean;
  isVerified: boolean;
  isConnecting: boolean;
  connectStep: ConnectStep;
  chainId: string | null;
  connect: (provider?: Eip1193Provider) => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextState | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [chainId, setChainId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectStep, setConnectStep] = useState<ConnectStep>(null);

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
    // Auto-detect when no provider is passed (e.g. calls from WalletConnectGuard / Store)
    const resolvedEth: Eip1193Provider | null = eth ?? (() => {
      const wallets = detectWallets();
      if (wallets.length === 0) return null;
      // Prefer window.ethereum (MetaMask) over Phantom when auto-detecting
      return wallets.find(w => w.id === "metamask")?.provider
          ?? wallets.find(w => w.id === "injected")?.provider
          ?? wallets[0].provider;
    })();

    if (!resolvedEth) {
      throw Object.assign(
        new Error(
          "No Ethereum wallet detected. Install MetaMask (metamask.io) or Phantom, then refresh.\n" +
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

      // 4. Sign — call personal_sign directly to avoid ethers wrapper issues with Phantom
      setConnectStep("signing");
      const hexMsg = hexlify(toUtf8Bytes(message));
      const signature = await raw.request({
        method: "personal_sign",
        params: [hexMsg, address],
      }) as string;

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

  return (
    <WalletContext.Provider
      value={{
        walletAddress,
        isConnected: !!walletAddress && isVerified,
        isVerified,
        isConnecting,
        connectStep,
        chainId,
        connect,
        disconnect,
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
