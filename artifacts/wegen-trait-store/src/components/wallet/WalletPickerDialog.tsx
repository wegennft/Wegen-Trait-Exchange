import { useState, useEffect } from "react";
import type { Eip1193Provider } from "ethers";
import { useWallet, getEvmWalletOptions, WALLET_COLORS, WALLET_ICONS, type WalletId } from "@/contexts/WalletContext";
import { detectSolanaWallets, type DetectedSolanaWallet } from "@/wallet/solana-adapter";
import { isMobileBrowser, requestEip6963Providers } from "@/wallet/evm-wallets";
import type { EvmWalletOption } from "@/wallet/types";
import { formatWalletError, isUserRejection } from "@/wallet/wallet-errors";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const BANGERS = { fontFamily: "'Bungee', Impact, sans-serif", letterSpacing: "0.08em" };

const WALLET_DESC: Partial<Record<WalletId, string>> = {
  metamask: "MetaMask browser extension & mobile app",
  phantom: "Phantom — Ethereum provider",
  backpack: "Backpack — EVM + Solana",
  coinbase: "Coinbase Wallet extension",
  okx: "OKX Wallet — EVM + Solana",
  trust: "Trust Wallet browser extension",
  rabby: "Rabby — EVM-focused wallet",
  rainbow: "Rainbow — Ethereum wallet",
  brave: "Brave browser built-in wallet",
  injected: "Browser-injected EVM wallet",
};

function WalletIcon({ id, name }: { id: WalletId; name: string }) {
  const iconUrl = WALLET_ICONS[id];
  const color = WALLET_COLORS[id];
  const initial = name.charAt(0).toUpperCase();

  if (iconUrl) {
    return (
      <div
        className="w-9 h-9 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center"
        style={{ background: color + "22", border: `1px solid ${color}44` }}
      >
        <img
          src={iconUrl}
          alt={name}
          className="w-7 h-7 object-contain"
          onError={(e) => {
            const target = e.currentTarget;
            target.style.display = "none";
            const parent = target.parentElement;
            if (parent) {
              parent.style.background = color;
              const span = document.createElement("span");
              span.textContent = initial;
              span.style.cssText = "color:white;font-weight:700;font-size:16px;";
              parent.appendChild(span);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-white text-base"
      style={{ background: color }}
    >
      {initial}
    </div>
  );
}

export function WalletPickerDialog() {
  const {
    walletPickerOpen,
    setWalletPickerOpen,
    connect,
    connectWallet,
    connectWalletConnect,
    isWalletConnectAvailable,
    connectSolana,
    isSolanaConnecting,
    solanaAddress,
    isSolanaConnected,
  } = useWallet();
  const { toast } = useToast();
  const [solanaWallets, setSolanaWallets] = useState<DetectedSolanaWallet[]>([]);
  const [evmWalletOptions, setEvmWalletOptions] = useState<EvmWalletOption[]>(() => getEvmWalletOptions());

  useEffect(() => {
    if (walletPickerOpen) {
      setSolanaWallets(detectSolanaWallets());
      void requestEip6963Providers().then(() => {
        setEvmWalletOptions(getEvmWalletOptions());
      });
    }
  }, [walletPickerOpen]);

  const handleOpenChange = (open: boolean) => {
    setWalletPickerOpen(open);
  };

  const doConnectWallet = async (walletId: WalletId, provider?: Eip1193Provider | null) => {
    setWalletPickerOpen(false);
    try {
      if (provider) {
        await connectWallet(walletId);
        return;
      }
      if (isWalletConnectAvailable) {
        await connectWalletConnect();
        return;
      }
      const option = evmWalletOptions.find((w) => w.id === walletId);
      if (option?.installUrl) {
        window.open(option.installUrl, "_blank", "noopener,noreferrer");
        toast({
          title: `Install ${option.name}`,
          description: "Install the wallet extension, refresh this page, then connect again.",
        });
        return;
      }
      await connectWallet(walletId);
    } catch (err) {
      if (isUserRejection(err)) return;
      toast({
        title: "Connection failed",
        description: formatWalletError(err, walletId),
        variant: "destructive",
      });
    }
  };

  const doConnectWalletConnect = async () => {
    setWalletPickerOpen(false);
    try {
      await connectWalletConnect();
    } catch (err) {
      if (isUserRejection(err)) return;
      toast({
        title: "WalletConnect failed",
        description: formatWalletError(err),
        variant: "destructive",
      });
    }
  };

  const doConnectSolana = async (wallet: DetectedSolanaWallet) => {
    setWalletPickerOpen(false);
    try {
      const addr = await connectSolana(wallet.provider);
      toast({ title: `${wallet.name} connected`, description: `${addr.slice(0, 6)}…${addr.slice(-4)}` });
    } catch (err) {
      const code = (err as { code?: number }).code;
      if (code === 4001) return;
      toast({
        title: "Solana connection failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={walletPickerOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm border border-white/10 bg-black/90 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-center text-lg" style={BANGERS}>
            Choose Wallet
          </DialogTitle>
          <p className="text-center text-xs text-muted-foreground mt-1">
            Select which wallet to connect with
          </p>
        </DialogHeader>

        <div className="flex flex-col gap-2 mt-2 max-h-[60vh] overflow-y-auto">
          <p className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest px-1 pt-1">
            Ethereum Wallets
          </p>

          {evmWalletOptions.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => void doConnectWallet(w.id, w.provider)}
              className="flex items-center gap-3 w-full rounded-xl px-4 py-3 border border-white/10 bg-white/5 hover:bg-white/10 active:scale-[0.98] transition-all text-left group"
            >
              <WalletIcon id={w.id} name={w.name} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm leading-tight">{w.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {WALLET_DESC[w.id] ?? w.description}
                </div>
              </div>
              <span
                className="flex-shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded border"
                style={
                  w.installed
                    ? { color: "#4ade80", borderColor: "#4ade8044", background: "#4ade8011" }
                    : { color: "#94a3b8", borderColor: "#94a3b844", background: "#94a3b811" }
                }
              >
                {w.installed ? "Installed" : isMobileBrowser() ? "App" : "Install"}
              </span>
            </button>
          ))}

          {isWalletConnectAvailable && (
            <button
              type="button"
              onClick={() => void doConnectWalletConnect()}
              className="flex items-center gap-3 w-full rounded-xl px-4 py-3 border border-blue-400/30 bg-blue-500/10 hover:bg-blue-500/15 active:scale-[0.98] transition-all text-left mt-1"
            >
              <div
                className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-white text-xs"
                style={{ background: "#3396ff", border: "1px solid #3396ff88" }}
              >
                WC
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm leading-tight">WalletConnect</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  MetaMask, Backpack, Rainbow & 300+ wallets — best for mobile
                </div>
              </div>
              <span
                className="flex-shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded border"
                style={{ color: "#60a5fa", borderColor: "#60a5fa44", background: "#60a5fa11" }}
              >
                QR
              </span>
            </button>
          )}

          {solanaWallets.length > 0 && (
            <>
              <p className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest px-1 pt-2">
                Solana Wallets
              </p>
              <p className="text-[10px] font-mono text-amber-500/60 px-1 -mt-1">
                Trait purchases require EVM. Solana connects for display only.
              </p>
              {solanaWallets.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => void doConnectSolana(w)}
                  disabled={isSolanaConnecting}
                  className="flex items-center gap-3 w-full rounded-xl px-4 py-3 border bg-white/5 hover:bg-white/10 active:scale-[0.98] transition-all text-left group disabled:opacity-50"
                  style={{ borderColor: "rgba(20,241,149,0.2)" }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-white text-base"
                    style={{ background: "rgba(20,241,149,0.15)", border: "1px solid rgba(20,241,149,0.4)" }}
                  >
                    <span style={{ color: "#14F195" }}>{w.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm leading-tight">{w.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {isSolanaConnected && solanaAddress
                        ? `${solanaAddress.slice(0, 6)}…${solanaAddress.slice(-4)}`
                        : "Native Solana"}
                    </div>
                  </div>
                  <span
                    className="flex-shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded border"
                    style={{ color: "#14F195", borderColor: "rgba(20,241,149,0.35)", background: "rgba(20,241,149,0.08)" }}
                  >
                    SOL
                  </span>
                </button>
              ))}
            </>
          )}
        </div>

        <p className="text-center text-[10px] text-muted-foreground/40 font-mono mt-3 px-2">
          {isMobileBrowser()
            ? "Tap a wallet or WalletConnect to open your wallet app."
            : "Installed wallets connect instantly. Others open WalletConnect or the install page."}
        </p>
      </DialogContent>
    </Dialog>
  );
}
