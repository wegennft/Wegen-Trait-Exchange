import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Package, Gem, ShieldAlert, LogOut, Wallet } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground dark">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-[0_0_15px_rgba(157,0,255,0.5)]">
                <span className="text-white font-bold text-xl tracking-tighter">W</span>
              </div>
              <span className="font-bold text-xl hidden sm:inline-block tracking-tight">TraitStore</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-secondary text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-muted-foreground hover:text-primary transition-colors p-2" title="Admin">
              <ShieldAlert className="w-5 h-5" />
            </Link>

            {isConnected && walletAddress ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="border-primary/50 hover:bg-primary/10 hover:border-primary shadow-[0_0_10px_rgba(157,0,255,0.1)]">
                    <Wallet className="w-4 h-4 mr-2 text-primary" />
                    {truncateAddress(walletAddress)}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                  <DropdownMenuLabel>Connected Wallet</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer text-muted-foreground">
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
              <Button onClick={connect} disabled={isConnecting} className="bg-primary hover:bg-primary/90 text-white shadow-[0_0_15px_rgba(157,0,255,0.4)] transition-all">
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>

      <footer className="border-t border-border/40 py-8 bg-card/30">
        <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
          <p>© {new Date().getFullYear()} Wegen NFT. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
