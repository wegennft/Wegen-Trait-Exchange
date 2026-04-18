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
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 border-2 border-primary/30 rounded-sm bg-card/20 brick-bg backdrop-blur-sm">
      <div
        className="w-20 h-20 flex items-center justify-center mb-6 rounded-sm rotate-3"
        style={{
          background: 'linear-gradient(135deg, rgba(255,107,0,0.15), rgba(255,107,0,0.05))',
          border: '2px solid rgba(255,107,0,0.4)',
          boxShadow: '0 0 24px rgba(255,107,0,0.2)',
        }}
      >
        <Wallet className="w-10 h-10 text-primary" style={{ filter: 'drop-shadow(0 0 8px rgba(255,107,0,0.6))' }} />
      </div>
      <h2
        className="text-4xl text-primary mb-3"
        style={{ fontFamily: "'Bangers', Impact, sans-serif", letterSpacing: '0.08em', textShadow: '3px 3px 0 rgba(0,0,0,0.8), 0 0 16px rgba(255,107,0,0.4)' }}
      >
        WALLET REQUIRED
      </h2>
      <p className="text-muted-foreground max-w-md mb-8 font-mono text-sm">
        // {message} //
      </p>
      <Button
        size="lg"
        onClick={connect}
        disabled={isConnecting}
        className="bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(255,107,0,0.4)] hover:shadow-[0_0_32px_rgba(255,107,0,0.6)] transition-all rounded-sm"
        style={{ fontFamily: "'Bangers', Impact, sans-serif", letterSpacing: '0.1em', fontSize: '1.1rem', paddingLeft: '2rem', paddingRight: '2rem' }}
      >
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </Button>
    </div>
  );
}
