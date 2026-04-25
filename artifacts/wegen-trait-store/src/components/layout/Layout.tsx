import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useWallet } from "@/contexts/WalletContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Package, Gem, ShieldAlert, LogOut, Wallet, Zap, Repeat2, FlaskConical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const BANGERS = { fontFamily: "'Bangers', Impact, sans-serif", letterSpacing: '0.1em' };
const MARKER = { fontFamily: "'Permanent Marker', cursive", letterSpacing: '0.03em' };

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { walletAddress, isConnected, connect, disconnect, isConnecting } = useWallet();
  const { settings } = useSiteSettings();

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
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground dark">

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 w-full border-b-2 border-primary/40 bg-background/95 backdrop-blur-xl"
        style={{
          boxShadow: '0 4px 30px hsl(272 100% 62% / 0.15), 0 0 0 1px hsl(272 100% 62% / 0.08)',
        }}
      >
        {/* Top spray bar — thick gradient strip */}
        <div
          className="h-1.5 w-full"
          style={{
            background: 'linear-gradient(90deg, hsl(272 100% 62%) 0%, hsl(43 100% 52%) 50%, hsl(272 100% 62%) 100%)',
            filter: 'blur(0.5px)',
            boxShadow: '0 0 12px hsl(272 100% 62% / 0.7), 0 2px 20px hsl(43 100% 52% / 0.4)',
          }}
        />

        <div className="container mx-auto px-4 h-[60px] flex items-center justify-between">
          {/* ── Logo ── */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-85 group">
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt="Site Logo"
                  className="w-9 h-9 object-contain"
                />
              ) : (
                <div className="relative w-9 h-9 flex items-center justify-center flex-shrink-0">
                  {/* Spray bloom behind icon */}
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
                className="text-5xl hidden sm:inline-block leading-none"
                style={{
                  ...BANGERS,
                  color: 'hsl(var(--primary))',
                  textShadow: '4px 4px 0px rgba(0,0,0,1), -1px -1px 0 rgba(0,0,0,1), 0 0 28px hsl(272 100% 62% / 0.6)',
                  WebkitTextStroke: '2px rgba(0,0,0,0.85)',
                  paintOrder: 'stroke fill',
                }}
              >
                TRAIT<span style={{ color: 'hsl(var(--accent))', textShadow: '4px 4px 0px rgba(0,0,0,1), -1px -1px 0 rgba(0,0,0,1), 0 0 28px hsl(43 100% 52% / 0.7)' }}>STORE</span>
              </span>
            </Link>

            {/* ── Nav ── */}
            {!isAdminPage && (
              <nav className="hidden md:flex items-center gap-0">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`relative flex items-center gap-2 px-4 py-2 transition-all group ${
                        isActive
                          ? "text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      style={{ ...BANGERS, fontSize: '1.15rem', letterSpacing: '0.12em' }}
                    >
                      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-primary' : ''}`} />
                      {item.label}

                      {/* Paint-drip active indicator */}
                      {isActive ? (
                        <span
                          className="absolute bottom-0 left-2 right-2"
                          style={{
                            height: '3px',
                            background: 'linear-gradient(90deg, transparent, hsl(272 100% 62%), transparent)',
                            boxShadow: '0 0 8px hsl(272 100% 62% / 0.9), 0 2px 12px hsl(272 100% 62% / 0.5)',
                            filter: 'blur(0.3px)',
                          }}
                        />
                      ) : (
                        <span
                          className="absolute bottom-0 left-2 right-2 opacity-0 group-hover:opacity-40 transition-opacity"
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
          </div>

          {/* ── Right side ── */}
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="text-muted-foreground/60 hover:text-primary transition-colors p-2"
              title="Admin"
            >
              <ShieldAlert className="w-4.5 h-4.5" />
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
                className="relative text-white font-bold uppercase tracking-widest transition-all neon-pulse overflow-hidden"
                style={{
                  ...BANGERS,
                  fontSize: '1rem',
                  background: 'linear-gradient(135deg, hsl(272 100% 52%) 0%, hsl(272 100% 68%) 100%)',
                  border: '2px solid hsl(272 100% 70% / 0.6)',
                  boxShadow: '3px 3px 0px rgba(0,0,0,0.9), 0 0 20px hsl(272 100% 62% / 0.4)',
                }}
              >
                {/* Spray shimmer */}
                <span
                  className="absolute inset-0 opacity-20"
                  style={{
                    background: 'linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)',
                    backgroundSize: '200% 200%',
                  }}
                />
                <Wallet className="relative z-10 w-4 h-4 mr-2" />
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
        <div className="w-full overflow-hidden relative" style={{ aspectRatio: '3/1', maxHeight: 500 }}>
          <img
            src={settings.bannerUrl}
            alt="Site Banner"
            className="w-full h-full object-cover"
          />
          {/* Scanline overlay for retro feel */}
          <div className="absolute inset-0 scanlines opacity-30 pointer-events-none" />
          {/* Bottom fade to bg */}
          <div
            className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, transparent, hsl(272 25% 4%))' }}
          />
        </div>
      )}

      {/* ── Main ── */}
      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>

      {/* ── Footer ── */}
      <footer
        className="relative border-t-4 border-primary/30 py-10 overflow-hidden"
        style={{ background: 'hsl(272 28% 3%)' }}
      >
        {/* Background brick texture */}
        <div className="absolute inset-0 brick-bg opacity-60 pointer-events-none" />

        {/* Paint drips at top */}
        <div className="absolute top-0 left-0 right-0 pointer-events-none overflow-hidden">
          {/* Purple drips */}
          {[8, 22, 41, 58, 73, 89].map((pct, i) => (
            <div
              key={i}
              className="absolute"
              style={{
                left: `${pct}%`,
                top: 0,
                width: `${3 + (i % 3)}px`,
                height: `${16 + (i % 4) * 8}px`,
                background: i % 2 === 0 ? 'hsl(272 100% 62%)' : 'hsl(43 100% 52%)',
                borderRadius: '0 0 50% 50%',
                opacity: 0.6 + (i % 3) * 0.1,
                filter: 'blur(0.5px)',
              }}
            />
          ))}
        </div>

        <div className="container mx-auto px-4 relative z-10 flex flex-col items-center gap-4">
          {/* Big graffiti tag */}
          <div className="text-center">
            <span
              className="block text-6xl sm:text-7xl"
              style={{
                ...BANGERS,
                color: 'hsl(43 100% 52%)',
                textShadow:
                  '4px 4px 0px hsl(272 22% 3%), -2px -2px 0px hsl(272 22% 3%), ' +
                  '6px 6px 0px rgba(0,0,0,0.8), 0 0 40px hsl(43 100% 52% / 0.5)',
                WebkitTextStroke: '2px rgba(0,0,0,0.7)',
                paintOrder: 'stroke fill',
              }}
            >
              WEGEN<span style={{
                color: 'hsl(272 100% 62%)',
                textShadow:
                  '4px 4px 0px hsl(272 22% 3%), -2px -2px 0px hsl(272 22% 3%), ' +
                  '6px 6px 0px rgba(0,0,0,0.8), 0 0 40px hsl(272 100% 62% / 0.5)',
              }}> NFT</span>
            </span>
          </div>

          {/* Separator tag line */}
          <div className="flex items-center gap-4 w-full max-w-xs">
            <div
              className="flex-1 h-0.5 opacity-30"
              style={{ background: 'linear-gradient(to right, transparent, hsl(272 100% 62%))' }}
            />
            <span
              className="text-muted-foreground/50 text-xs"
              style={MARKER}
            >
              © {new Date().getFullYear()} all rights reserved
            </span>
            <div
              className="flex-1 h-0.5 opacity-30"
              style={{ background: 'linear-gradient(to left, transparent, hsl(43 100% 52%))' }}
            />
          </div>
        </div>
      </footer>
    </div>
  );
}
