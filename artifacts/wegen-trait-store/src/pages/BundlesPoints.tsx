import { useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useCollection } from "@/contexts/CollectionContext";
import { useEthPrice, formatUsd, formatEth } from "@/hooks/useEthPrice";
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
import { Input } from "@/components/ui/input";
import { TraitMedia } from "@/components/TraitMedia";
import { TraitImageZoom } from "@/components/TraitImageZoom";
import { TxConfirmModal, type TxDetail } from "@/components/wallet/TxConfirmModal";
import { useToast } from "@/hooks/use-toast";
import { Coins, Package, Sparkles, Wallet, Zap, Gem, Search, X } from "lucide-react";
import { SmackzCoin } from "@/components/SmackzCoin";

const BANGERS = { fontFamily: "'Bungee', Impact, sans-serif", letterSpacing: "0.08em" };

const CATEGORY_ORDER = ["Background", "Body", "Clothes", "Eyes", "Headgear", "Mouth"];

function groupTraitsByCategory<T extends { category: string }>(traits: T[]): { category: string; traits: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const trait of traits) {
    const list = groups.get(trait.category);
    if (list) {
      list.push(trait);
    } else {
      groups.set(trait.category, [trait]);
    }
  }
  const orderedCategories = [
    ...CATEGORY_ORDER.filter((c) => groups.has(c)),
    ...[...groups.keys()].filter((c) => !CATEGORY_ORDER.includes(c)),
  ];
  return orderedCategories.map((category) => ({ category, traits: groups.get(category)! }));
}

export function BundlesPoints() {
  const { walletAddress, isConnected, connect } = useWallet();
  const { theme } = useCollection();
  const { accent, accentHsl, glow, gradient } = theme;
  const { ethUsd } = useEthPrice();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [pendingPack, setPendingPack] = useState<{ id: number; name: string; usdValue: string; pointsGranted: number } | null>(null);
  const [pendingBundle, setPendingBundle] = useState<{ id: number; name: string; priceUsd: string } | null>(null);
  const [traitSearch, setTraitSearch] = useState("");

  const { data: packsData, isLoading: loadingPacks } = useListPointPacks();
  const { data: bundlesData, isLoading: loadingBundles } = useListBundles();
  const { data: balanceData } = useGetStorePoints(walletAddress ?? "", { query: { enabled: !!walletAddress, queryKey: getGetStorePointsQueryKey(walletAddress ?? "") } });

  const purchasePointPack = usePurchasePointPack();
  const purchaseBundle = usePurchaseBundle();

  const pointPacks = [...(packsData?.pointPacks ?? [])].sort(
    (a, b) => parseFloat(a.usdValue) - parseFloat(b.usdValue)
  );
  const bundles = bundlesData?.bundles ?? [];
  const totalPoints = balanceData?.totalPoints ?? 0;

  const normalizedSearch = traitSearch.trim().toLowerCase();
  const filteredBundles = normalizedSearch
    ? bundles.filter((bundle) =>
        bundle.name.toLowerCase().includes(normalizedSearch) ||
        bundle.traits.some((t) => t.name.toLowerCase().includes(normalizedSearch))
      )
    : bundles;

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
      toast({ title: "We Smackz purchased!", description: `+${pendingPack.pointsGranted} We Smackz added to your balance.` });
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
      toast({ title: "Pack purchased!", description: "Traits have been added to your Locker." });
    } catch (err) {
      toast({ title: "Purchase failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setPendingBundle(null);
    }
  };

  const packDetails: TxDetail[] = pendingPack && ethUsd !== null
    ? [
        { label: "Pack", value: pendingPack.name },
        { label: "We Smackz", value: `${pendingPack.pointsGranted}`, accent: true },
        { label: "USD Value", value: `$${pendingPack.usdValue}` },
        { label: "ETH Amount", value: `${(parseFloat(pendingPack.usdValue) / ethUsd).toFixed(6)} ETH` },
      ]
    : [];

  const bundleDetails: TxDetail[] = pendingBundle
    ? [
        { label: "Pack", value: pendingBundle.name },
        { label: "Price", value: `$${pendingBundle.priceUsd}`, accent: true },
        ...(formatEth(pendingBundle.priceUsd, ethUsd) ? [{ label: "ETH Amount", value: formatEth(pendingBundle.priceUsd, ethUsd)! }] : []),
      ]
    : [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-12 relative z-10">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl flex items-center gap-3" style={{ ...BANGERS, color: accent }}>
            <Sparkles className="w-8 h-8" style={{ color: accent }} />
            Packs &amp; We Smackz
          </h1>
          <p className="text-base mt-2" style={{ color: "hsl(var(--muted-foreground))" }}>
            Buy We Smackz with a fixed USD value, or grab a pack of traits straight into your Trait Locker.
          </p>
        </div>

        <div
          className="flex items-center gap-3 px-5 py-3 rounded-xl flex-shrink-0"
          style={{ background: gradient, border: `1px solid ${accent}55`, boxShadow: `0 0 14px ${glow}` }}
        >
          <SmackzCoin size={28} />
          <div>
            <div className="text-xs uppercase tracking-widest" style={{ color: "hsl(var(--muted-foreground))" }}>Your Balance</div>
            <div className="text-2xl font-bold" style={{ ...BANGERS, color: accent }}>
              {isConnected ? totalPoints.toLocaleString() : "—"} We Smackz
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
        <h2 className="text-2xl flex items-center gap-2" style={{ ...BANGERS, color: accent }}>
          <SmackzCoin size={24} /> We Smackz Packs
        </h2>
        {loadingPacks ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
          </div>
        ) : pointPacks.length === 0 ? (
          <p className="text-base" style={{ color: "hsl(var(--muted-foreground))" }}>No We Smackz packs available right now.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {pointPacks.map((pack) => (
              <Card key={pack.id} className="item-glow-gold overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-3">
                    {pack.imageUrl ? (
                      <TraitImageZoom url={pack.imageUrl} alt={pack.name} className="w-14 h-14 rounded-md flex-shrink-0">
                        <img src={pack.imageUrl} alt={pack.name} className="w-14 h-14 rounded-md object-cover" />
                      </TraitImageZoom>
                    ) : (
                      <Coins className="w-8 h-8" style={{ color: accent }} />
                    )}
                    <span className="truncate">{pack.name}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {pack.description && <p className="text-sm line-clamp-2" style={{ color: "hsl(var(--muted-foreground))" }}>{pack.description}</p>}
                  <div
                    className="rounded-lg p-4 flex items-center justify-between gap-3"
                    style={{ background: `${accent}14`, border: `1px solid ${accent}30` }}
                  >
                    <div>
                      <div className="text-xs uppercase tracking-widest mb-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>You get</div>
                      <div className="text-4xl leading-none" style={{ ...BANGERS, color: accent }}>
                        {pack.pointsGranted.toLocaleString()}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>We Smackz</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase tracking-widest mb-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>Price</div>
                      <div className="text-3xl font-bold leading-none">${pack.usdValue}</div>
                      <div className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>USD</div>
                    </div>
                  </div>
                  <Button
                    className="w-full gap-1.5"
                    size="lg"
                    disabled={ethUsd === null}
                    onClick={() => {
                      if (!isConnected) { connect(); return; }
                      setPendingPack(pack);
                    }}
                  >
                    <Zap className="w-4 h-4" /> Buy We Smackz
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Bundles ── */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-2xl flex items-center gap-2" style={{ ...BANGERS, color: accent }}>
            <Package className="w-6 h-6" /> Trait Packs
          </h2>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={traitSearch}
              onChange={(e) => setTraitSearch(e.target.value)}
              placeholder="Search traits or packs..."
              className="pl-9 pr-9"
            />
            {traitSearch && (
              <button
                type="button"
                onClick={() => setTraitSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        {loadingBundles ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-96 rounded-xl" />)}
          </div>
        ) : bundles.length === 0 ? (
          <p className="text-base" style={{ color: "hsl(var(--muted-foreground))" }}>No packs available right now.</p>
        ) : filteredBundles.length === 0 ? (
          <p className="text-base" style={{ color: "hsl(var(--muted-foreground))" }}>No packs match "{traitSearch}".</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {filteredBundles.map((bundle) => {
              const soldOut = bundle.totalSupply !== -1 && bundle.remainingSupply < 1;
              return (
                <Card key={bundle.id} className="item-glow-gold overflow-hidden flex flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl flex items-center gap-2.5">
                      <Gem className="w-6 h-6" style={{ color: accent }} />
                      <span className="truncate">{bundle.name}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 flex-1 flex flex-col">
                    {bundle.description && <p className="text-sm line-clamp-2" style={{ color: "hsl(var(--muted-foreground))" }}>{bundle.description}</p>}

                    <div className="text-xs uppercase tracking-widest" style={{ color: "hsl(var(--muted-foreground))" }}>
                      What's inside — {bundle.traits.length} trait{bundle.traits.length !== 1 ? "s" : ""}
                    </div>
                    <div className="space-y-3">
                      {groupTraitsByCategory(bundle.traits).map((group) => (
                        <div key={group.category} className="space-y-1.5">
                          <div
                            className="text-[11px] uppercase tracking-widest font-semibold flex items-center gap-1.5"
                            style={{ color: accent }}
                          >
                            {group.category}
                            <span
                              className="h-px flex-1"
                              style={{ background: `${accent}30` }}
                            />
                            <span style={{ color: "hsl(var(--muted-foreground))" }}>{group.traits.length}</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {group.traits.map((t) => (
                              <div key={t.id} className="flex flex-col items-center gap-1.5">
                                <div
                                  className="w-full aspect-square rounded-lg overflow-hidden border-2 flex-shrink-0"
                                  style={{ borderColor: `${accent}40` }}
                                >
                                  <TraitImageZoom url={t.imageUrl} mediaType={t.mediaType} alt={t.name} className="w-full h-full">
                                    <TraitMedia url={t.imageUrl} mediaType={t.mediaType} alt={t.name} className="w-full h-full object-cover" />
                                  </TraitImageZoom>
                                </div>
                                <span className="text-xs text-center truncate w-full" style={{ color: "hsl(var(--muted-foreground))" }} title={t.name}>
                                  {t.name}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div
                      className="mt-auto rounded-lg p-4 flex items-center justify-between gap-3"
                      style={{ background: `${accent}14`, border: `1px solid ${accent}30` }}
                    >
                      <div>
                        <div className="text-xs uppercase tracking-widest mb-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>Price</div>
                        <div className="text-3xl leading-none" style={{ ...BANGERS, color: accent }}>
                          ${bundle.priceUsd}
                        </div>
                        {formatEth(bundle.priceUsd, ethUsd) && (
                          <div className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>≈ {formatEth(bundle.priceUsd, ethUsd)}</div>
                        )}
                      </div>
                      {bundle.totalSupply !== -1 && (
                        <div className="text-right">
                          <div className="text-xs uppercase tracking-widest mb-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>Remaining</div>
                          <div className="text-2xl font-bold leading-none">{bundle.remainingSupply} / {bundle.totalSupply}</div>
                        </div>
                      )}
                    </div>
                    <Button
                      className="w-full gap-1.5"
                      size="lg"
                      disabled={soldOut}
                      onClick={() => {
                        if (!isConnected) { connect(); return; }
                        setPendingBundle(bundle);
                      }}
                    >
                      <Zap className="w-4 h-4" /> {soldOut ? "Sold Out" : "Buy Pack"}
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
        title="Buy We Smackz"
        description="We Smackz are credited to your wallet immediately after purchase."
        details={packDetails}
        onConfirm={handlePackConfirm}
        isPending={purchasePointPack.isPending}
        confirmLabel="Buy We Smackz"
      />

      <TxConfirmModal
        open={!!pendingBundle}
        onOpenChange={(open) => !open && setPendingBundle(null)}
        title="Buy Trait Pack"
        description="All traits in this pack will be added directly to your Trait Locker."
        details={bundleDetails}
        onConfirm={handleBundleConfirm}
        isPending={purchaseBundle.isPending}
        confirmLabel="Buy Pack"
      />
    </div>
  );
}
