import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { BrowserProvider, Eip1193Provider, hexlify, toUtf8Bytes } from "ethers";

// Resolve the best available Ethereum provider.
// Priority: Phantom Ethereum → window.ethereum (MetaMask / injected)
function getEthProvider(): Eip1193Provider | null {
  // Phantom exposes its own EIP-1193 provider under window.phantom.ethereum.
  // Prefer it over window.ethereum to avoid MetaMask overriding Phantom.
  const phantom = (window as unknown as { phantom?: { ethereum?: Eip1193Provider } }).phantom;
  if (phantom?.ethereum?.request) return phantom.ethereum;
  if ((window as { ethereum?: Eip1193Provider }).ethereum) {
    return (window as { ethereum?: Eip1193Provider }).ethereum!;
  }
  return null;
}

export type ConnectStep = "requesting" | "signing" | null;

interface WalletContextState {
  walletAddress: string | null;
  isConnected: boolean;
  isVerified: boolean;
  isConnecting: boolean;
  connectStep: ConnectStep;
  chainId: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextState | undefined>(undefined);

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
      // Wallet disconnected externally — clear our session too
      setWalletAddress(null);
      setIsVerified(false);
      fetch("/api/auth/disconnect", { method: "POST" }).catch(() => {});
    }
    // Address change requires re-signing — don't auto-trust the new address
  }, []);

  const handleChainChanged = useCallback((chain: string) => {
    setChainId(chain);
  }, []);

  useEffect(() => {
    const eth = getEthProvider();
    if (!eth) return;
    (eth as { on: (e: string, cb: (v: unknown) => void) => void }).on("accountsChanged", handleAccountsChanged as (v: unknown) => void);
    (eth as { on: (e: string, cb: (v: unknown) => void) => void }).on("chainChanged", handleChainChanged as (v: unknown) => void);
    return () => {
      const rm = eth as { removeListener?: (e: string, cb: (v: unknown) => void) => void };
      rm.removeListener?.("accountsChanged", handleAccountsChanged as (v: unknown) => void);
      rm.removeListener?.("chainChanged", handleChainChanged as (v: unknown) => void);
    };
  }, [handleAccountsChanged, handleChainChanged]);

  const connect = async () => {
    const eth = getEthProvider();
    if (!eth) {
      alert(
        "No Ethereum wallet detected.\n\n" +
        "• Phantom: open the extension and enable 'Ethereum' network, then refresh.\n" +
        "• MetaMask: install from metamask.io.\n\n" +
        "Note: wallet extensions don't work inside iframes — open the app in its own browser tab."
      );
      return;
    }

    setIsConnecting(true);
    setConnectStep("requesting");
    try {
      const provider = new BrowserProvider(eth);

      // 1. Request account access
      const accounts: string[] = await provider.send("eth_requestAccounts", []);
      if (!accounts.length) throw new Error("No accounts returned from wallet");
      const address = accounts[0].toLowerCase();

      const network = await provider.getNetwork();
      const networkChainId = network.chainId.toString();
      setChainId(networkChainId);

      // 2. Fetch a one-time nonce challenge from the server
      const nonceRes = await fetch(
        `/api/auth/nonce?address=${encodeURIComponent(address)}&chainId=${encodeURIComponent(networkChainId)}`,
      );
      if (!nonceRes.ok) throw new Error("Failed to fetch sign-in challenge");
      const { message } = (await nonceRes.json()) as {
        nonce: string;
        message: string;
      };

      // 3. Ask the user to sign the challenge (proves private key ownership)
      // We call personal_sign directly on the raw provider rather than going
      // through ethers' getSigner().signMessage() — Phantom returns error 32000
      // when ethers encodes the message internally before passing it.
      setConnectStep("signing");
      type RawProvider = { request: (args: { method: string; params: unknown[] }) => Promise<unknown> };
      const hexMsg = hexlify(toUtf8Bytes(message));
      const signature = await (eth as unknown as RawProvider).request({
        method: "personal_sign",
        params: [hexMsg, address],
      }) as string;

      // 4. Server verifies signature and creates a session
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, message, signature }),
      });
      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ?? "Signature verification failed",
        );
      }

      setWalletAddress(address);
      setIsVerified(true);
    } catch (error) {
      throw error; // Let the call site show the right error UI
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
