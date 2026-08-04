import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useWallet, detectWallets, detectSolanaWallets, type DetectedWallet, type DetectedSolanaWallet, type WalletId, type SolanaWalletId } from "@/contexts/WalletContext";
import { NetworkMismatchBanner } from "@/components/wallet/NetworkMismatchBanner";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { useCollection, COLLECTION_THEMES, type NftCollection } from "@/contexts/CollectionContext";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ShoppingBag, Package, Gem, ShieldAlert, LogOut, Wallet, Zap, Repeat2, FlaskConical, ChevronDown, Layers, Crown, Loader2, PenLine, Trophy, X, Coins, Menu, ExternalLink, Smartphone } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const BANGERS = { fontFamily: "'Bungee', Impact, sans-serif", letterSpacing: '0.08em' };
const DISPLAY = { fontFamily: "'Bungee Shade', 'Bungee', Impact, sans-serif", letterSpacing: '0.04em' };
const MARKER  = { fontFamily: "'Permanent Marker', cursive", letterSpacing: '0.03em' };

// ─── Wallet metadata ──────────────────────────────────────────────────────────

const WALLET_COLORS: Record<WalletId | SolanaWalletId, string> = {
  metamask: "#E2761B",
  phantom:  "#AB9FF2",
  backpack: "#E33E3F",
  coinbase: "#0052FF",
  okx:      "#000000",
  trust:    "#3375BB",
  rabby:    "#8697FF",
  rainbow:  "#174299",
  brave:    "#FF5500",
  injected: "#6B7280",
  "phantom-sol":  "#AB9FF2",
  solflare:       "#FC9965",
  "backpack-sol": "#E33E3F",
  "solana-injected": "#14F195",
};

const WALLET_ICONS: Partial<Record<WalletId | SolanaWalletId, string>> = {
  metamask: "https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg",
  phantom:  "https://raw.githubusercontent.com/phantom-labs/phantom-brand-assets/main/phantom-icon-purple.svg",
  backpack: "https://raw.githubusercontent.com/coral-xyz/backpack/master/assets/backpack.png",
  coinbase: "https://raw.githubusercontent.com/coinbase/coinbase-wallet-sdk/master/packages/wallet-sdk/src/assets/coinbaseWalletLogo.svg",
  okx:      "https://static.okx.com/cdn/assets/imgs/2211/6BB53EF6A4CF49718CC14EA04EB9E29F.png",
  trust:    "https://trustwallet.com/assets/images/media/assets/TWT.png",
  rabby:    "https://raw.githubusercontent.com/RabbyHub/Rabby/master/src/_raw/images/icon-128.png",
  rainbow:  "https://avatars.githubusercontent.com/u/48327834",
  brave:    "https://brave.com/static-assets/images/brave-logo-sans-text.svg",
  "phantom-sol": "https://raw.githubusercontent.com/phantom-labs/phantom-brand-assets/main/phantom-icon-purple.svg",
  "backpack-sol": "https://raw.githubusercontent.com/coral-xyz/backpack/master/assets/backpack.png",
};

const WALLET_DESC: Partial<Record<WalletId | SolanaWalletId, string>> = {
  metamask: "MetaMask browser extension",
  phantom:  "Phantom — Ethereum provider",
  backpack: "Backpack — Ethereum provider",
  coinbase: "Coinbase Wallet extension",
  okx:      "OKX Wallet — Ethereum provider",
  trust:    "Trust Wallet browser extension",
  rabby:    "Rabby — EVM-focused wallet",
  rainbow:  "Rainbow — Ethereum wallet",
  brave:    "Brave browser built-in wallet",
  injected: "Browser-injected EVM wallet",
  "phantom-sol": "Phantom — native Solana provider",
  solflare: "Solflare — Solana wallet",
  "backpack-sol": "Backpack — native Solana provider",
  "solana-injected": "Browser-injected Solana wallet",
};

function WalletIcon({ id, name }: { id: WalletId | SolanaWalletId; name: string }) {
  const iconUrl = WALLET_ICONS[id];
  const color = WALLET_COLORS[id];
  const initial = name.charAt(0).toUpperCase();

  if (iconUrl) {
    return (
      <div className="w-9 h-9 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center" style={{ background: color + "22", border: `1px solid ${color}44` }}>
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

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { walletAddress, isConnected, connect, connectSolana, disconnect, isConnecting, connectStep } = useWallet();
  const { settings } = useSiteSettings();
  const { collection, collectionLabel, setCollection, theme } = useCollection();
  const { accent, accent2, accentHsl, glow, glow2, gradient, gradient2 } = theme;
  const { toast } = useToast();
  const [walletPickerOpen, setWalletPickerOpen] = useState(false);
  const [detectedWallets, setDetectedWallets] = useState<DetectedWallet[]>([]);
  const [detectedSolanaWallets, setDetectedSolanaWallets] = useState<DetectedSolanaWallet[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { count: cartCount } = useCart();

  const doConnect = async (wallet: DetectedWallet) => {
    setWalletPickerOpen(false);
    try {
      await connect(wallet.provider);
    } catch (err) {
      const code = (err as { code?: number }).code;
      if (code === 4001) return; // user cancelled — silent

      let description = err instanceof Error ? err.message : "Could not connect wallet";
      if (code === -32000 || code === 32000) {
        const hints: Partial<Record<WalletId, string>> = {
          phantom: "Open Phantom → Settings → Developer Settings and enable Ethereum, then retry.",
          backpack: "Open Backpack → Settings and ensure the Ethereum network is enabled, then retry.",
        };
        description =
          `${wallet.name} returned an internal error. ` +
          (hints[wallet.id] ?? "Try disconnecting this site from the wallet and reconnecting.");
      }
      toast({ title: "Connection failed", description, variant: "destructive" });
    }
  };

  const doConnectSolana = async (wallet: DetectedSolanaWallet) => {
    setWalletPickerOpen(false);
    try {
      await connectSolana(wallet);
    } catch (err) {
      const code = (err as { code?: number }).code;
      if (code === 4001) return; // user cancelled — silent
      const description = err instanceof Error ? err.message : "Could not connect wallet";
      toast({ title: "Connection failed", description, variant: "destructive" });
    }
  };

  const handleConnect = () => {
    const evmWallets = detectWallets();
    setDetectedWallets(evmWallets);
    setDetectedSolanaWallets([]);
    setWalletPickerOpen(true);
  };

  const isInIframe = window.self !== window.top;

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const navItems = [
    { href: "/", label: "Store", icon: ShoppingBag },
    { href: "/bundles-points", label: "Packs & We Smackz", icon: Coins },
    { href: "/locker", label: "Trait Locker", icon: Package },
    { href: "/nfts", label: `My ${collectionLabel}`, icon: Gem },
    { href: "/my-legends", label: "Legends & 1/1's", icon: Crown },
    { href: "/bounties", label: "Bounties & We Smackz", icon: Trophy },
    { href: "/swap", label: "Trait Swap", icon: Repeat2 },
    { href: "/sandbox", label: "Sandbox", icon: FlaskConical },
  ];

  const isAdminPage = location === "/admin";

  return (
    <div className="min-h-[100dvh] flex flex-col bg-transparent text-foreground dark">

      {/* ── Iframe wallet warning banner ── */}
      {isInIframe && !isConnected && (
        <div className="relative z-50 flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/30 text-amber-300 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Wallet className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">
              <strong>Wallet extensions don't work inside this preview.</strong>
              {" "}Open the app in its own tab to connect MetaMask, Phantom, or a Solana wallet.
            </span>
          </div>
          <a
            href={window.location.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 flex items-center gap-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-md px-3 py-1 transition-colors font-semibold whitespace-nowrap"
          >
            Open in new tab ↗
          </a>
        </div>
      )}

      {/* ── Network mismatch banner (wrong EVM chain) ── */}
      <NetworkMismatchBanner />

      {/* ── Background Image Layer ── */}
      {settings.backgroundUrl && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            zIndex: -1,
            backgroundImage: `url(${settings.backgroundUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed',
            filter: 'brightness(1.2) saturate(1.05) contrast(0.95)',
            opacity: 0.5,
          }}
        />
      )}

      {/* ── Ambient Background Layer ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        {/* Heavy spray cloud — top left */}
        <div
          className="orb-drift"
          style={{
            position: 'absolute', top: '-15%', left: '-8%',
            width: 800, height: 600,
            borderRadius: '60% 40% 55% 45% / 50% 60% 40% 50%',
            background: `radial-gradient(ellipse at center, hsl(${accentHsl} / 0.22) 0%, hsl(${accentHsl} / 0.1) 50%, transparent 78%)`,
            filter: 'blur(55px)',
            animationDuration: '20s',
          }}
        />
        {/* Gold spray burst — top right */}
        <div
          className="orb-breathe"
          style={{
            position: 'absolute', top: '0%', right: '-10%',
            width: 520, height: 480,
            borderRadius: '40% 60% 45% 55% / 55% 45% 65% 35%',
            background: 'radial-gradient(ellipse at center, hsl(43 100% 52% / 0.14) 0%, hsl(38 100% 40% / 0.06) 55%, transparent 75%)',
            filter: 'blur(50px)',
            animationDuration: '8s',
            animationDelay: '1.5s',
          }}
        />
        {/* Deep drip cloud — bottom right */}
        <div
          className="orb-drift"
          style={{
            position: 'absolute', bottom: '5%', right: '2%',
            width: 600, height: 500,
            borderRadius: '50% 50% 60% 40% / 40% 60% 50% 50%',
            background: `radial-gradient(ellipse at center, hsl(${accentHsl} / 0.16) 0%, hsl(${accentHsl} / 0.07) 55%, transparent 72%)`,
            filter: 'blur(48px)',
            animationDuration: '25s',
            animationDelay: '4s',
          }}
        />
        {/* Gold warm drip — bottom left */}
        <div
          className="orb-breathe"
          style={{
            position: 'absolute', bottom: '0%', left: '0%',
            width: 480, height: 380,
            borderRadius: '55% 45% 50% 50% / 60% 40% 55% 45%',
            background: 'radial-gradient(ellipse at center, hsl(43 100% 48% / 0.13) 0%, hsl(38 100% 36% / 0.05) 60%, transparent 75%)',
            filter: 'blur(44px)',
            animationDuration: '11s',
            animationDelay: '3s',
          }}
        />
        {/* Volumetric smoke centre */}
        <div
          className="orb-drift"
          style={{
            position: 'absolute', top: '40%', left: '40%',
            width: 350, height: 280,
            borderRadius: '50%',
            background: `radial-gradient(ellipse at center, hsl(${accentHsl} / 0.08) 0%, transparent 70%)`,
            filter: 'blur(35px)',
            animationDuration: '17s',
            animationDelay: '2s',
          }}
        />

        {/* Floating particles — small glowing dots */}
        {[
          { left: '12%',  bottom: '20%', size: 3, color: `hsl(${accentHsl})`,         dur: '9s',  delay: '0s',   drift: '15px'  },
          { left: '28%',  bottom: '35%', size: 2, color: 'hsl(43 100% 56%)',           dur: '12s', delay: '1.5s', drift: '-10px' },
          { left: '45%',  bottom: '15%', size: 2, color: `hsl(${accentHsl})`,         dur: '8s',  delay: '3s',   drift: '20px'  },
          { left: '63%',  bottom: '40%', size: 3, color: 'hsl(43 100% 60%)',           dur: '11s', delay: '0.8s', drift: '-18px' },
          { left: '78%',  bottom: '25%', size: 2, color: `hsl(${accentHsl})`,         dur: '14s', delay: '4s',   drift: '12px'  },
          { left: '88%',  bottom: '55%', size: 2, color: 'hsl(43 100% 56%)',           dur: '10s', delay: '2s',   drift: '-8px'  },
          { left: '20%',  bottom: '60%', size: 2, color: `hsl(${accentHsl})`,         dur: '13s', delay: '5s',   drift: '16px'  },
          { left: '55%',  bottom: '70%', size: 3, color: 'hsl(43 100% 65%)',           dur: '7s',  delay: '1s',   drift: '-14px' },
          { left: '38%',  bottom: '80%', size: 2, color: `hsl(${accentHsl})`,         dur: '16s', delay: '6s',   drift: '10px'  },
          { left: '72%',  bottom: '75%', size: 2, color: 'hsl(43 100% 56%)',           dur: '9s',  delay: '3.5s', drift: '-20px' },
          { left: '5%',   bottom: '50%', size: 2, color: `hsl(${accentHsl})`,         dur: '11s', delay: '2.5s', drift: '18px'  },
          { left: '93%',  bottom: '30%', size: 2, color: 'hsl(43 100% 60%)',           dur: '13s', delay: '7s',   drift: '-12px' },
        ].map((p, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: p.left,
              bottom: p.bottom,
              width: p.size,
              height: p.size,
              background: p.color,
              boxShadow: `0 0 ${p.size * 3}px ${p.color}, 0 0 ${p.size * 6}px ${p.color}`,
              '--dur': p.dur,
              '--delay': p.delay,
              '--drift': p.drift,
            } as React.CSSProperties}
          />
        ))}

        {/* Twinkling stationary sparks */}
        {[
          { left: '8%',  top: '25%', size: 2, color: 'hsl(43 100% 70%)',          dur: '3.2s', delay: '0s'   },
          { left: '32%', top: '12%', size: 1, color: `hsl(${accentHsl})`,         dur: '4.5s', delay: '1.2s' },
          { left: '58%', top: '8%',  size: 2, color: 'hsl(43 100% 65%)',          dur: '2.8s', delay: '2.1s' },
          { left: '75%', top: '18%', size: 1, color: `hsl(${accentHsl})`,         dur: '5s',   delay: '0.7s' },
          { left: '90%', top: '42%', size: 2, color: 'hsl(43 100% 70%)',          dur: '3.8s', delay: '3s'   },
          { left: '15%', top: '68%', size: 1, color: `hsl(${accentHsl})`,         dur: '4.2s', delay: '1.8s' },
          { left: '50%', top: '55%', size: 2, color: 'hsl(43 100% 60%)',          dur: '3s',   delay: '0.5s' },
          { left: '82%', top: '72%', size: 1, color: `hsl(${accentHsl})`,         dur: '6s',   delay: '4s'   },
        ].map((s, i) => (
          <div
            key={i}
            className="particle-twinkle"
            style={{
              left: s.left, top: s.top,
              width: s.size, height: s.size,
              background: s.color,
              boxShadow: `0 0 ${s.size * 4}px ${s.color}`,
              '--dur': s.dur,
              '--delay': s.delay,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-50 w-full border-b border-accent/20 backdrop-blur-2xl"
        style={{
          background: 'linear-gradient(180deg, hsl(270 45% 3% / 0.97) 0%, hsl(270 42% 2% / 0.93) 100%)',
          boxShadow: `0 4px 40px hsl(${accentHsl} / 0.14), 0 1px 0 hsl(43 100% 52% / 0.2), 0 0 80px hsl(270 45% 2% / 0.85)`,
        }}
      >
        {/* Top neon filigree bar — gold-to-accent-to-gold */}
        <div
          className="h-[2px] w-full"
          style={{
            background: `linear-gradient(90deg, transparent 0%, hsl(43 100% 52%) 15%, hsl(${accentHsl}) 50%, hsl(43 100% 52%) 85%, transparent 100%)`,
            boxShadow: `0 0 14px hsl(43 100% 52% / 0.9), 0 0 35px hsl(${accentHsl} / 0.5), 0 2px 28px hsl(43 100% 40% / 0.35)`,
          }}
        />

        <div className="w-full px-3 sm:px-5 h-[64px] sm:h-[82px] flex items-center gap-2 sm:gap-4">
          {/* ── Logo (fixed left) ── */}
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-85 group flex-shrink-0">
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt="Site Logo"
                className="w-10 h-10 object-contain"
              />
            ) : (
              <div className="relative w-10 h-10 flex items-center justify-center flex-shrink-0">
                <div
                  className="absolute inset-0"
                  style={{
                    background: `radial-gradient(ellipse at center, hsl(${accentHsl} / 0.35) 0%, transparent 75%)`,
                    filter: 'blur(4px)',
                    transform: 'scale(1.6)',
                  }}
                />
                <div
                  className="absolute inset-0 bg-primary group-hover:rotate-6 transition-transform"
                  style={{ boxShadow: `0 0 16px hsl(${accentHsl} / 0.8), inset 0 0 8px rgba(255,255,255,0.1)` }}
                />
                <Zap className="relative z-10 w-5 h-5 text-white" />
              </div>
            )}
            <span
              className="hidden sm:inline-block leading-none select-none"
              style={{
                ...BANGERS,
                fontSize: 'clamp(2rem, 2.9vw, 2.6rem)',
                color: accent,
                textShadow: [
                  `0 0 8px ${accent}`,
                  `0 0 18px hsl(${accentHsl} / 0.7)`,
                  '2px 2px 0px #000',
                  '4px 4px 0px rgba(0,0,0,0.6)',
                ].join(', '),
              }}
            >
              TRAIT<span style={{
                color: '#c8920a',
                textShadow: [
                  '0 0 8px #c8920a',
                  '0 0 18px #8a5c00',
                  '2px 2px 0px #000',
                  '4px 4px 0px rgba(0,0,0,0.6)',
                ].join(', '),
              }}>STORE</span>
            </span>
          </Link>

          {/* ── Collection Switcher dropdown ── */}
          {!isAdminPage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md flex-shrink-0 transition-all group"
                  style={{
                    background: gradient2,
                    border: `1px solid ${accent}66`,
                    boxShadow: `0 0 10px ${glow2}`,
                  }}
                >
                  <Layers className="w-3 h-3 flex-shrink-0" style={{ color: accent }} />
                  <span style={{ ...BANGERS, fontSize: '0.78rem', color: accent }}>
                    {collectionLabel}
                  </span>
                  <ChevronDown className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52 bg-card border-border">
                <DropdownMenuLabel style={BANGERS} className="text-xs text-muted-foreground tracking-widest">COLLECTION</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(["wegens", "wegenettes"] as NftCollection[]).map((c) => (
                  <DropdownMenuItem
                    key={c}
                    onClick={() => setCollection(c)}
                    className={`cursor-pointer gap-2 ${collection === c ? 'text-primary' : ''}`}
                    style={BANGERS}
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background: c === collection
                          ? COLLECTION_THEMES[c].accent
                          : 'transparent',
                        border: `1px solid ${COLLECTION_THEMES[c].accent}`,
                      }}
                    />
                    {c === "wegens" ? "Wegens" : "Wegenettes"}
                    {collection === c && <span className="ml-auto text-[9px] font-mono text-muted-foreground">ACTIVE</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* ── Nav (flexible middle) ── */}
          {!isAdminPage && (
            <nav className="hidden md:flex items-center justify-evenly flex-1 min-w-0">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href;
                const isStore = item.href === "/";
                const showBadge = isStore && cartCount > 0;
                const navHref = showBadge ? "/?cart=open" : item.href;
                return (
                  <Link
                    key={item.href}
                    href={navHref}
                    className={`relative flex flex-col items-center gap-0.5 px-2 py-2 transition-all group flex-1 min-w-0 ${
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="relative flex-shrink-0">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : ''}`} />
                      {showBadge && (
                        <span
                          className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] flex items-center justify-center rounded-full text-white font-bold leading-none px-0.5"
                          style={{
                            fontSize: '9px',
                            background: `hsl(${accentHsl})`,
                            boxShadow: `0 0 6px hsl(${accentHsl} / 0.8)`,
                          }}
                        >
                          {cartCount > 99 ? "99+" : cartCount}
                        </span>
                      )}
                    </span>
                    <span className="text-center leading-tight line-clamp-2 w-full" style={{ ...BANGERS, fontSize: 'clamp(0.6rem, 0.75vw, 0.75rem)', letterSpacing: '0.06em' }}>
                      {item.label}
                    </span>

                    {/* Paint-drip active indicator */}
                    {isActive ? (
                      <span
                        className="absolute bottom-0 left-1 right-1"
                        style={{
                          height: '3px',
                          background: `linear-gradient(90deg, transparent, hsl(${accentHsl}), transparent)`,
                          boxShadow: `0 0 8px hsl(${accentHsl} / 0.9), 0 2px 12px hsl(${accentHsl} / 0.5)`,
                          filter: 'blur(0.3px)',
                        }}
                      />
                    ) : (
                      <span
                        className="absolute bottom-0 left-1 right-1 opacity-0 group-hover:opacity-40 transition-opacity"
                        style={{
                          height: '2px',
                          background: `linear-gradient(90deg, transparent, hsl(${accentHsl}), transparent)`,
                        }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>
          )}
          {isAdminPage && <div className="flex-1" />}

          {/* ── Right side (fixed right) ── */}
          <div className="flex items-center gap-2 flex-shrink-0">

            <Link
              href="/admin"
              className="hidden sm:inline-flex text-muted-foreground/60 hover:text-primary transition-colors p-1"
              title="Admin"
            >
              <ShieldAlert className="w-4 h-4" />
            </Link>

            {/* ── Mobile menu trigger ── */}
            {!isAdminPage && (
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <button
                    className="md:hidden flex items-center justify-center w-9 h-9 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 transition-colors flex-shrink-0"
                    aria-label="Open menu"
                  >
                    <Menu className="w-5 h-5" style={{ color: accent }} />
                  </button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="w-[85vw] max-w-sm border-l border-white/10 bg-black/95 backdrop-blur-xl p-0 flex flex-col"
                >
                  <div className="flex items-center justify-between px-4 h-16 border-b border-white/10 flex-shrink-0">
                    <span style={{ ...BANGERS, fontSize: '1.1rem', color: accent }}>MENU</span>
                  </div>

                  {/* Collection switcher */}
                  <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2 flex-shrink-0">
                    {(["wegens", "wegenettes"] as NftCollection[]).map((c) => (
                      <button
                        key={c}
                        onClick={() => setCollection(c)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs flex-1"
                        style={{
                          ...BANGERS,
                          fontSize: '0.7rem',
                          background: collection === c ? gradient2 : 'transparent',
                          border: `1px solid ${collection === c ? accent : '#ffffff22'}`,
                          color: collection === c ? accent : undefined,
                        }}
                      >
                        <Layers className="w-3 h-3 flex-shrink-0" />
                        {c === "wegens" ? "Wegens" : "Wegenettes"}
                      </button>
                    ))}
                  </div>

                  <nav className="flex-1 overflow-y-auto py-2">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = location === item.href;
                      const isStore = item.href === "/";
                      const showBadge = isStore && cartCount > 0;
                      const mobileHref = showBadge ? "/?cart=open" : item.href;
                      return (
                        <Link
                          key={item.href}
                          href={mobileHref}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                            isActive ? "text-primary bg-white/5" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                          }`}
                        >
                          <span className="relative flex-shrink-0">
                            <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : ''}`} />
                            {showBadge && (
                              <span
                                className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] flex items-center justify-center rounded-full text-white font-bold leading-none px-0.5"
                                style={{
                                  fontSize: '9px',
                                  background: `hsl(${accentHsl})`,
                                  boxShadow: `0 0 6px hsl(${accentHsl} / 0.8)`,
                                }}
                              >
                                {cartCount > 99 ? "99+" : cartCount}
                              </span>
                            )}
                          </span>
                          <span style={{ ...BANGERS, fontSize: '0.8rem', letterSpacing: '0.05em' }}>
                            {item.label}
                            {showBadge && (
                              <span
                                className="ml-2 inline-flex items-center justify-center rounded-full text-white font-bold px-1.5 py-0.5"
                                style={{
                                  fontSize: '9px',
                                  background: `hsl(${accentHsl})`,
                                  boxShadow: `0 0 6px hsl(${accentHsl} / 0.8)`,
                                }}
                              >
                                {cartCount > 99 ? "99+" : cartCount}
                              </span>
                            )}
                          </span>
                        </Link>
                      );
                    })}
                    <Link
                      href="/admin"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-muted-foreground/60 hover:text-primary hover:bg-white/5 transition-colors"
                    >
                      <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                      <span style={{ ...BANGERS, fontSize: '0.8rem', letterSpacing: '0.05em' }}>Admin</span>
                    </Link>
                  </nav>
                </SheetContent>
              </Sheet>
            )}

            {isConnected && walletAddress ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-primary/50 hover:bg-primary/10 hover:border-primary text-xs transition-all"
                    style={{ ...MARKER, fontSize: '0.7rem' }}
                  >
                    <Wallet className="w-3.5 h-3.5 mr-2 text-primary" />
                    {truncateAddress(walletAddress)}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 bg-card border-border">
                  <DropdownMenuLabel style={BANGERS} className="text-primary">CONNECTED WALLET</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer text-muted-foreground font-mono text-[10px] break-all">
                    {walletAddress}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={disconnect} className="cursor-pointer text-destructive focus:text-destructive" style={BANGERS}>
                    <LogOut className="w-4 h-4 mr-2" />
                    DISCONNECT
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={handleConnect}
                disabled={isConnecting}
                className="relative text-white font-bold uppercase tracking-widest transition-all neon-pulse overflow-hidden px-3 py-1.5 h-auto text-xs"
                style={{
                  ...BANGERS,
                  fontSize: '0.75rem',
                  background: gradient,
                  border: `2px solid hsl(${accentHsl} / 0.6)`,
                  boxShadow: `2px 2px 0px rgba(0,0,0,0.9), 0 0 14px hsl(${accentHsl} / 0.4)`,
                }}
              >
                <span
                  className="absolute inset-0 opacity-20"
                  style={{
                    background: 'linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)',
                    backgroundSize: '200% 200%',
                  }}
                />
                {connectStep === "signing" ? (
                  <PenLine className="relative z-10 w-3 h-3 mr-1.5 animate-pulse" />
                ) : connectStep === "requesting" ? (
                  <Loader2 className="relative z-10 w-3 h-3 mr-1.5 animate-spin" />
                ) : (
                  <Wallet className="relative z-10 w-3 h-3 mr-1.5" />
                )}
                <span className="relative z-10">
                  {connectStep === "signing" ? "Sign in wallet…" : connectStep === "requesting" ? "Connecting…" : "Connect Wallet"}
                </span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ── Banner ── */}
      {settings.bannerUrl && !isAdminPage && (
        <div className="w-full overflow-hidden relative" style={{ aspectRatio: '3/1', maxHeight: 500, zIndex: 1 }}>
          <img
            src={settings.bannerUrl}
            alt="Site Banner"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 scanlines opacity-20 pointer-events-none" />
          <div
            className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, transparent, hsl(268 40% 3%))' }}
          />
          {/* Gold filigree bar at bottom of banner */}
          <div
            className="absolute bottom-0 left-0 right-0 h-[1px] pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, hsl(43 100% 56% / 0.6) 30%, hsl(43 100% 70% / 0.9) 50%, hsl(43 100% 56% / 0.6) 70%, transparent 100%)',
              boxShadow: '0 0 12px hsl(43 100% 56% / 0.4)',
            }}
          />
        </div>
      )}

      {/* ── Main ── */}
      <main className="flex-1 container mx-auto px-3 py-5 sm:px-4 sm:py-8" style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </main>

      {/* ── Footer ── */}
      <footer
        className="relative py-12 overflow-hidden"
        style={{
          zIndex: 1,
          background: 'linear-gradient(180deg, transparent 0%, hsl(268 40% 2% / 0.95) 30%, hsl(268 45% 2%) 100%)',
        }}
      >
        {/* Gold filigree top border */}
        <div
          className="absolute top-0 left-0 right-0 pointer-events-none"
          style={{ height: 1,
            background: 'linear-gradient(90deg, transparent 0%, hsl(43 100% 56% / 0.4) 15%, hsl(43 100% 70% / 0.85) 50%, hsl(43 100% 56% / 0.4) 85%, transparent 100%)',
            boxShadow: '0 0 20px hsl(43 100% 56% / 0.5), 0 0 60px hsl(43 100% 40% / 0.2)',
          }}
        />
        {/* Diamond filigree row */}
        <div
          className="absolute top-0 left-0 right-0 h-8 pointer-events-none overflow-hidden opacity-30"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, hsl(43 100% 56% / 0.4) 0px, transparent 1px, transparent 18px, hsl(43 100% 56% / 0.4) 19px), repeating-linear-gradient(-45deg, hsl(43 100% 56% / 0.4) 0px, transparent 1px, transparent 18px, hsl(43 100% 56% / 0.4) 19px)',
            backgroundSize: '26px 26px',
            maskImage: 'linear-gradient(180deg, hsl(268 40% 2%) 0%, transparent 100%)',
          }}
        />

        {/* Ambient gold orb behind footer */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 800px 200px at 50% 100%, hsl(43 100% 40% / 0.07) 0%, transparent 70%)',
          }}
        />

        <div className="container mx-auto px-4 relative z-10 flex flex-col items-center gap-5">
          {/* Big graffiti tag */}
          <div className="text-center">
            <span
              className="block text-6xl sm:text-8xl"
              style={{
                ...DISPLAY,
                color: 'hsl(43 100% 56%)',
                textShadow:
                  '5px 5px 0px hsl(268 40% 2%), -2px -2px 0px hsl(268 40% 2%), ' +
                  '8px 8px 0px rgba(0,0,0,0.8), 0 0 50px hsl(43 100% 56% / 0.7), 0 0 120px hsl(43 100% 40% / 0.4)',
                WebkitTextStroke: '1.5px rgba(0,0,0,0.9)',
                paintOrder: 'stroke fill',
              }}
            >
              WEGEN
              <span style={{
                color: accent,
                textShadow:
                  `5px 5px 0px hsl(268 40% 2%), -2px -2px 0px hsl(268 40% 2%), ` +
                  `8px 8px 0px rgba(0,0,0,0.8), 0 0 50px hsl(${accentHsl} / 0.8), 0 0 120px hsl(${accentHsl} / 0.4)`,
              }}> NFT</span>
            </span>
          </div>

          {/* Gold filigree divider */}
          <div className="flex items-center gap-3 w-full max-w-sm">
            <div
              className="flex-1 h-px"
              style={{ background: 'linear-gradient(to right, transparent, hsl(43 100% 56% / 0.6))' }}
            />
            <div
              className="w-2 h-2 rotate-45 flex-shrink-0"
              style={{ background: 'hsl(43 100% 56%)', boxShadow: '0 0 8px hsl(43 100% 56%)' }}
            />
            <span
              className="text-muted-foreground/40 text-xs flex-shrink-0"
              style={MARKER}
            >
              © {new Date().getFullYear()} all rights reserved
            </span>
            <div
              className="w-2 h-2 rotate-45 flex-shrink-0"
              style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
            />
            <div
              className="flex-1 h-px"
              style={{ background: `linear-gradient(to left, transparent, hsl(${accentHsl} / 0.6))` }}
            />
          </div>
        </div>
      </footer>

      {/* ── Wallet Picker Dialog ── */}
      <Dialog open={walletPickerOpen} onOpenChange={setWalletPickerOpen}>
        <DialogContent className="sm:max-w-[390px] p-0 gap-0 border border-white/10 bg-black/92 backdrop-blur-2xl overflow-hidden">

          {/* Header + anti-phishing strip */}
          <div className="px-5 pt-5 pb-4 border-b border-white/8">
            <DialogHeader>
              <DialogTitle className="text-center text-xl mb-3" style={BANGERS}>
                Connect Wallet
              </DialogTitle>
            </DialogHeader>
            {/* Anti-phishing domain verification */}
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg"
              style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.18)' }}>
              <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#4ade80' }} />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-mono uppercase tracking-wider font-bold" style={{ color: '#4ade80' }}>
                  Sign-In With Ethereum · EIP-4361
                </div>
                <div className="text-[10px] font-mono mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {window.location.hostname}
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 py-4 flex flex-col gap-4 max-h-[65vh] overflow-y-auto">

            {/* ── Detected EVM wallets ── */}
            {detectedWallets.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Detected wallets
                </div>
                {detectedWallets.map((w) => (
                  <button
                    key={`evm-${w.id}`}
                    onClick={() => void doConnect(w)}
                    className="flex items-center gap-3 w-full rounded-xl px-4 py-3 border border-white/10 bg-white/5 hover:bg-white/10 active:scale-[0.98] transition-all text-left"
                  >
                    <WalletIcon id={w.id} name={w.name} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm leading-tight">{w.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{WALLET_DESC[w.id] ?? "EVM browser wallet"}</div>
                    </div>
                    <span className="flex-shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded border"
                      style={{ color: "#60a5fa", borderColor: "#60a5fa44", background: "#60a5fa11" }}>
                      EVM
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              /* No wallet detected — show install options */
              <div className="flex flex-col gap-1.5">
                <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Install a wallet
                </div>
                <p className="text-xs text-muted-foreground/70 mb-2">
                  No EVM wallet detected. Install one of these or open this app inside your mobile wallet's browser.
                </p>
                {([
                  { id: "metamask" as WalletId, name: "MetaMask",      desc: "Most popular — desktop & mobile", url: "https://metamask.io/download" },
                  { id: "rabby"    as WalletId, name: "Rabby",          desc: "Best for DeFi & NFTs",            url: "https://rabby.io" },
                  { id: "coinbase" as WalletId, name: "Coinbase Wallet",desc: "Easy setup, mobile-first",        url: "https://www.coinbase.com/wallet/downloads" },
                  { id: "rainbow"  as WalletId, name: "Rainbow",        desc: "Beautiful mobile wallet",         url: "https://rainbow.me/download" },
                ] as const).map((w) => (
                  <a key={w.id} href={w.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 w-full rounded-xl px-4 py-3 border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-left">
                    <WalletIcon id={w.id} name={w.name} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm leading-tight">{w.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{w.desc}</div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground/40" />
                  </a>
                ))}
              </div>
            )}

            {/* ── Mobile deep-link section ── */}
            <div className="border-t border-white/8 pt-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Smartphone className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.3)' }} />
                <div className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Open in mobile wallet
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(() => {
                  const appUrl = encodeURIComponent(window.location.href);
                  const host   = window.location.hostname + window.location.pathname;
                  return ([
                    { id: "metamask" as WalletId, name: "MetaMask", url: `https://metamask.app.link/dapp/${host}` },
                    { id: "trust"    as WalletId, name: "Trust",    url: `https://link.trustwallet.com/open_url?coin_id=60&url=${appUrl}` },
                    { id: "coinbase" as WalletId, name: "Coinbase", url: `https://go.cb-wallet.com/dapp?url=${appUrl}` },
                    { id: "rainbow"  as WalletId, name: "Rainbow",  url: `https://rnbwapp.com/wc?uri=${appUrl}` },
                  ] as const).map((w) => (
                    <a key={w.id} href={w.url} target="_blank" rel="noopener noreferrer"
                      className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-white/8 hover:bg-white/5 transition-all text-center">
                      <WalletIcon id={w.id} name={w.name} />
                      <span className="text-[9px] font-mono leading-tight" style={{ color: 'rgba(255,255,255,0.35)' }}>{w.name}</span>
                    </a>
                  ));
                })()}
              </div>
            </div>

            {/* Security footer */}
            <p className="text-center text-[10px] font-mono px-2 pb-1" style={{ color: 'rgba(255,255,255,0.22)' }}>
              You will only sign a message — no transaction is sent
              <br />Always verify the domain before signing
            </p>

          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
