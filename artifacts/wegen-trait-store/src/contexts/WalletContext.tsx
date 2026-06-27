import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { BrowserProvider } from "ethers";

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
    if (!window.ethereum) return;
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);
    return () => {
      if (window.ethereum?.removeListener) {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, [handleAccountsChanged, handleChainChanged]);

  const connect = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask or another Web3 wallet to continue.");
      return;
    }

    setIsConnecting(true);
    setConnectStep("requesting");
    try {
      const provider = new BrowserProvider(window.ethereum);

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
      setConnectStep("signing");
      const signer = await provider.getSigner();
      const signature = await signer.signMessage(message);

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
