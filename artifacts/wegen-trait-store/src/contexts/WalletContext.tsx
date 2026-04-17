import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { BrowserProvider } from "ethers";

interface WalletContextState {
  walletAddress: string | null;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  chainId: string | null;
  isConnecting: boolean;
}

const WalletContext = createContext<WalletContextState | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleAccountsChanged = useCallback((accounts: string[]) => {
    if (accounts.length > 0) {
      setWalletAddress(accounts[0].toLowerCase());
    } else {
      setWalletAddress(null);
    }
  }, []);

  const handleChainChanged = useCallback((chain: string) => {
    setChainId(chain);
  }, []);

  useEffect(() => {
    const checkConnection = async () => {
      if (window.ethereum) {
        try {
          const provider = new BrowserProvider(window.ethereum);
          const accounts = await provider.send("eth_accounts", []);
          if (accounts.length > 0) {
            setWalletAddress(accounts[0].toLowerCase());
            const network = await provider.getNetwork();
            setChainId(network.chainId.toString());
          }
        } catch (error) {
          console.error("Failed to check wallet connection:", error);
        }
      }
    };

    checkConnection();

    if (window.ethereum) {
      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);
    }

    return () => {
      if (window.ethereum?.removeListener) {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, [handleAccountsChanged, handleChainChanged]);

  const connect = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask or another Web3 wallet.");
      return;
    }
    
    setIsConnecting(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      if (accounts.length > 0) {
        setWalletAddress(accounts[0].toLowerCase());
        const network = await provider.getNetwork();
        setChainId(network.chainId.toString());
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setWalletAddress(null);
    setChainId(null);
  };

  const value = {
    walletAddress,
    isConnected: !!walletAddress,
    connect,
    disconnect,
    chainId,
    isConnecting
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
