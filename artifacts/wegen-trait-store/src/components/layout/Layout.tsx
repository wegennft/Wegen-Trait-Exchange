import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useWallet } from "@/contexts/WalletContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { useCollection, type NftCollection } from "@/contexts/CollectionContext";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Package, Gem, ShieldAlert, LogOut, Wallet, Zap, Repeat2, FlaskConical, ChevronDown, Layers } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const BANGERS = { fontFamily: "'Bungee', Impact, sans-serif", letterSpacing: '0.08em' };
const DISPLAY = { fontFamily: "'Bungee Shade', 'Bungee', Impact, sans-serif", letterSpacing: '0.04em' };
const MARKER  = { fontFamily: "'Permanent Marker', cursive", letterSpacing: '0.03em' };

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { walletAddress, isConnected, connect, disconnect, isConnecting } = useWallet();
  const { settings } = useSiteSettings();
  const { collection, collectionLabel, setCollection } = useCollection();

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const navItems = [
    { href: "/", label: "Store", icon: ShoppingBag },
    { href: "/locker", label: "Locker", icon: Package },
    { href: "/nfts", label: "My Wegens", icon: Gem },
    { href: "/swap", label: "Trait Swap", icon: Repeat2 },
    { href: "/sandbox", label: "Sandbox", icon: FlaskConical },
  ];

  const isAdminPage = location === "/admin";

  return (
    <div className="min-h-[100dvh] flex flex-col bg-transparent text-foreground dark">

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
        {/* Heavy purple spray cloud — top left */}
        <div
          className="orb-drift"
          style={{
            position: 'absolute', top: '-15%', left: '-8%',
            width: 800, height: 600,
            borderRadius: '60% 40% 55% 45% / 50% 60% 40% 50%',
            background: 'radial-gradient(ellipse at center, hsl(272 100% 50% / 0.22) 0%, hsl(272 100% 35% / 0.1) 50%, transparent 78%)',
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
        {/* Deep purple drip cloud — bottom right */}
        <div
          className="orb-drift"
          style={{
            position: 'absolute', bottom: '5%', right: '2%',
            width: 600, height: 500,
            borderRadius: '50% 50% 60% 40% / 40% 60% 50% 50%',
            background: 'radial-gradient(ellipse at center, hsl(272 100% 40% / 0.16) 0%, hsl(285 80% 30% / 0.07) 55%, transparent 72%)',
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
            background: 'radial-gradient(ellipse at center, hsl(272 80% 45% / 0.08) 0%, transparent 70%)',
            filter: 'blur(35px)',
            animationDuration: '17s',
            animationDelay: '2s',
          }}
        />

        {/* Floating particles — small glowing dots */}
        {[
          { left: '12%',  bottom: '20%', size: 3, color: 'hsl(272 100% 65%)', dur: '9s',  delay: '0s',   drift: '15px'  },
          { left: '28%',  bottom: '35%', size: 2, color: 'hsl(43 100% 56%)',  dur: '12s', delay: '1.5s', drift: '-10px' },
          { left: '45%',  bottom: '15%', size: 2, color: 'hsl(272 100% 70%)', dur: '8s',  delay: '3s',   drift: '20px'  },
          { left: '63%',  bottom: '40%', size: 3, color: 'hsl(43 100% 60%)',  dur: '11s', delay: '0.8s', drift: '-18px' },
          { left: '78%',  bottom: '25%', size: 2, color: 'hsl(272 100% 65%)', dur: '14s', delay: '4s',   drift: '12px'  },
          { left: '88%',  bottom: '55%', size: 2, color: 'hsl(43 100% 56%)',  dur: '10s', delay: '2s',   drift: '-8px'  },
          { left: '20%',  bottom: '60%', size: 2, color: 'hsl(272 100% 75%)', dur: '13s', delay: '5s',   drift: '16px'  },
          { left: '55%',  bottom: '70%', size: 3, color: 'hsl(43 100% 65%)',  dur: '7s',  delay: '1s',   drift: '-14px' },
          { left: '38%',  bottom: '80%', size: 2, color: 'hsl(272 100% 65%)', dur: '16s', delay: '6s',   drift: '10px'  },
          { left: '72%',  bottom: '75%', size: 2, color: 'hsl(43 100% 56%)',  dur: '9s',  delay: '3.5s', drift: '-20px' },
          { left: '5%',   bottom: '50%', size: 2, color: 'hsl(272 100% 70%)', dur: '11s', delay: '2.5s', drift: '18px'  },
          { left: '93%',  bottom: '30%', size: 2, color: 'hsl(43 100% 60%)',  dur: '13s', delay: '7s',   drift: '-12px' },
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
          { left: '8%',  top: '25%', size: 2, color: 'hsl(43 100% 70%)',  dur: '3.2s', delay: '0s'   },
          { left: '32%', top: '12%', size: 1, color: 'hsl(272 100% 80%)', dur: '4.5s', delay: '1.2s' },
          { left: '58%', top: '8%',  size: 2, color: 'hsl(43 100% 65%)',  dur: '2.8s', delay: '2.1s' },
          { left: '75%', top: '18%', size: 1, color: 'hsl(272 100% 75%)', dur: '5s',   delay: '0.7s' },
          { left: '90%', top: '42%', size: 2, color: 'hsl(43 100% 70%)',  dur: '3.8s', delay: '3s'   },
          { left: '15%', top: '68%', size: 1, color: 'hsl(272 100% 80%)', dur: '4.2s', delay: '1.8s' },
          { left: '50%', top: '55%', size: 2, color: 'hsl(43 100% 60%)',  dur: '3s',   delay: '0.5s' },
          { left: '82%', top: '72%', size: 1, color: 'hsl(272 100% 75%)', dur: '6s',   delay: '4s'   },
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
          boxShadow: '0 4px 40px hsl(272 100% 50% / 0.14), 0 1px 0 hsl(43 100% 52% / 0.2), 0 0 80px hsl(270 45% 2% / 0.85)',
        }}
      >
        {/* Top neon filigree bar — gold-to-purple-to-gold */}
        <div
          className="h-[2px] w-full"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, hsl(43 100% 52%) 15%, hsl(272 100% 60%) 50%, hsl(43 100% 52%) 85%, transparent 100%)',
            boxShadow: '0 0 14px hsl(43 100% 52% / 0.9), 0 0 35px hsl(272 100% 60% / 0.5), 0 2px 28px hsl(43 100% 40% / 0.35)',
          }}
        />

        <div className="w-full px-5 h-[70px] flex items-center gap-4">
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
                    background: 'radial-gradient(ellipse at center, hsl(272 100% 62% / 0.35) 0%, transparent 75%)',
                    filter: 'blur(4px)',
                    transform: 'scale(1.6)',
                  }}
                />
                <div
                  className="absolute inset-0 bg-primary group-hover:rotate-6 transition-transform"
                  style={{ boxShadow: '0 0 16px hsl(272 100% 62% / 0.8), inset 0 0 8px rgba(255,255,255,0.1)' }}
                />
                <Zap className="relative z-10 w-5 h-5 text-white" />
              </div>
            )}
            <span
              className="hidden sm:inline-block leading-none select-none"
              style={{
                ...BANGERS,
                fontSize: 'clamp(2rem, 2.9vw, 2.6rem)',
                color: '#9900ff',
                textShadow: [
                  '0 0 8px #9900ff',
                  '0 0 18px #6600cc',
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
                    background: collection === "wegenettes"
                      ? 'linear-gradient(135deg, hsl(320 100% 40% / 0.18), hsl(272 100% 50% / 0.12))'
                      : 'linear-gradient(135deg, hsl(272 100% 50% / 0.15), hsl(43 100% 52% / 0.08))',
                    border: collection === "wegenettes"
                      ? '1px solid hsl(320 100% 55% / 0.4)'
                      : '1px solid hsl(272 100% 62% / 0.35)',
                    boxShadow: collection === "wegenettes"
                      ? '0 0 10px hsl(320 100% 55% / 0.2)'
                      : '0 0 10px hsl(272 100% 62% / 0.15)',
                  }}
                >
                  <Layers className="w-3 h-3 flex-shrink-0" style={{ color: collection === "wegenettes" ? 'hsl(320 100% 65%)' : 'hsl(272 100% 70%)' }} />
                  <span style={{ ...BANGERS, fontSize: '0.78rem', color: collection === "wegenettes" ? 'hsl(320 100% 70%)' : 'hsl(272 100% 75%)' }}>
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
                          ? (c === "wegenettes" ? 'hsl(320 100% 60%)' : 'hsl(272 100% 62%)')
                          : 'transparent',
                        border: `1px solid ${c === "wegenettes" ? 'hsl(320 100% 60%)' : 'hsl(272 100% 62%)'}`,
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
            <nav className="hidden md:flex items-center flex-1 min-w-0 overflow-hidden">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative flex items-center gap-1.5 px-2 py-2 transition-all group whitespace-nowrap flex-shrink-0 ${
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    style={{ ...BANGERS, fontSize: 'clamp(0.82rem, 1vw, 1.05rem)', letterSpacing: '0.1em' }}
                  >
                    <Icon className={`w-3 h-3 flex-shrink-0 ${isActive ? 'text-primary' : ''}`} />
                    {item.label}

                    {/* Paint-drip active indicator */}
                    {isActive ? (
                      <span
                        className="absolute bottom-0 left-1 right-1"
                        style={{
                          height: '3px',
                          background: 'linear-gradient(90deg, transparent, hsl(272 100% 62%), transparent)',
                          boxShadow: '0 0 8px hsl(272 100% 62% / 0.9), 0 2px 12px hsl(272 100% 62% / 0.5)',
                          filter: 'blur(0.3px)',
                        }}
                      />
                    ) : (
                      <span
                        className="absolute bottom-0 left-1 right-1 opacity-0 group-hover:opacity-40 transition-opacity"
                        style={{
                          height: '2px',
                          background: 'linear-gradient(90deg, transparent, hsl(272 100% 62%), transparent)',
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
              className="text-muted-foreground/60 hover:text-primary transition-colors p-1"
              title="Admin"
            >
              <ShieldAlert className="w-4 h-4" />
            </Link>

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
                onClick={connect}
                disabled={isConnecting}
                className="relative text-white font-bold uppercase tracking-widest transition-all neon-pulse overflow-hidden px-3 py-1.5 h-auto text-xs"
                style={{
                  ...BANGERS,
                  fontSize: '0.75rem',
                  background: 'linear-gradient(135deg, hsl(272 100% 52%) 0%, hsl(272 100% 68%) 100%)',
                  border: '2px solid hsl(272 100% 70% / 0.6)',
                  boxShadow: '2px 2px 0px rgba(0,0,0,0.9), 0 0 14px hsl(272 100% 62% / 0.4)',
                }}
              >
                <span
                  className="absolute inset-0 opacity-20"
                  style={{
                    background: 'linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)',
                    backgroundSize: '200% 200%',
                  }}
                />
                <Wallet className="relative z-10 w-3 h-3 mr-1.5" />
                <span className="relative z-10">
                  {isConnecting ? "Connecting..." : "Connect Wallet"}
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
      <main className="flex-1 container mx-auto px-4 py-8" style={{ position: 'relative', zIndex: 1 }}>
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
                color: 'hsl(272 100% 65%)',
                textShadow:
                  '5px 5px 0px hsl(268 40% 2%), -2px -2px 0px hsl(268 40% 2%), ' +
                  '8px 8px 0px rgba(0,0,0,0.8), 0 0 50px hsl(272 100% 65% / 0.8), 0 0 120px hsl(272 100% 50% / 0.4)',
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
              style={{ background: 'hsl(272 100% 65%)', boxShadow: '0 0 8px hsl(272 100% 65%)' }}
            />
            <div
              className="flex-1 h-px"
              style={{ background: 'linear-gradient(to left, transparent, hsl(272 100% 65% / 0.6))' }}
            />
          </div>
        </div>
      </footer>
    </div>
  );
}
