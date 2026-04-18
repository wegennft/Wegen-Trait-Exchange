import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Package, Gem, ShieldAlert, LogOut, Wallet, Zap } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const BANGERS = { fontFamily: "'Bangers', Impact, sans-serif", letterSpacing: '0.08em' };

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { walletAddress, isConnected, connect, disconnect, isConnecting } = useWallet();

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const navItems = [
    { href: "/", label: "Store", icon: ShoppingBag },
    { href: "/locker", label: "Locker", icon: Package },
    { href: "/nfts", label: "My Wegens", icon: Gem },
  ];

  const isAdminPage = location === "/admin";

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground dark">
      <header className="sticky top-0 z-50 w-full border-b-2 border-primary/50 bg-background/92 backdrop-blur-xl">
        {/* Gold + purple top stripe */}
        <div className="h-1 w-full bg-gradient-to-r from-primary via-accent to-primary" />
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80 group">
              <div className="relative w-9 h-9 flex items-center justify-center">
                <div
                  className="absolute inset-0 bg-primary group-hover:rotate-6 transition-transform"
                  style={{ boxShadow: '0 0 20px rgba(157,0,255,0.7), 0 0 40px rgba(157,0,255,0.3)' }}
                />
                <Zap className="relative z-10 w-5 h-5 text-white" />
              </div>
              <span
                className="text-2xl hidden sm:inline-block"
                style={{ ...BANGERS, color: 'hsl(272 100% 70%)', textShadow: '2px 2px 0px rgba(0,0,0,0.9), 0 0 14px rgba(157,0,255,0.6)' }}
              >
                TRAIT<span style={{ color: 'hsl(43 100% 52%)', textShadow: '2px 2px 0px rgba(0,0,0,0.9), 0 0 14px rgba(255,200,0,0.6)' }}>STORE</span>
              </span>
            </Link>

            {!isAdminPage && (
              <nav className="hidden md:flex items-center gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2 px-4 py-2 text-sm uppercase tracking-widest transition-all relative ${
                        isActive
                          ? "text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      style={BANGERS}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                      {isActive && (
                        <span
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                          style={{ boxShadow: '0 0 8px rgba(157,0,255,0.9)' }}
                        />
                      )}
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-muted-foreground hover:text-primary transition-colors p-2" title="Admin">
              <ShieldAlert className="w-5 h-5" />
            </Link>

            {isConnected && walletAddress ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-primary/60 hover:bg-primary/10 hover:border-primary font-mono text-xs transition-all"
                    style={{ boxShadow: '0 0 10px rgba(157,0,255,0.2)' }}
                  >
                    <Wallet className="w-4 h-4 mr-2 text-primary" />
                    {truncateAddress(walletAddress)}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                  <DropdownMenuLabel style={BANGERS}>CONNECTED WALLET</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer text-muted-foreground font-mono text-xs">
                    {walletAddress}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={disconnect} className="cursor-pointer text-destructive focus:text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Disconnect
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={connect}
                disabled={isConnecting}
                className="bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-widest transition-all neon-pulse"
                style={{ ...BANGERS, fontSize: '1rem' }}
              >
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>

      <footer className="border-t-2 border-primary/25 py-6 bg-card/20">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <span
            className="text-lg"
            style={{ ...BANGERS, color: 'hsl(43 100% 52%)', textShadow: '2px 2px 0 rgba(0,0,0,0.8), 0 0 10px rgba(255,200,0,0.5)' }}
          >
            WEGEN NFT
          </span>
          <span className="mx-2 text-muted-foreground/40">·</span>
          <span className="text-xs font-mono uppercase tracking-widest">© {new Date().getFullYear()} All rights reserved</span>
        </div>
      </footer>
    </div>
  );
}
