import { ReactNode } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { Wallet, PenLine, Loader2, CheckCircle2 } from "lucide-react";

const BANGERS = { fontFamily: "'Bebas Neue', 'Rajdhani', sans-serif", letterSpacing: '0.1em' };

interface WalletConnectGuardProps {
  children: ReactNode;
  message?: string;
}

export function WalletConnectGuard({ children, message = "Connect your wallet to view this page" }: WalletConnectGuardProps) {
  const { isConnected, isConnecting, connectStep, openWalletPicker } = useWallet();

  if (isConnected) {
    return <>{children}</>;
  }

  const buttonLabel = connectStep === "signing"
    ? "Sign in wallet…"
    : connectStep === "requesting"
    ? "Connecting…"
    : "Connect Wallet";

  const buttonIcon = connectStep === "signing"
    ? <PenLine className="w-5 h-5 mr-2 animate-pulse" />
    : connectStep === "requesting"
    ? <Loader2 className="w-5 h-5 mr-2 animate-spin" />
    : <Wallet className="w-5 h-5 mr-2" />;

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

      <p className="text-muted-foreground max-w-md mb-4 font-mono text-sm">
        // {message} //
      </p>

      <div className="flex items-center gap-6 mb-6 text-xs text-muted-foreground">
        <div className="flex flex-col items-center gap-1.5">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${connectStep === "requesting" ? "border-primary bg-primary/20 text-primary" : "border-border/50 bg-secondary/30"}`}>
            <Wallet className="w-3.5 h-3.5" />
          </div>
          <span className="font-mono">Connect</span>
        </div>
        <div className="h-px w-8 bg-border/50" />
        <div className="flex flex-col items-center gap-1.5">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${connectStep === "signing" ? "border-primary bg-primary/20 text-primary" : "border-border/50 bg-secondary/30"}`}>
            <PenLine className="w-3.5 h-3.5" />
          </div>
          <span className="font-mono">Sign</span>
        </div>
        <div className="h-px w-8 bg-border/50" />
        <div className="flex flex-col items-center gap-1.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center border-2 border-border/50 bg-secondary/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <span className="font-mono">Verified</span>
        </div>
      </div>

      <Button
        size="lg"
        onClick={() => openWalletPicker()}
        disabled={isConnecting}
        className="bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-widest transition-all neon-pulse"
        style={{ ...BANGERS, fontSize: '1.1rem', paddingLeft: '2rem', paddingRight: '2rem' }}
      >
        {buttonIcon}
        {buttonLabel}
      </Button>

      <p className="text-[10px] text-muted-foreground/60 mt-4 font-mono max-w-xs">
        Signing proves wallet ownership. No transaction is submitted and no gas is charged.
        On mobile, use WalletConnect from the wallet picker.
      </p>
    </div>
  );
}
