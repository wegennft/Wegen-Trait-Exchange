import { ReactNode } from "react";
import { Redirect } from "wouter";
import { useWallet } from "@/contexts/WalletContext";
import { WalletConnectGuard } from "@/components/shared/WalletConnectGuard";

interface AdminGuardProps {
  children: ReactNode;
}

/**
 * Gates admin-only pages: requires a connected & verified wallet session
 * AND that wallet being on the server's admin allowlist. Non-admin wallets
 * are redirected away instead of ever rendering the dashboard.
 */
export function AdminGuard({ children }: AdminGuardProps) {
  const { isConnected, isAdmin } = useWallet();

  return (
    <WalletConnectGuard message="Connect your admin wallet to access the dashboard.">
      {isConnected && isAdmin ? <>{children}</> : <Redirect to="/" />}
    </WalletConnectGuard>
  );
}
