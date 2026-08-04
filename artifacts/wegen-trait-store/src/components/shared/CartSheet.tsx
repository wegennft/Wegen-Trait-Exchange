import { useState } from "react";
import { useCart, traitKey, bundleKey } from "@/contexts/CartContext";
import { useWallet } from "@/contexts/WalletContext";
import { useCollection } from "@/contexts/CollectionContext";
import { useEthPrice, formatEth } from "@/hooks/useEthPrice";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  usePurchaseTrait,
  usePurchaseBundle,
  getListBundlesQueryKey,
  getGetStoreStatsQueryKey,
} from "@workspace/api-client-react";
import { TraitMedia } from "@/components/TraitMedia";
import { TraitImageZoom } from "@/components/TraitImageZoom";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Loader2,
  Coins,
  Package,
  ShoppingBag,
  ShoppingCart,
  Wallet,
  X,
  Zap,
  Trash2,
} from "lucide-react";

const BANGERS = { fontFamily: "'Bungee', Impact, sans-serif", letterSpacing: "0.08em" };

export function CartSheet() {
  const {
    items: cartItemsMap,
    removeItem,
    clearCart,
    count: cartCount,
    totalUsd: cartTotalUsd,
    totalEth: cartTotal,
    cartOpen,
    closeCart,
  } = useCart();

  const { walletAddress, isConnected, connect } = useWallet();
  const { theme } = useCollection();
  const { accent, glow, glow2, gradient } = theme;
  const { ethUsd } = useEthPrice();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutProgress, setCheckoutProgress] = useState<{ done: number; total: number } | null>(null);

  const purchaseTrait = usePurchaseTrait();
  const purchaseBundle = usePurchaseBundle();

  const cartItems = Array.from(cartItemsMap.values());

  const handleCheckout = async () => {
    const allItems = Array.from(cartItemsMap.values());
    if (!walletAddress || allItems.length === 0) return;
    setIsCheckingOut(true);
    setCheckoutProgress({ done: 0, total: allItems.length });
    let succeeded = 0;
    let failed = 0;
    for (let i = 0; i < allItems.length; i++) {
      const ci = allItems[i];
      try {
        if (ci.kind === "trait") {
          await purchaseTrait.mutateAsync({
            walletAddress,
            data: { traitId: ci.item.id, quantity: 1, txHash: `0xsimulated${Date.now()}` },
          });
        } else {
          await purchaseBundle.mutateAsync({
            bundleId: ci.item.id,
            data: { walletAddress, txHash: `0xsimulated${Date.now()}` },
          });
        }
        succeeded++;
      } catch {
        failed++;
      }
      setCheckoutProgress({ done: i + 1, total: allItems.length });
    }
    // Broad invalidation — covers both Store and BundlesPoints data
    queryClient.invalidateQueries({ queryKey: ["/api/traits"] });
    queryClient.invalidateQueries({ queryKey: getGetStoreStatsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListBundlesQueryKey() });
    clearCart();
    closeCart();
    setIsCheckingOut(false);
    setCheckoutProgress(null);
    if (failed === 0) {
      toast({ title: `${succeeded} item${succeeded > 1 ? "s" : ""} purchased!`, description: "Check your Locker to equip them." });
    } else {
      toast({ title: `${succeeded} purchased, ${failed} failed`, description: "Some items could not be completed.", variant: "destructive" });
    }
  };

  return (
    <Sheet open={cartOpen} onOpenChange={(open) => { if (!open) closeCart(); }}>
      <SheetContent
        className="flex flex-col w-full sm:max-w-md p-0 border-l border-primary/30"
        style={{
          background: "hsl(268 40% 4%)",
          boxShadow: `-10px 0 60px ${glow2}`,
        }}
      >
        {/* Header */}
        <SheetHeader className="px-6 py-5 border-b border-primary/20 flex-shrink-0">
          <SheetTitle asChild>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: `${accent}33`, border: `1px solid ${accent}66` }}
                >
                  <ShoppingCart className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <div className="text-xl leading-none" style={{ ...BANGERS, color: "hsl(var(--primary))" }}>
                    SHOPPING CART
                  </div>
                  <div className="text-xs text-muted-foreground/60 mt-0.5">
                    {cartCount} item{cartCount !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>
              {cartCount > 0 && (
                <button
                  onClick={() => clearCart()}
                  className="flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-destructive transition-colors px-2 py-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear all
                </button>
              )}
            </div>
          </SheetTitle>
        </SheetHeader>

        {/* Cart items list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {cartCount === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 gap-4 text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: "hsl(268 35% 8%)", border: "1px solid hsl(268 22% 15%)" }}
              >
                <ShoppingBag className="w-7 h-7 text-muted-foreground/30" />
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground/50" style={BANGERS}>YOUR CART IS EMPTY</p>
                <p className="text-xs text-muted-foreground/35 mt-1">Browse the store and add traits to get started</p>
              </div>
              <Button size="sm" variant="outline" className="border-primary/40 text-primary" onClick={closeCart}>
                Browse Traits
              </Button>
            </div>
          ) : (
            cartItems.map((ci) => {
              const ik = ci.kind === "trait" ? traitKey(ci.item.id) : bundleKey(ci.item.id);
              if (ci.kind === "bundle") {
                const bundle = ci.item;
                return (
                  <div
                    key={ik}
                    className="flex items-center gap-3 p-3 rounded-xl transition-all"
                    style={{ background: "hsl(268 35% 6%)", border: "1px solid hsl(268 22% 14%)" }}
                  >
                    {/* 2×2 mosaic of trait images */}
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-secondary/40 flex-shrink-0 border border-border/20 grid grid-cols-2">
                      {bundle.traits.slice(0, 4).map((t, i) => (
                        <div key={i} className="overflow-hidden bg-secondary/50">
                          {t.imageUrl
                            ? <img src={t.imageUrl} alt={t.name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center"><Package className="w-2 h-2 opacity-20" /></div>
                          }
                        </div>
                      ))}
                      {bundle.traits.length < 4 && Array.from({ length: 4 - bundle.traits.length }).map((_, i) => (
                        <div key={`e${i}`} className="bg-secondary/30" />
                      ))}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate text-foreground">{bundle.name}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground/60 mt-0.5">
                        <Package className="w-3 h-3" />
                        {bundle.traits.length} trait{bundle.traits.length !== 1 ? "s" : ""}
                      </div>
                      <div className="flex items-center gap-1 text-accent text-xs font-bold font-mono mt-0.5">
                        <Coins className="w-3 h-3" />
                        ${bundle.priceUsd}
                        <span className="text-muted-foreground/50 font-normal ml-1">
                          · {formatEth(bundle.priceUsd, ethUsd) ?? "..."}
                        </span>
                      </div>
                    </div>
                    {/* Remove */}
                    <button
                      onClick={() => removeItem(ik)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              }
              const trait = ci.item;
              return (
                <div
                  key={ik}
                  className="flex items-center gap-3 p-3 rounded-xl border transition-all"
                  style={{
                    background: "hsl(268 35% 6%)",
                    border: "1px solid hsl(268 22% 14%)",
                  }}
                >
                  {/* Thumbnail */}
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-secondary/40 flex-shrink-0 border border-border/20">
                    {trait.imageUrl ? (
                      <TraitImageZoom url={trait.imageUrl} mediaType={trait.mediaType ?? undefined} alt={trait.name} className="w-full h-full">
                        <TraitMedia url={trait.imageUrl} mediaType={trait.mediaType ?? undefined} alt={trait.name} className="w-full h-full object-contain" />
                      </TraitImageZoom>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg font-bold text-muted-foreground/30">
                        {trait.category?.[0]}
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate text-foreground">{trait.name}</div>
                    <div className="text-xs text-muted-foreground/60 capitalize">{trait.category} · {trait.rarity}</div>
                    <div className="flex items-center gap-1 text-accent text-xs font-bold font-mono mt-0.5">
                      <Coins className="w-3 h-3" />
                      ${trait.priceUsd}
                      <span className="text-muted-foreground/50 font-normal ml-1">
                        · {formatEth(trait.priceUsd, ethUsd) ?? "..."}
                      </span>
                    </div>
                  </div>
                  {/* Remove */}
                  <button
                    onClick={() => removeItem(ik)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer — summary + checkout */}
        {cartCount > 0 && (
          <div
            className="flex-shrink-0 px-6 py-5 border-t border-primary/20 space-y-4"
            style={{ background: "hsl(268 40% 3%)" }}
          >
            {/* Order summary */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground/60">
                <span>{cartCount} item{cartCount > 1 ? "s" : ""}</span>
                <span className="font-mono">${cartTotalUsd.toFixed(2)}</span>
              </div>
              {walletAddress && (
                <div className="flex justify-between text-muted-foreground/50 text-xs">
                  <span>Wallet</span>
                  <span className="font-mono">{walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}</span>
                </div>
              )}
              <div
                className="flex justify-between font-bold pt-2 border-t border-border/30"
                style={{ color: "hsl(43 100% 56%)" }}
              >
                <span style={BANGERS}>TOTAL</span>
                <div className="text-right">
                  <div className="font-mono text-base">${cartTotalUsd.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground/50 font-mono font-normal">
                    ≈ {formatEth(cartTotalUsd, ethUsd) ?? `${cartTotal.toFixed(4)} ETH`}
                  </div>
                </div>
              </div>
            </div>

            {/* Progress bar during checkout */}
            {checkoutProgress && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground/60">
                  <span>Processing…</span>
                  <span>{checkoutProgress.done} / {checkoutProgress.total}</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${(checkoutProgress.done / checkoutProgress.total) * 100}%`,
                      background: gradient,
                      boxShadow: `0 0 10px ${glow}`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Connect / Checkout button */}
            {!isConnected ? (
              <Button
                className="w-full gap-2 font-bold"
                style={{ ...BANGERS, background: gradient }}
                onClick={() => void connect()}
              >
                <Wallet className="w-4 h-4" />
                CONNECT WALLET TO CHECKOUT
              </Button>
            ) : (
              <button
                onClick={handleCheckout}
                disabled={isCheckingOut}
                className="w-full py-3.5 rounded-xl flex items-center justify-center gap-2.5 font-bold text-black transition-all disabled:opacity-60"
                style={{
                  ...BANGERS,
                  fontSize: "1rem",
                  background: isCheckingOut
                    ? "hsl(43 80% 45%)"
                    : "linear-gradient(135deg, hsl(43 100% 56%), hsl(35 100% 50%))",
                  boxShadow: isCheckingOut ? "none" : "0 0 24px hsl(43 100% 56% / 0.5), 0 4px 16px rgba(0,0,0,0.4)",
                }}
              >
                {isCheckingOut ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    PROCESSING…
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    CHECKOUT — ${cartTotalUsd.toFixed(2)}
                  </>
                )}
              </button>
            )}

            <p className="text-center text-[10px] text-muted-foreground/35">
              One of each trait per transaction · Added to your Locker on success
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
