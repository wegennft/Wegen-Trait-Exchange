import { ReactNode } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";

const BANGERS = { fontFamily: "'Bangers', Impact, sans-serif", letterSpacing: '0.08em' };

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
    <div
      className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 border-2 border-primary/40 bg-card/20 brick-bg backdrop-blur-sm"
      style={{ boxShadow: '0 0 40px rgba(157,0,255,0.1), inset 0 0 60px rgba(157,0,255,0.04)' }}
    >
      <div
        className="w-20 h-20 flex items-center justify-center mb-6 rotate-3"
        style={{
          background: 'linear-gradient(135deg, rgba(157,0,255,0.2), rgba(157,0,255,0.05))',
          border: '2px solid rgba(157,0,255,0.5)',
          boxShadow: '0 0 24px rgba(157,0,255,0.25)',
        }}
      >
        <Wallet
          className="w-10 h-10 text-primary"
          style={{ filter: 'drop-shadow(0 0 8px rgba(157,0,255,0.7))' }}
        />
      </div>
      <h2
        className="text-4xl text-primary mb-3"
        style={{ ...BANGERS, textShadow: '3px 3px 0 rgba(0,0,0,0.9), 0 0 18px rgba(157,0,255,0.5)' }}
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
        className="bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-widest transition-all neon-pulse"
        style={{ ...BANGERS, fontSize: '1.1rem', paddingLeft: '2rem', paddingRight: '2rem' }}
      >
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </Button>
    </div>
  );
}
