import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useRef,
} from "react";
import type { Eip1193Provider } from "ethers";
import { useAppKit, useAppKitProvider } from "@reown/appkit/react";
import {
  detectSolanaWallets,
  connectSolanaWallet,
  restoreSolanaSession,
  type SolanaProvider,
} from "@/wallet/solana-adapter";
import { detectWallets, getInstalledWallet } from "@/wallet/evm-wallets";
import { signInWithEvmProvider } from "@/wallet/siwe";
import { isWalletConnectConfigured } from "@/wallet/appkit-config";
import type { ConnectStep, WalletId } from "@/wallet/types";
import { WalletPickerDialog } from "@/components/wallet/WalletPickerDialog";

export type { WalletId, WalletChain, DetectedWallet } from "@/wallet/types";
export { detectWallets, getEvmWalletOptions, WALLET_COLORS, WALLET_ICONS } from "@/wallet/evm-wallets";

interface WalletContextState {
  walletAddress: string | null;
  isConnected: boolean;
  isVerified: boolean;
  isConnecting: boolean;
  connectStep: ConnectStep;
  chainId: string | null;
  connect: (provider?: Eip1193Provider) => Promise<void>;
  connectWallet: (walletId: WalletId) => Promise<void>;
  connectWalletConnect: () => Promise<void>;
  isWalletConnectAvailable: boolean;
  disconnect: () => void;

  solanaAddress: string | null;
  isSolanaConnected: boolean;
  isSolanaConnecting: boolean;
  connectSolana: (provider: SolanaProvider) => Promise<string>;
  disconnectSolana: () => void;

  walletPickerOpen: boolean;
  setWalletPickerOpen: (open: boolean) => void;
  openWalletPicker: () => void;
}

const WalletContext = createContext<WalletContextState | undefined>(undefined);

function WalletProviderInner({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [chainId, setChainId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectStep, setConnectStep] = useState<ConnectStep>(null);

  const [solanaAddress, setSolanaAddress] = useState<string | null>(null);
  const [isSolanaConnecting, setIsSolanaConnecting] = useState(false);
  const [_activeSolanaProvider, setActiveSolanaProvider] = useState<SolanaProvider | null>(null);
  const [walletPickerOpen, setWalletPickerOpen] = useState(false);

  const openWalletPicker = useCallback(() => {
    setWalletPickerOpen(true);
  }, []);

  const activeProviderRef = useRef<Eip1193Provider | null>(null);
  const { open: openAppKit } = useAppKit();
  const { walletProvider: wcProvider } = useAppKitProvider("eip155");

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

  useEffect(() => {
    const provider = activeProviderRef.current;
    if (!provider) return;
    type Listenable = {
      on?: (e: string, cb: (v: unknown) => void) => void;
      removeListener?: (e: string, cb: (v: unknown) => void) => void;
    };
    const l = provider as unknown as Listenable;
    l.on?.("accountsChanged", handleAccountsChanged as (v: unknown) => void);
    l.on?.("chainChanged", handleChainChanged as (v: unknown) => void);
    return () => {
      l.removeListener?.("accountsChanged", handleAccountsChanged as (v: unknown) => void);
      l.removeListener?.("chainChanged", handleChainChanged as (v: unknown) => void);
    };
  }, [walletAddress, handleAccountsChanged, handleChainChanged]);

  const completeSignIn = async (provider: Eip1193Provider) => {
    const result = await signInWithEvmProvider(provider, setConnectStep);
    activeProviderRef.current = provider;
    setWalletAddress(result.address);
    setChainId(result.chainId);
    setIsVerified(true);
  };

  const connect = async (eth?: Eip1193Provider) => {
    const resolvedEth: Eip1193Provider | null =
      eth ??
      (() => {
        const wallets = detectWallets();
        if (wallets.length === 0) return null;
        return (
          wallets.find((w) => w.id === "metamask")?.provider ??
          wallets.find((w) => w.id === "backpack")?.provider ??
          wallets.find((w) => w.id === "injected")?.provider ??
          wallets[0].provider
        );
      })();

    if (!resolvedEth) {
      throw Object.assign(
        new Error(
          "No Ethereum wallet detected. Choose MetaMask, Backpack, or another wallet from the list, " +
            "or use WalletConnect on mobile.",
        ),
        { code: -32603 },
      );
    }

    setIsConnecting(true);
    setConnectStep("requesting");
    try {
      await completeSignIn(resolvedEth);
    } finally {
      setIsConnecting(false);
      setConnectStep(null);
    }
  };

  const connectWallet = async (walletId: WalletId) => {
    const installed = getInstalledWallet(walletId);
    if (installed?.provider) {
      await connect(installed.provider);
      return;
    }
    if (isWalletConnectConfigured) {
      await connectWalletConnect();
      return;
    }
    throw Object.assign(
      new Error(`${walletId} is not installed. Install the extension or use WalletConnect.`),
      { code: -32603 },
    );
  };

  const connectWalletConnect = async () => {
    if (!isWalletConnectConfigured) {
      throw new Error(
        "WalletConnect is not configured. Add VITE_WALLETCONNECT_PROJECT_ID to enable mobile wallets.",
      );
    }

    setIsConnecting(true);
    setConnectStep("requesting");
    try {
      await openAppKit({ view: "Connect" });

      const provider = await new Promise<Eip1193Provider>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          clearInterval(interval);
          reject(new Error("Wallet connection timed out. Please try again."));
        }, 120_000);

        const interval = window.setInterval(() => {
          const p = wcProvider as Eip1193Provider | undefined;
          if (p?.request) {
            clearInterval(interval);
            clearTimeout(timeout);
            resolve(p);
          }
        }, 300);
      });

      await completeSignIn(provider);
    } finally {
      setIsConnecting(false);
      setConnectStep(null);
    }
  };

  const disconnect = () => {
    setWalletAddress(null);
    setIsVerified(false);
    setChainId(null);
    activeProviderRef.current = null;
    fetch("/api/auth/disconnect", { method: "POST" }).catch(() => {});
  };

  const connectSolana = async (provider: SolanaProvider): Promise<string> => {
    setIsSolanaConnecting(true);
    try {
      const address = await connectSolanaWallet(provider);
      setSolanaAddress(address);
      setActiveSolanaProvider(provider);

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
        walletAddress,
        isConnected: !!walletAddress && isVerified,
        isVerified,
        isConnecting,
        connectStep,
        chainId,
        connect,
        connectWallet,
        connectWalletConnect,
        isWalletConnectAvailable: isWalletConnectConfigured,
        disconnect,
        solanaAddress,
        isSolanaConnected: !!solanaAddress,
        isSolanaConnecting,
        connectSolana,
        disconnectSolana,
        walletPickerOpen,
        setWalletPickerOpen,
        openWalletPicker,
      }}
    >
      {children}
      <WalletPickerDialog />
    </WalletContext.Provider>
  );
}

export function WalletProvider({ children }: { children: ReactNode }) {
  return <WalletProviderInner>{children}</WalletProviderInner>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used within a WalletProvider");
  return context;
}
