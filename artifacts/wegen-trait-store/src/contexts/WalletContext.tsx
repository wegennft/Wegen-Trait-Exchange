import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { BrowserProvider, Eip1193Provider, hexlify, toUtf8Bytes } from "ethers";
import bs58 from "bs58";

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
  phantom?: { ethereum?: Eip1193Provider };
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

// ─── Native Solana wallet detection ────────────────────────────────────────
// Separate from the EVM `detectWallets()` above — these are wallets' native
// Solana-namespace providers (ed25519 signing), not their EVM-compat layer.

export type SolanaWalletId = "phantom-sol" | "solflare" | "backpack-sol" | "solana-injected";

export interface SolanaProvider {
  publicKey?: { toString(): string; toBytes?: () => Uint8Array } | null;
  isPhantom?: boolean;
  isSolflare?: boolean;
  isBackpack?: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
  disconnect?: () => Promise<void>;
  signMessage: (message: Uint8Array, display?: string) => Promise<{ signature: Uint8Array } | Uint8Array>;
}

export interface DetectedSolanaWallet {
  id: SolanaWalletId;
  name: string;
  provider: SolanaProvider;
}

type SolanaWindow = Window & {
  phantom?: { solana?: SolanaProvider };
  solflare?: SolanaProvider;
  backpack?: { solana?: SolanaProvider };
  solana?: SolanaProvider;
};

export function detectSolanaWallets(): DetectedSolanaWallet[] {
  const w = window as SolanaWindow;
  const results: DetectedSolanaWallet[] = [];
  const seen = new Set<unknown>();

  const tryAdd = (id: SolanaWalletId, name: string, provider: SolanaProvider | undefined) => {
    if (!provider?.connect || seen.has(provider)) return;
    seen.add(provider);
    results.push({ id, name, provider });
  };

  tryAdd("phantom-sol", "Phantom", w.phantom?.solana);
  tryAdd("solflare", "Solflare", w.solflare);
  tryAdd("backpack-sol", "Backpack", w.backpack?.solana);

  // Generic window.solana fallback (older wallets / non-namespaced injections)
  const sol = w.solana;
  if (sol?.connect && !seen.has(sol)) {
    if (sol.isPhantom) tryAdd("phantom-sol", "Phantom", sol);
    else if (sol.isBackpack) tryAdd("backpack-sol", "Backpack", sol);
    else tryAdd("solana-injected", "Solana Wallet", sol);
  }

  return results;
}

// ─── Context types ───────────────────────────────────────────────────────────

export type ConnectStep = "requesting" | "signing" | null;
export type WalletChainFamily = "evm" | "solana";

interface WalletContextState {
  // ── EVM (existing — unchanged) ──────────────────────────────────────
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
  connect: (provider?: Eip1193Provider) => Promise<void>;
  connectSolana: (wallet: DetectedSolanaWallet) => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextState | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: ReactNode }) {
  // ── EVM state (unchanged) ─────────────────────────────────────────────────
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [chainId, setChainId] = useState<string | null>(null);
  const [walletChain, setWalletChain] = useState<WalletChainFamily | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectStep, setConnectStep] = useState<ConnectStep>(null);
  const [isDevBypass, setIsDevBypass] = useState(false);

  // Restore an existing server session on mount
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) =>
        r.ok
          ? (r.json() as Promise<{
              walletAddress: string;
              walletChain?: WalletChainFamily;
              isAdmin?: boolean;
              isDevBypass?: boolean;
            }>)
          : null,
      )
      .then((data) => {
        if (data?.walletAddress) {
          setWalletAddress(data.walletAddress);
          setIsVerified(true);
          setWalletChain(data.walletChain ?? "evm");
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

      // 2. Get chain ID
      const chainHex = await raw.request({ method: "eth_chainId" }) as string;
      const networkChainId = parseInt(chainHex, 16).toString();
      setChainId(networkChainId);

      const isAddressMismatchError = (err: unknown): boolean => {
        const code = (err as { code?: number }).code;
        const msg = ((err as { message?: string }).message ?? "").toLowerCase();
        return (code === -32000 || code === 32000 || code === 4200) &&
          (msg.includes("does not match") || msg.includes("address"));
      };

      // Some wallets (notably MetaMask) can report a stale `eth_requestAccounts`
      // result if the active account was switched right around connect time,
      // which then causes personal_sign to reject with an address-mismatch
      // error. Re-derive the address fresh right before signing, and retry
      // once end-to-end (new nonce + new signature) if it still mismatches.
      let signature = "";
      let address = "";
      let message = "";
      let lastError: unknown;
      for (let attempt = 0; attempt < 2; attempt++) {
        // Re-fetch the currently active account rather than trusting the
        // possibly-stale result from step 1.
        const freshAccounts = await raw.request({ method: "eth_accounts" }) as string[];
        const rawAddress = freshAccounts[0] ?? accounts[0];
        address = rawAddress.toLowerCase(); // normalized lowercase for all server calls

        // 3. Fetch one-time nonce challenge for the (freshly-resolved) address
        const nonceRes = await fetch(
          `/api/auth/nonce?address=${encodeURIComponent(address)}&chainId=${encodeURIComponent(networkChainId)}`,
        );
        if (!nonceRes.ok) throw new Error("Failed to fetch sign-in challenge");
        const nonceData = (await nonceRes.json()) as { nonce: string; message: string };
        message = nonceData.message;

        // 4. Sign — try ethers signMessage first (MetaMask), fall back to raw personal_sign
        //    (needed for Phantom, Backpack, and other wallets that reject the ethers wrapper)
        setConnectStep("signing");
        try {
          const browserProvider = new BrowserProvider(resolvedEth);
          const signer = await browserProvider.getSigner();
          signature = await signer.signMessage(message);
          lastError = undefined;
          break;
        } catch (signErr) {
          // Some wallets (or ethers' own error-normalization layer) return
          // malformed/unrecognized error shapes that ethers can't parse into
          // a standard code — surfacing as ethers' generic "could not
          // coalesce error" instead of the wallet's real error. Rather than
          // gate the fallback on specific numeric codes (which misses these
          // cases), always retry with the raw personal_sign RPC call, which
          // is the more universally-compatible signing path.
          try {
            const hexMsg = hexlify(toUtf8Bytes(message));
            // Use rawAddress (original wallet casing) — Phantom validates this
            // strictly and rejects lowercase addresses with code -32000.
            signature = await raw.request({
              method: "personal_sign",
              params: [hexMsg, rawAddress],
            }) as string;
            lastError = undefined;
            break;
          } catch (fallbackErr) {
            lastError = fallbackErr;
            if (isAddressMismatchError(fallbackErr) && attempt === 0) {
              continue; // retry once with a freshly-resolved account + new nonce
            }
            if (isAddressMismatchError(signErr) && attempt === 0) {
              continue; // retry once with a freshly-resolved account + new nonce
            }
            throw fallbackErr;
          }
        }
      }
      if (lastError) {
        throw Object.assign(
          new Error(
            "Your wallet reported a different account than the one being verified. " +
            "Please make sure the correct account is selected in your wallet, then try connecting again."
          ),
          { code: -32000 }
        );
      }

      // 5. Server verifies signature and creates a session
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, message, signature, chain: "evm" }),
      });
      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Signature verification failed");
      }

      setWalletAddress(address);
      setIsVerified(true);
      setWalletChain("evm");

      // Fetch admin status now that a session exists
      fetch("/api/auth/session")
        .then((r) => (r.ok ? (r.json() as Promise<{ isAdmin?: boolean }>) : null))
        .then((data) => setIsAdmin(!!data?.isAdmin))
        .catch(() => setIsAdmin(false));
    } catch (error) {
      throw error;
    } finally {
      setIsConnecting(false);
      setConnectStep(null);
    }
  };

  // ── Native Solana connect flow (ed25519 signMessage, separate from EVM) ──
  const connectSolana = async (wallet: DetectedSolanaWallet) => {
    setIsConnecting(true);
    setConnectStep("requesting");
    try {
      const { provider } = wallet;
      const { publicKey } = await provider.connect();
      const address = publicKey.toString();

      // 1. Fetch one-time nonce challenge for this Solana address
      const nonceRes = await fetch(
        `/api/auth/nonce?address=${encodeURIComponent(address)}&chain=solana`,
      );
      if (!nonceRes.ok) throw new Error("Failed to fetch sign-in challenge");
      const { message } = (await nonceRes.json()) as { nonce: string; message: string };

      // 2. Sign the challenge message with the wallet's native ed25519 key
      setConnectStep("signing");
      const messageBytes = new TextEncoder().encode(message);
      const signResult = await provider.signMessage(messageBytes, "utf8");
      const signatureBytes =
        signResult instanceof Uint8Array ? signResult : signResult.signature;
      const signature = bs58.encode(signatureBytes);

      // 3. Server verifies the ed25519 signature and creates a session
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, message, signature, chain: "solana" }),
      });
      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Signature verification failed");
      }

      setWalletAddress(address);
      setIsVerified(true);
      setWalletChain("solana");
      setChainId(null); // Solana has no EVM chain ID — clear any stale EVM chain state

      // Fetch admin status now that a session exists
      fetch("/api/auth/session")
        .then((r) => (r.ok ? (r.json() as Promise<{ isAdmin?: boolean }>) : null))
        .then((data) => setIsAdmin(!!data?.isAdmin))
        .catch(() => setIsAdmin(false));
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
    setIsAdmin(false);
    setChainId(null);
    setWalletChain(null);
    setIsDevBypass(false);
    fetch("/api/auth/disconnect", { method: "POST" }).catch(() => {});
  };

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
        connectSolana,
        disconnect,
      }}
    >
      {isDevBypass && <DevBypassBanner walletAddress={walletAddress} />}
      {children}
    </WalletContext.Provider>
  );
}

/**
 * Dev-only visual warning shown whenever DEV_AUTO_ADMIN is active on the
 * server, so it's never mistaken for a real connected wallet during local
 * testing. The server already guarantees this flag can never be true in
 * production (see getDevBypassWallet).
 */
function DevBypassBanner({ walletAddress }: { walletAddress: string | null }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.warn(
      `[DEV_AUTO_ADMIN] Auto-admin bypass is active — requests are being treated as admin wallet ${walletAddress ?? "(unknown)"} without a real wallet connection. Set DEV_AUTO_ADMIN=false to test real sign-in flows.`,
    );
  }, [walletAddress]);

  return (
    <div className="sticky top-0 z-50 w-full bg-amber-500 px-4 py-2 text-center text-sm font-medium text-black">
      ⚠️ Dev auto-admin bypass is ON — you're auto-signed-in as {walletAddress} without connecting a real wallet.
      Disable <code className="font-mono">DEV_AUTO_ADMIN</code> to test real wallet sign-in.
    </div>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used within a WalletProvider");
  return context;
}
