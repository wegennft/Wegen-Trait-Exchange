/**
 * TxConfirmModal — reusable transaction confirmation dialog.
 *
 * Replaces one-off AlertDialog blocks scattered across pages. Usage:
 *
 *   <TxConfirmModal
 *     open={open}
 *     onOpenChange={setOpen}
 *     title="Purchase Trait"
 *     description="This will submit a transaction to Ethereum mainnet."
 *     details={[
 *       { label: "Trait",  value: "Cyber Punk Eyes" },
 *       { label: "Price",  value: "0.05 ETH" },
 *       { label: "Chain",  value: "Ethereum Mainnet" },
 *     ]}
 *     onConfirm={handleBuy}
 *     isPending={isPending}
 *     confirmLabel="Buy Now"
 *     warningText="A gas fee will be required to complete this transaction."
 *   />
 *
 * SECURITY: The modal ALWAYS shows details before letting the user confirm.
 * It never auto-submits. The user must click "Confirm" explicitly.
 */

import { Loader2, Zap, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const BANGERS = { fontFamily: "'Bungee', Impact, sans-serif", letterSpacing: "0.08em" };

export interface TxDetail {
  label: string;
  value: string;
  accent?: boolean;
}

export interface TxConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  details?: TxDetail[];
  onConfirm: () => void;
  isPending?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  warningText?: string;
  /** Extra JSX content rendered below the details list */
  children?: React.ReactNode;
}

export function TxConfirmModal({
  open,
  onOpenChange,
  title = "Confirm Transaction",
  description = "Review the details below before signing with your wallet.",
  details = [],
  onConfirm,
  isPending = false,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  warningText = "A gas fee will be required to complete this transaction in your wallet.",
  children,
}: TxConfirmModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        style={{
          background: "linear-gradient(160deg, rgba(18,10,28,0.99), rgba(12,7,20,0.99))",
          border: "1px solid rgba(255,200,0,0.35)",
          boxShadow:
            "0 0 40px rgba(157,0,255,0.25), 0 0 80px rgba(255,200,0,0.08)",
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2" style={BANGERS}>
            <Zap className="w-5 h-5 text-yellow-400" />
            <span style={{ color: "hsl(43 100% 65%)" }}>{title}</span>
          </AlertDialogTitle>

          <AlertDialogDescription className="font-mono text-xs space-y-3 mt-2" asChild>
            <div>
              <p className="text-muted-foreground/80">{description}</p>

              {details.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {details.map((d) => (
                    <div
                      key={d.label}
                      className="flex items-center justify-between gap-4 px-2.5 py-1.5 rounded"
                      style={{
                        background: d.accent
                          ? "rgba(255,200,0,0.07)"
                          : "rgba(157,0,255,0.08)",
                        border: d.accent
                          ? "1px solid rgba(255,200,0,0.25)"
                          : "1px solid rgba(157,0,255,0.2)",
                      }}
                    >
                      <span
                        className="text-[10px] uppercase tracking-widest flex-shrink-0"
                        style={{ color: "hsl(272 40% 60%)" }}
                      >
                        {d.label}
                      </span>
                      <span
                        className="text-xs font-bold truncate text-right"
                        style={{
                          color: d.accent ? "hsl(43 100% 65%)" : "hsl(0 0% 95%)",
                        }}
                      >
                        {d.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {children}

              {warningText && (
                <div className="flex items-start gap-2 mt-3">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-yellow-500/70" />
                  <p className="text-[10px] text-yellow-500/60">{warningText}</p>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="mt-2">
          <AlertDialogCancel
            className="font-mono text-xs"
            style={{
              background: "rgba(157,0,255,0.08)",
              border: "1px solid rgba(157,0,255,0.25)",
              color: "hsl(272 50% 70%)",
            }}
          >
            {cancelLabel}
          </AlertDialogCancel>

          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isPending}
            className="flex items-center gap-2 font-bold uppercase"
            style={{
              ...BANGERS,
              background: "linear-gradient(90deg,rgba(255,200,0,0.2),rgba(157,0,255,0.2))",
              border: "1px solid rgba(255,200,0,0.6)",
              color: "hsl(43 100% 65%)",
              boxShadow: "0 0 12px rgba(255,200,0,0.15)",
            }}
          >
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                SIGNING…
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                {confirmLabel}
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
