import { useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useCollection } from "@/contexts/CollectionContext";
import { useEthPrice, formatUsd } from "@/hooks/useEthPrice";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListPointPacks,
  usePurchasePointPack,
  useGetStorePoints,
  useListBundles,
  usePurchaseBundle,
  getGetStorePointsQueryKey,
  getListBundlesQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TraitMedia } from "@/components/TraitMedia";
import { TxConfirmModal, type TxDetail } from "@/components/wallet/TxConfirmModal";
import { useToast } from "@/hooks/use-toast";
import { Coins, Package, Sparkles, Wallet, Zap, Gem } from "lucide-react";

const BANGERS = { fontFamily: "'Bungee', Impact, sans-serif", letterSpacing: "0.08em" };

export function BundlesPoints() {
  const { walletAddress, isConnected, connect } = useWallet();
  const { theme } = useCollection();
  const { accent, accentHsl, glow, gradient } = theme;
  const { ethUsd } = useEthPrice();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [pendingPack, setPendingPack] = useState<{ id: number; name: string; usdValue: string; pointsGranted: number } | null>(null);
  const [pendingBundle, setPendingBundle] = useState<{ id: number; name: string; priceEth: string } | null>(null);

  const { data: packsData, isLoading: loadingPacks } = useListPointPacks();
  const { data: bundlesData, isLoading: loadingBundles } = useListBundles();
  const { data: balanceData } = useGetStorePoints(walletAddress ?? "", { query: { enabled: !!walletAddress, queryKey: getGetStorePointsQueryKey(walletAddress ?? "") } });

  const purchasePointPack = usePurchasePointPack();
  const purchaseBundle = usePurchaseBundle();

  const pointPacks = packsData?.pointPacks ?? [];
  const bundles = bundlesData?.bundles ?? [];
  const totalPoints = balanceData?.totalPoints ?? 0;

  const handlePackConfirm = async () => {
    if (!pendingPack || !walletAddress || ethUsd === null) return;
    const ethAmount = (parseFloat(pendingPack.usdValue) / ethUsd).toFixed(8);
    try {
      await purchasePointPack.mutateAsync({
        packId: pendingPack.id,
        data: {
          walletAddress,
          ethAmount,
          ethPriceAtPurchase: ethUsd.toString(),
          txHash: `0xsimulated${Date.now()}`,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetStorePointsQueryKey(walletAddress) });
      toast({ title: "Points purchased!", description: `+${pendingPack.pointsGranted} points added to your balance.` });
    } catch (err) {
      toast({ title: "Purchase failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setPendingPack(null);
    }
  };

  const handleBundleConfirm = async () => {
    if (!pendingBundle || !walletAddress) return;
    try {
      await purchaseBundle.mutateAsync({
        bundleId: pendingBundle.id,
        data: { walletAddress, txHash: `0xsimulated${Date.now()}` },
      });
      queryClient.invalidateQueries({ queryKey: getListBundlesQueryKey() });
      toast({ title: "Bundle purchased!", description: "Traits have been added to your Locker." });
    } catch (err) {
      toast({ title: "Purchase failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setPendingBundle(null);
    }
  };

  const packDetails: TxDetail[] = pendingPack && ethUsd !== null
    ? [
        { label: "Pack", value: pendingPack.name },
        { label: "Points", value: `${pendingPack.pointsGranted}`, accent: true },
        { label: "USD Value", value: `$${pendingPack.usdValue}` },
        { label: "ETH Amount", value: `${(parseFloat(pendingPack.usdValue) / ethUsd).toFixed(6)} ETH` },
      ]
    : [];

  const bundleDetails: TxDetail[] = pendingBundle
    ? [
        { label: "Bundle", value: pendingBundle.name },
        { label: "Price", value: `${pendingBundle.priceEth} ETH`, accent: true },
        ...(formatUsd(pendingBundle.priceEth, ethUsd) ? [{ label: "USD", value: formatUsd(pendingBundle.priceEth, ethUsd)! }] : []),
      ]
    : [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-12 relative z-10">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl flex items-center gap-3" style={{ ...BANGERS, color: accent }}>
            <Sparkles className="w-8 h-8" style={{ color: accent }} />
            Packs &amp; Points
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Buy store points with a fixed USD value, or grab a bundle of traits straight into your Trait Locker.
          </p>
        </div>

        <div
          className="flex items-center gap-3 px-5 py-3 rounded-xl flex-shrink-0"
          style={{ background: gradient, border: `1px solid ${accent}55`, boxShadow: `0 0 14px ${glow}` }}
        >
          <Coins className="w-6 h-6" style={{ color: accent }} />
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Your Balance</div>
            <div className="text-xl font-bold" style={{ ...BANGERS, color: accent }}>
              {isConnected ? totalPoints.toLocaleString() : "—"} pts
            </div>
          </div>
          {!isConnected && (
            <Button size="sm" variant="outline" onClick={() => connect()} className="ml-2 gap-1.5">
              <Wallet className="w-3.5 h-3.5" /> Connect
            </Button>
          )}
        </div>
      </div>

      {/* ── Point Packs ── */}
      <section className="space-y-4">
        <h2 className="text-xl flex items-center gap-2" style={{ ...BANGERS, color: accent }}>
          <Coins className="w-5 h-5" /> Store Points
        </h2>
        {loadingPacks ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
          </div>
        ) : pointPacks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No point packs available right now.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {pointPacks.map((pack) => (
              <Card key={pack.id} className="border-border/60 hover:border-primary/50 transition-colors overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {pack.imageUrl ? (
                      <img src={pack.imageUrl} alt={pack.name} className="w-8 h-8 rounded-md object-cover" />
                    ) : (
                      <Coins className="w-5 h-5" style={{ color: accent }} />
                    )}
                    <span className="truncate">{pack.name}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pack.description && <p className="text-xs text-muted-foreground line-clamp-2">{pack.description}</p>}
                  <div className="flex items-baseline justify-between">
                    <Badge variant="secondary" className="font-bold">{pack.pointsGranted.toLocaleString()} pts</Badge>
                    <span className="text-lg font-bold" style={{ color: accent }}>${pack.usdValue}</span>
                  </div>
                  <Button
                    className="w-full gap-1.5"
                    size="sm"
                    disabled={ethUsd === null}
                    onClick={() => {
                      if (!isConnected) { connect(); return; }
                      setPendingPack(pack);
                    }}
                  >
                    <Zap className="w-3.5 h-3.5" /> Buy Points
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Bundles ── */}
      <section className="space-y-4">
        <h2 className="text-xl flex items-center gap-2" style={{ ...BANGERS, color: accent }}>
          <Package className="w-5 h-5" /> Trait Bundles
        </h2>
        {loadingBundles ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
          </div>
        ) : bundles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bundles available right now.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {bundles.map((bundle) => {
              const soldOut = bundle.totalSupply !== -1 && bundle.remainingSupply < 1;
              return (
                <Card key={bundle.id} className="border-border/60 hover:border-primary/50 transition-colors overflow-hidden flex flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Gem className="w-4 h-4" style={{ color: accent }} />
                      <span className="truncate">{bundle.name}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 flex-1 flex flex-col">
                    {bundle.description && <p className="text-xs text-muted-foreground line-clamp-2">{bundle.description}</p>}
                    <div className="flex flex-wrap gap-1.5">
                      {bundle.traits.slice(0, 4).map((t) => (
                        <div key={t.id} className="w-9 h-9 rounded-md overflow-hidden border border-border/50 flex-shrink-0">
                          <TraitMedia url={t.imageUrl} mediaType={t.mediaType} alt={t.name} className="w-full h-full" />
                        </div>
                      ))}
                      {bundle.traits.length > 4 && (
                        <div className="w-9 h-9 rounded-md flex items-center justify-center text-[10px] text-muted-foreground border border-border/50 flex-shrink-0">
                          +{bundle.traits.length - 4}
                        </div>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{bundle.traits.length} trait{bundle.traits.length !== 1 ? "s" : ""}</div>
                    <div className="mt-auto flex items-baseline justify-between">
                      <span className="text-lg font-bold" style={{ color: accent }}>{bundle.priceEth} ETH</span>
                      {formatUsd(bundle.priceEth, ethUsd) && (
                        <span className="text-[10px] text-muted-foreground">≈ {formatUsd(bundle.priceEth, ethUsd)}</span>
                      )}
                    </div>
                    {bundle.totalSupply !== -1 && (
                      <div className="text-[10px] text-muted-foreground">{bundle.remainingSupply} / {bundle.totalSupply} remaining</div>
                    )}
                    <Button
                      className="w-full gap-1.5"
                      size="sm"
                      disabled={soldOut}
                      onClick={() => {
                        if (!isConnected) { connect(); return; }
                        setPendingBundle(bundle);
                      }}
                    >
                      <Zap className="w-3.5 h-3.5" /> {soldOut ? "Sold Out" : "Buy Bundle"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <TxConfirmModal
        open={!!pendingPack}
        onOpenChange={(open) => !open && setPendingPack(null)}
        title="Buy Store Points"
        description="Points are credited to your wallet immediately after purchase."
        details={packDetails}
        onConfirm={handlePackConfirm}
        isPending={purchasePointPack.isPending}
        confirmLabel="Buy Points"
      />

      <TxConfirmModal
        open={!!pendingBundle}
        onOpenChange={(open) => !open && setPendingBundle(null)}
        title="Buy Trait Bundle"
        description="All traits in this bundle will be added directly to your Trait Locker."
        details={bundleDetails}
        onConfirm={handleBundleConfirm}
        isPending={purchaseBundle.isPending}
        confirmLabel="Buy Bundle"
      />
    </div>
  );
}
