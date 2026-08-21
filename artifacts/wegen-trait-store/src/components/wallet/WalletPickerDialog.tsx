import { useState, useEffect } from "react";
import type { Eip1193Provider } from "ethers";
import {
  useWallet,
  getEvmWalletOptions,
  WALLET_COLORS,
  WALLET_ICONS,
  type WalletId,
} from "@/contexts/WalletContext";
import { isMobileBrowser, requestEip6963Providers } from "@/wallet/evm-wallets";
import type { EvmWalletOption } from "@/wallet/types";
import { formatWalletError, isUserRejection } from "@/wallet/wallet-errors";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert } from "lucide-react";

const BANGERS = { fontFamily: "'Bungee', Impact, sans-serif", letterSpacing: "0.08em" };

const WALLET_DESC: Partial<Record<WalletId, string>> = {
  metamask: "MetaMask browser extension & mobile app",
  phantom: "Phantom — Ethereum provider",
  backpack: "Backpack — Ethereum",
  coinbase: "Coinbase Wallet extension",
  okx: "OKX Wallet — Ethereum",
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
    connectWallet,
    connectWalletConnect,
    isWalletConnectAvailable,
  } = useWallet();
  const { toast } = useToast();
  const [evmWalletOptions, setEvmWalletOptions] = useState<EvmWalletOption[]>(() =>
    getEvmWalletOptions(),
  );

  useEffect(() => {
    if (walletPickerOpen) {
      void requestEip6963Providers().then(() => {
        setEvmWalletOptions(getEvmWalletOptions());
      });
    }
  }, [walletPickerOpen]);

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

  return (
    <Dialog open={walletPickerOpen} onOpenChange={setWalletPickerOpen}>
      <DialogContent className="sm:max-w-[390px] p-0 gap-0 border border-white/10 bg-black/92 backdrop-blur-2xl overflow-hidden">
        <div className="px-5 pt-5 pb-4 border-b border-white/8">
          <DialogHeader>
            <DialogTitle className="text-center text-xl mb-3" style={BANGERS}>
              Connect Wallet
            </DialogTitle>
          </DialogHeader>
          <div
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg"
            style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.18)" }}
          >
            <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#4ade80" }} />
            <div className="min-w-0 flex-1">
              <div
                className="text-[10px] font-mono uppercase tracking-wider font-bold"
                style={{ color: "#4ade80" }}
              >
                Sign-In With Ethereum · EIP-4361
              </div>
              <div
                className="text-[10px] font-mono mt-0.5 truncate"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                {typeof window !== "undefined" ? window.location.hostname : ""}
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 flex flex-col gap-2 max-h-[65vh] overflow-y-auto">
          <p className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest px-1">
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

          <p
            className="text-center text-[10px] font-mono px-2 pt-2 pb-1"
            style={{ color: "rgba(255,255,255,0.22)" }}
          >
            {isMobileBrowser()
              ? "Tap a wallet or WalletConnect to open your wallet app."
              : "Installed wallets connect instantly. Others open WalletConnect or the install page."}
            <br />
            You will only sign a message — no transaction is sent
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
