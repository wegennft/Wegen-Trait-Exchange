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
import { detectWallets, getInstalledWallet, requestEip6963Providers } from "@/wallet/evm-wallets";
import { signInWithEvmProvider } from "@/wallet/siwe";
import { isWalletConnectConfigured } from "@/wallet/appkit-config";
import type { ConnectStep, WalletId } from "@/wallet/types";
import { WalletPickerDialog } from "@/components/wallet/WalletPickerDialog";

export type { WalletId, WalletChain, DetectedWallet, ConnectStep } from "@/wallet/types";
export {
  detectWallets,
  getEvmWalletOptions,
  WALLET_COLORS,
  WALLET_ICONS,
} from "@/wallet/evm-wallets";

export type WalletChainFamily = "evm";

interface WalletContextState {
  walletAddress: string | null;
  isConnected: boolean;
  isVerified: boolean;
  isAdmin: boolean;
  isConnecting: boolean;
  connectStep: ConnectStep;
  chainId: string | null;
  walletChain: WalletChainFamily | null;
  /** True when the server is treating this request as an authenticated admin
   *  via the dev-only DEV_AUTO_ADMIN bypass, rather than a real wallet
   *  connection. Never true in production. */
  isDevBypass: boolean;
  connect: (provider?: Eip1193Provider, walletId?: WalletId) => Promise<void>;
  connectWallet: (walletId: WalletId) => Promise<void>;
  connectWalletConnect: () => Promise<void>;
  isWalletConnectAvailable: boolean;
  disconnect: () => void;
  walletPickerOpen: boolean;
  setWalletPickerOpen: (open: boolean) => void;
  openWalletPicker: () => void;
  /** Send ETH from the connected wallet to `to`. Returns the tx hash. */
  sendPayment: (to: string, valueWeiHex: string) => Promise<string>;
  /** Switch the wallet to `targetChainId`, adding the chain if needed. */
  switchToChain: (targetChainId: number) => Promise<void>;
  /** Sign EIP-712 typed data. Returns the 0x-prefixed signature. */
  signTypedData: (
    domain: Record<string, unknown>,
    types: Record<string, { name: string; type: string }[]>,
    value: Record<string, unknown>,
  ) => Promise<string>;
}

const WalletContext = createContext<WalletContextState | undefined>(undefined);

const KNOWN_CHAINS: Record<
  number,
  {
    chainName: string;
    nativeCurrency: { name: string; symbol: string; decimals: number };
    rpcUrls: string[];
    blockExplorerUrls: string[];
  }
> = {
  1: {
    chainName: "Ethereum Mainnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://eth.llamarpc.com"],
    blockExplorerUrls: ["https://etherscan.io"],
  },
  8453: {
    chainName: "Base",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://mainnet.base.org"],
    blockExplorerUrls: ["https://basescan.org"],
  },
  84532: {
    chainName: "Base Sepolia",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://sepolia.base.org"],
    blockExplorerUrls: ["https://sepolia.basescan.org"],
  },
  137: {
    chainName: "Polygon",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    rpcUrls: ["https://polygon-rpc.com"],
    blockExplorerUrls: ["https://polygonscan.com"],
  },
  11155111: {
    chainName: "Sepolia",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://rpc.sepolia.org"],
    blockExplorerUrls: ["https://sepolia.etherscan.io"],
  },
};

function WalletProviderInner({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [chainId, setChainId] = useState<string | null>(null);
  const [walletChain, setWalletChain] = useState<WalletChainFamily | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectStep, setConnectStep] = useState<ConnectStep>(null);
  const [isDevBypass, setIsDevBypass] = useState(false);
  const [walletPickerOpen, setWalletPickerOpen] = useState(false);

  const providerRef = useRef<Eip1193Provider | null>(null);
  const wcProviderRef = useRef<Eip1193Provider | null>(null);
  const { open: openAppKit } = useAppKit();
  const { walletProvider: wcProvider } = useAppKitProvider("eip155");

  useEffect(() => {
    wcProviderRef.current = (wcProvider as Eip1193Provider | undefined) ?? null;
  }, [wcProvider]);

  const openWalletPicker = useCallback(() => {
    setWalletPickerOpen(true);
  }, []);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) =>
        r.ok
          ? (r.json() as Promise<{
              walletAddress: string;
              walletChain?: string;
              isAdmin?: boolean;
              isDevBypass?: boolean;
            }>)
          : null,
      )
      .then((data) => {
        if (data?.walletAddress) {
          // EVM-only: ignore legacy Solana sessions so the UI never shows a non-EVM identity.
          if (data.walletChain === "solana") {
            fetch("/api/auth/disconnect", { method: "POST" }).catch(() => {});
            return;
          }
          setWalletAddress(data.walletAddress);
          setIsVerified(true);
          setWalletChain("evm");
          setIsAdmin(!!data.isAdmin);
          setIsDevBypass(!!data.isDevBypass);
        }
      })
      .catch(() => {});
  }, []);

  const handleAccountsChanged = useCallback((accounts: string[]) => {
    if (accounts.length === 0) {
      setWalletAddress(null);
      setIsVerified(false);
      setWalletChain(null);
      setIsAdmin(false);
      fetch("/api/auth/disconnect", { method: "POST" }).catch(() => {});
    }
  }, []);

  const handleChainChanged = useCallback((chain: string) => {
    setChainId(chain);
  }, []);

  useEffect(() => {
    const provider = providerRef.current;
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

  const refreshAdmin = () => {
    fetch("/api/auth/session")
      .then((r) => (r.ok ? (r.json() as Promise<{ isAdmin?: boolean }>) : null))
      .then((data) => setIsAdmin(!!data?.isAdmin))
      .catch(() => setIsAdmin(false));
  };

  const completeSignIn = async (provider: Eip1193Provider, walletId?: WalletId) => {
    const result = await signInWithEvmProvider(provider, setConnectStep, walletId);
    providerRef.current = provider;
    setWalletAddress(result.address);
    setChainId(result.chainId);
    setIsVerified(true);
    setWalletChain("evm");
    setIsDevBypass(false);
    refreshAdmin();
  };

  const connect = async (eth?: Eip1193Provider, walletId?: WalletId) => {
    // No provider passed → open the picker so the user chooses (mobile needs WalletConnect).
    if (!eth) {
      openWalletPicker();
      return;
    }

    setIsConnecting(true);
    setConnectStep("requesting");
    try {
      await completeSignIn(eth, walletId);
    } finally {
      setIsConnecting(false);
      setConnectStep(null);
    }
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
          const p = wcProviderRef.current;
          if (p?.request) {
            clearInterval(interval);
            clearTimeout(timeout);
            resolve(p);
          }
        }, 300);
      });

      // Brief pause so WalletConnect session is ready before personal_sign
      await new Promise((r) => setTimeout(r, 400));
      await completeSignIn(provider);
    } finally {
      setIsConnecting(false);
      setConnectStep(null);
    }
  };

  const connectWallet = async (walletId: WalletId) => {
    await requestEip6963Providers();
    const installed = getInstalledWallet(walletId);
    if (installed?.provider) {
      await connect(installed.provider, walletId);
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

  const disconnect = () => {
    setWalletAddress(null);
    setIsVerified(false);
    setIsAdmin(false);
    setChainId(null);
    setWalletChain(null);
    setIsDevBypass(false);
    providerRef.current = null;
    fetch("/api/auth/disconnect", { method: "POST" }).catch(() => {});
  };

  const sendPayment = useCallback(
    async (to: string, valueWeiHex: string): Promise<string> => {
      const provider = providerRef.current;
      if (!provider || !walletAddress) throw new Error("Wallet not connected");
      type RawProvider = {
        request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      };
      const raw = provider as unknown as RawProvider;
      const txHash = (await raw.request({
        method: "eth_sendTransaction",
        params: [{ from: walletAddress, to, value: valueWeiHex, gas: "0x5208" }],
      })) as string;
      return txHash;
    },
    [walletAddress],
  );

  const switchToChain = useCallback(async (targetChainId: number): Promise<void> => {
    const provider = providerRef.current;
    if (!provider) throw new Error("Wallet not connected");
    type RawProvider = {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
    const raw = provider as unknown as RawProvider;
    const chainHex = "0x" + targetChainId.toString(16);
    try {
      await raw.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainHex }] });
      setChainId(chainHex);
    } catch (err) {
      const code = (err as { code?: number }).code;
      if (code === 4902 || code === -32603) {
        const cfg = KNOWN_CHAINS[targetChainId];
        if (!cfg) throw new Error(`Chain ${targetChainId} is not known. Add it to your wallet manually.`);
        await raw.request({
          method: "wallet_addEthereumChain",
          params: [{ chainId: chainHex, ...cfg }],
        });
        setChainId(chainHex);
      } else {
        throw err;
      }
    }
  }, []);

  const signTypedData = useCallback(
    async (
      domain: Record<string, unknown>,
      types: Record<string, { name: string; type: string }[]>,
      value: Record<string, unknown>,
    ): Promise<string> => {
      const provider = providerRef.current;
      if (!provider || !walletAddress) throw new Error("Wallet not connected");
      type RawProvider = {
        request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      };
      const raw = provider as unknown as RawProvider;

      const domainTypes: { name: string; type: string }[] = [];
      if ("name" in domain) domainTypes.push({ name: "name", type: "string" });
      if ("version" in domain) domainTypes.push({ name: "version", type: "string" });
      if ("chainId" in domain) domainTypes.push({ name: "chainId", type: "uint256" });
      if ("verifyingContract" in domain)
        domainTypes.push({ name: "verifyingContract", type: "address" });

      const typedDataJson = JSON.stringify({
        domain,
        types: { EIP712Domain: domainTypes, ...types },
        primaryType: Object.keys(types)[0],
        message: value,
      });

      const sig = (await raw.request({
        method: "eth_signTypedData_v4",
        params: [walletAddress, typedDataJson],
      })) as string;
      return sig;
    },
    [walletAddress],
  );

  return (
    <WalletContext.Provider
      value={{
        walletAddress,
        isConnected: !!walletAddress && isVerified,
        isVerified,
        isAdmin,
        isConnecting,
        connectStep,
        chainId,
        walletChain,
        isDevBypass,
        connect,
        connectWallet,
        connectWalletConnect,
        isWalletConnectAvailable: isWalletConnectConfigured,
        disconnect,
        walletPickerOpen,
        setWalletPickerOpen,
        openWalletPicker,
        sendPayment,
        switchToChain,
        signTypedData,
      }}
    >
      {isDevBypass && <DevBypassBanner walletAddress={walletAddress} />}
      {children}
      <WalletPickerDialog />
    </WalletContext.Provider>
  );
}

export function WalletProvider({ children }: { children: ReactNode }) {
  return <WalletProviderInner>{children}</WalletProviderInner>;
}

function DevBypassBanner({ walletAddress }: { walletAddress: string | null }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.warn(
      `[DEV_AUTO_ADMIN] Auto-admin bypass is active — requests are being treated as admin wallet ${walletAddress ?? "(unknown)"} without a real wallet connection. Set DEV_AUTO_ADMIN=false to test real sign-in flows.`,
    );
  }, [walletAddress]);

  return (
    <div className="sticky top-0 z-50 w-full bg-amber-500 px-4 py-2 text-center text-sm font-medium text-black">
      ⚠️ Dev auto-admin bypass is ON — you're auto-signed-in as {walletAddress} without connecting a
      real wallet. Disable <code className="font-mono">DEV_AUTO_ADMIN</code> to test real wallet
      sign-in.
    </div>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used within a WalletProvider");
  return context;
}
