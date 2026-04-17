import { ReactNode } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";

interface WalletConnectGuardProps {
  children: ReactNode;
  message?: string;
}

export function WalletConnectGuard({ children, message = "Connect your wallet to view this page" }: WalletConnectGuardProps) {
  const { isConnected, connect, isConnecting } = useWallet();

  if (isConnected) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 border border-border/50 rounded-xl bg-card/30 backdrop-blur-sm">
      <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(157,0,255,0.15)]">
        <Wallet className="w-8 h-8 text-primary" />
      </div>
      <h2 className="text-2xl font-bold mb-2 tracking-tight">Wallet Required</h2>
      <p className="text-muted-foreground max-w-md mb-8">
        {message}
      </p>
      <Button 
        size="lg" 
        onClick={connect} 
        disabled={isConnecting}
        className="bg-primary hover:bg-primary/90 shadow-[0_0_20px_rgba(157,0,255,0.3)] transition-all"
      >
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </Button>
    </div>
  );
}
