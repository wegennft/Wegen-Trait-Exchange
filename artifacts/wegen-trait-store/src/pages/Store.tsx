import { useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import {
  useListTraits,
  useListTraitCategories,
  useListStoreThemes,
  usePurchaseTrait,
  useGetStoreStats,
  useGetUserNfts,
  getListTraitsQueryKey,
  getGetStoreStatsQueryKey,
  getGetUserNftsQueryKey,
} from "@workspace/api-client-react";
import type { Trait, WegenNft } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Coins,
  TrendingUp,
  Users,
  Package,
  Layers,
  ShoppingBag,
  Eye,
  ChevronDown,
  ChevronUp,
  Gem,
  Sparkles,
  Wallet,
} from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────

const BANGERS = { fontFamily: "'Bangers', Impact, sans-serif", letterSpacing: "0.08em" };

function getRarityColor(rarity: string) {
  switch (rarity) {
    case "legendary":
      return "bg-yellow-500/20 text-yellow-500 border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.5)]";
    case "rare":
      return "bg-blue-500/20 text-blue-500 border-blue-500/50";
    case "uncommon":
      return "bg-green-500/20 text-green-500 border-green-500/50";
    default:
      return "bg-gray-500/20 text-gray-400 border-gray-500/50";
  }
}

function getRarityGlow(rarity: string) {
  switch (rarity) {
    case "legendary": return "shadow-[0_0_30px_rgba(234,179,8,0.35)]";
    case "rare": return "shadow-[0_0_24px_rgba(59,130,246,0.3)]";
    case "uncommon": return "shadow-[0_0_18px_rgba(34,197,94,0.25)]";
    default: return "";
  }
}

// ── NFT Preview Banner ────────────────────────────────────────────────────────

function NftPreviewBanner({
  walletAddress,
  isConnected,
  connect,
  previewTrait,
}: {
  walletAddress: string | null;
  isConnected: boolean;
  connect: () => void;
  previewTrait: Trait | null;
}) {
  const [previewNft, setPreviewNft] = useState<WegenNft | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const { data: nftsData, isLoading } = useGetUserNfts(walletAddress ?? "", {
    query: {
      enabled: !!walletAddress,
      queryKey: getGetUserNftsQueryKey(walletAddress ?? ""),
    },
  });

  const nfts = nftsData?.nfts ?? [];

  useEffect(() => {
    if (nfts.length > 0 && !previewNft) {
      setPreviewNft(nfts[0]);
    }
  }, [nfts]);

  useEffect(() => {
    setPreviewNft(null);
  }, [walletAddress]);

  return (
    <div
      className="rounded-xl border border-primary/40 bg-card/60 overflow-hidden"
      style={{ boxShadow: "0 0 0 1px hsl(var(--primary) / 0.15) inset" }}
    >
      {/* ── Header ── */}
      <button
        type="button"
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-3 bg-primary/5 hover:bg-primary/10 transition-colors border-b border-primary/20"
      >
        <Eye className="w-4 h-4 text-primary flex-shrink-0" />
        <span style={BANGERS} className="text-lg text-primary tracking-widest">
          NFT PREVIEW
        </span>
        <span className="text-xs text-muted-foreground/60 ml-1 font-mono hidden sm:inline">
          — hover any trait to preview on your Wegen
        </span>
        <span className="ml-auto text-muted-foreground/50">
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </span>
      </button>

      {/* ── Body ── */}
      {!collapsed && (
        <div className="p-5">
          {/* Not connected */}
          {!isConnected ? (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-6 text-center">
              <div className="text-muted-foreground/60">
                <Wallet className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Connect your wallet to preview traits on your Wegen NFTs.</p>
              </div>
              <Button size="sm" onClick={connect} className="bg-primary text-white gap-2 flex-shrink-0">
                <Wallet className="w-3.5 h-3.5" />
                Connect Wallet
              </Button>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-3 text-sm text-muted-foreground">Loading your Wegens…</span>
            </div>
          ) : nfts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground/50">
              <Gem className="w-10 h-10 opacity-30" />
              <p className="text-sm">No Wegen NFTs found in your wallet.</p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-6">
              {/* ── Left: preview canvas ── */}
              <div className="flex flex-col items-center gap-3 flex-shrink-0">
                {/* Main preview */}
                <div
                  className={`relative w-52 h-52 sm:w-60 sm:h-60 rounded-xl overflow-hidden bg-secondary/40 border-2 transition-all duration-300 ${
                    previewTrait
                      ? `border-primary ${getRarityGlow(previewTrait.rarity)}`
                      : "border-border/40"
                  }`}
                >
                  {/* Base NFT image */}
                  {previewNft?.imageUrl ? (
                    <img
                      src={previewNft.imageUrl}
                      alt={previewNft.name}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Gem className="w-20 h-20 text-muted-foreground/20" />
                    </div>
                  )}

                  {/* Currently equipped trait overlays (shown when nothing is being previewed) */}
                  {previewNft && !previewTrait &&
                    previewNft.equippedTraits.map(et =>
                      et.trait.imageUrl ? (
                        <img
                          key={et.category}
                          src={et.trait.imageUrl}
                          alt={et.trait.name}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : null,
                    )}

                  {/* Previewed trait overlay */}
                  {previewTrait?.imageUrl && (
                    <img
                      src={previewTrait.imageUrl}
                      alt={previewTrait.name}
                      className="absolute inset-0 w-full h-full object-cover animate-in fade-in duration-150"
                    />
                  )}

                  {/* Token ID */}
                  {previewNft && (
                    <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md rounded px-2 py-0.5 text-[10px] font-mono text-white/80 border border-white/10">
                      #{previewNft.tokenId}
                    </div>
                  )}

                  {/* Preview label */}
                  {previewTrait && (
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-primary flex-shrink-0" />
                        <span className="text-[11px] text-white font-semibold truncate">{previewTrait.name}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* NFT selector (multiple NFTs) */}
                {nfts.length > 1 && (
                  <div className="flex gap-1.5 flex-wrap justify-center max-w-[240px]">
                    {nfts.map(nft => (
                      <button
                        key={nft.tokenId}
                        type="button"
                        onClick={() => setPreviewNft(nft)}
                        title={nft.name}
                        className={`w-10 h-10 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
                          previewNft?.tokenId === nft.tokenId
                            ? "border-primary shadow-[0_0_8px_rgba(157,0,255,0.5)]"
                            : "border-border/30 opacity-50 hover:opacity-90 hover:border-border"
                        }`}
                      >
                        {nft.imageUrl ? (
                          <img src={nft.imageUrl} alt={nft.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-secondary/50 flex items-center justify-center">
                            <span className="text-[8px] font-bold text-muted-foreground">#{nft.tokenId}</span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Right: info ── */}
              <div className="flex-1 flex flex-col gap-4 min-w-0">
                {/* NFT name */}
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold mb-0.5">
                    Selected NFT
                  </div>
                  <div style={BANGERS} className="text-2xl text-foreground leading-tight">
                    {previewNft?.name ?? "Select a Wegen"}
                  </div>
                </div>

                {/* Equipped traits */}
                {previewNft && previewNft.equippedTraits.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold mb-2">
                      Equipped Traits
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {previewNft.equippedTraits.map(et => (
                        <div
                          key={et.category}
                          className={`flex items-center gap-1.5 rounded px-2 py-1 border text-[11px] transition-all duration-200 ${
                            previewTrait?.category === et.category
                              ? "bg-orange-500/15 border-orange-400/40 text-orange-300"
                              : "bg-secondary/40 border-border/40"
                          }`}
                        >
                          {et.trait.imageUrl ? (
                            <img
                              src={et.trait.imageUrl}
                              alt={et.trait.name}
                              className="w-4 h-4 object-contain rounded-sm flex-shrink-0"
                            />
                          ) : (
                            <Package className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
                          )}
                          <span className="font-medium truncate max-w-[100px]">{et.trait.name}</span>
                          {previewTrait?.category === et.category && (
                            <span className="text-orange-400/80 text-[9px] font-bold ml-0.5 flex-shrink-0">→ replace</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Previewed trait detail / empty state */}
                {previewTrait ? (
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/25 space-y-3 animate-in fade-in duration-150">
                    <div className="text-[10px] uppercase tracking-widest text-primary/70 font-semibold flex items-center gap-1.5">
                      <Eye className="w-3 h-3" /> Previewing
                    </div>
                    <div className="flex items-start gap-3">
                      {previewTrait.imageUrl ? (
                        <img
                          src={previewTrait.imageUrl}
                          alt={previewTrait.name}
                          className="w-14 h-14 rounded-lg object-contain bg-secondary/40 p-1 border border-border/30 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-secondary/40 flex items-center justify-center flex-shrink-0 border border-border/30">
                          <Package className="w-6 h-6 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-base leading-tight mb-1.5">{previewTrait.name}</div>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1.5 py-0 uppercase tracking-wide ${getRarityColor(previewTrait.rarity)}`}
                          >
                            {previewTrait.rarity}
                          </Badge>
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 uppercase tracking-wide">
                            {previewTrait.category}
                          </Badge>
                          {previewTrait.theme && (
                            <Badge className="text-[9px] px-1.5 py-0 bg-primary/20 text-primary border-primary/30 uppercase tracking-wide">
                              {previewTrait.theme}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-primary font-bold text-sm">
                          <Coins className="w-3.5 h-3.5" />
                          {previewTrait.priceEth} ETH
                        </div>
                      </div>
                    </div>
                    {previewTrait.description && (
                      <p className="text-xs text-muted-foreground/80 line-clamp-2 italic">{previewTrait.description}</p>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center py-5 gap-2 text-muted-foreground/35 border border-dashed border-border/25 rounded-lg">
                    <Eye className="w-8 h-8" />
                    <p className="text-xs text-center leading-relaxed">
                      Hover any trait below<br />to see it on your Wegen
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Store Page ───────────────────────────────────────────────────────────

export function Store() {
  const [selectedTheme, setSelectedTheme] = useState<string | undefined>();
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [traitToBuy, setTraitToBuy] = useState<Trait | null>(null);
  const [previewTrait, setPreviewTrait] = useState<Trait | null>(null);

  const { walletAddress, isConnected, connect } = useWallet();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: storeStats } = useGetStoreStats();
  const { data: themesData } = useListStoreThemes();
  const { data: categoriesData, isLoading: isLoadingCategories } = useListTraitCategories();
  const { data: traitsData, isLoading: isLoadingTraits } = useListTraits(
    { category: selectedCategory, theme: selectedTheme },
    {
      query: {
        queryKey: getListTraitsQueryKey({ category: selectedCategory, theme: selectedTheme }),
      },
    },
  );

  const purchaseTrait = usePurchaseTrait({
    mutation: {
      onSuccess: () => {
        toast({
          title: "Purchase Successful",
          description: "The trait has been added to your locker.",
        });
        setTraitToBuy(null);
        queryClient.invalidateQueries({
          queryKey: getListTraitsQueryKey({ category: selectedCategory, theme: selectedTheme }),
        });
        queryClient.invalidateQueries({ queryKey: getGetStoreStatsQueryKey() });
      },
      onError: () => {
        toast({
          title: "Purchase Failed",
          description: "There was an error processing your transaction.",
          variant: "destructive",
        });
      },
    },
  });

  const handleBuyClick = (trait: Trait) => {
    if (!isConnected) {
      connect();
      return;
    }
    setTraitToBuy(trait);
  };

  const confirmPurchase = () => {
    if (!walletAddress || !traitToBuy) return;
    purchaseTrait.mutate({
      walletAddress,
      data: {
        traitId: traitToBuy.id,
        quantity: 1,
        txHash: `0xsimulated${Date.now()}`,
      },
    });
  };

  const handleThemeSelect = (theme: string | undefined) => {
    setSelectedTheme(theme);
    setSelectedCategory(undefined);
  };

  const themes = themesData?.themes ?? [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* ── Page header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1
            className="text-6xl text-primary mb-2"
            style={{
              fontFamily: "'Bangers', Impact, sans-serif",
              letterSpacing: "0.08em",
              textShadow: "4px 4px 0px rgba(0,0,0,0.9), 0 0 20px rgba(157,0,255,0.5)",
            }}
          >
            TRAIT{" "}
            <span
              style={{
                color: "hsl(43 100% 52%)",
                textShadow: "4px 4px 0px rgba(0,0,0,0.9), 0 0 20px rgba(255,200,0,0.5)",
              }}
            >
              STORE
            </span>
          </h1>
          <p className="text-muted-foreground font-mono text-sm max-w-2xl uppercase tracking-widest">
            // Acquire exclusive artifacts for your Wegen NFTs //
          </p>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/30 border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-primary/20 text-primary">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Traits</p>
              <p className="text-xl font-bold">{storeStats?.totalTraits || "..."}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/30 border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-accent/20 text-accent">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Purchases</p>
              <p className="text-xl font-bold">{storeStats?.totalPurchases || "..."}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/30 border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-blue-500/20 text-blue-500">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Holders</p>
              <p className="text-xl font-bold">{storeStats?.totalHolders || "..."}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/30 border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-green-500/20 text-green-500">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">24h Sales</p>
              <p className="text-xl font-bold">{storeStats?.recentPurchases || "..."}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── NFT Preview Banner ── */}
      <NftPreviewBanner
        walletAddress={walletAddress}
        isConnected={isConnected}
        connect={connect}
        previewTrait={previewTrait}
      />

      {/* ── Theme tabs ── */}
      {themes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-widest font-semibold px-0.5">
            <Layers className="w-3.5 h-3.5" />
            Collections
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleThemeSelect(undefined)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all border ${
                !selectedTheme
                  ? "bg-primary text-white border-primary shadow-[0_0_14px_rgba(157,0,255,0.4)]"
                  : "bg-transparent border-border/50 text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
              data-testid="theme-tab-all"
            >
              All Collections
            </button>
            {themes.map((theme) => (
              <button
                key={theme}
                onClick={() => handleThemeSelect(theme)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all border ${
                  selectedTheme === theme
                    ? "bg-primary text-white border-primary shadow-[0_0_14px_rgba(157,0,255,0.4)]"
                    : "bg-transparent border-border/50 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
                data-testid={`theme-tab-${theme}`}
              >
                {theme}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Category pills ── */}
      <div className="space-y-2">
        {themes.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-widest font-semibold px-0.5">
            <Package className="w-3.5 h-3.5" />
            {selectedTheme ? `${selectedTheme} — ` : ""}Layers
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={!selectedCategory ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(undefined)}
            className={!selectedCategory ? "bg-primary/80 text-white shadow-[0_0_10px_rgba(157,0,255,0.3)]" : ""}
          >
            All Layers
          </Button>
          {isLoadingCategories ? (
            <>
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-9 w-28" />
            </>
          ) : (
            categoriesData?.categories?.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
                className={`capitalize ${
                  selectedCategory === cat ? "bg-primary/80 text-white shadow-[0_0_10px_rgba(157,0,255,0.3)]" : ""
                }`}
              >
                {cat}
              </Button>
            ))
          )}
        </div>
      </div>

      {/* ── Trait grid ── */}
      {isLoadingTraits ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i} className="bg-card border-border/50 overflow-hidden">
              <Skeleton className="h-48 w-full rounded-none" />
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : traitsData?.traits?.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border/50 rounded-xl bg-card/30">
          <div className="w-16 h-16 rounded-full bg-secondary mx-auto flex items-center justify-center mb-4">
            <ShoppingBag className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold mb-2">No Traits Found</h3>
          <p className="text-muted-foreground">
            {selectedTheme && selectedCategory
              ? `No ${selectedCategory} traits in "${selectedTheme}".`
              : selectedTheme
              ? `No traits in the "${selectedTheme}" collection.`
              : selectedCategory
              ? `No traits available in the ${selectedCategory} category.`
              : "The store is currently empty."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {traitsData?.traits?.map((trait, index) => (
            <Card
              key={trait.id}
              className={`bg-card/50 border-border/50 overflow-hidden group transition-all duration-200 flex flex-col cursor-pointer ${
                previewTrait?.id === trait.id
                  ? "border-primary shadow-[0_0_22px_rgba(157,0,255,0.22)] scale-[1.015]"
                  : "hover:border-primary/50 hover:shadow-[0_0_20px_rgba(157,0,255,0.15)]"
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
              onMouseEnter={() => setPreviewTrait(trait)}
              onMouseLeave={() => setPreviewTrait(null)}
            >
              <div className="relative aspect-square overflow-hidden bg-secondary flex items-center justify-center p-6">
                {trait.imageUrl ? (
                  <img
                    src={trait.imageUrl}
                    alt={trait.name}
                    className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500 drop-shadow-2xl"
                  />
                ) : (
                  <div className="text-6xl font-black text-muted-foreground/20 uppercase tracking-tighter mix-blend-overlay">
                    {trait.category.slice(0, 3)}
                  </div>
                )}

                {/* Preview indicator */}
                {previewTrait?.id === trait.id && (
                  <div className="absolute top-2 left-2 flex items-center gap-1 bg-primary/90 text-white text-[10px] font-bold px-2 py-0.5 rounded animate-in fade-in duration-100">
                    <Eye className="w-2.5 h-2.5" />
                    PREVIEWING
                  </div>
                )}

                <div className="absolute top-3 right-3 flex flex-col gap-2">
                  <Badge
                    variant="outline"
                    className={`uppercase tracking-wider text-[10px] font-bold px-2 py-1 ${getRarityColor(trait.rarity)}`}
                  >
                    {trait.rarity}
                  </Badge>
                </div>
                <div className="absolute bottom-3 left-3 flex flex-col gap-1 items-start">
                  {trait.theme && (
                    <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30 text-[9px] uppercase tracking-wider font-bold">
                      {trait.theme}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="bg-black/50 backdrop-blur-md text-white border-none uppercase text-[10px]">
                    {trait.category}
                  </Badge>
                </div>
              </div>

              <CardContent className="p-5 flex-1 flex flex-col">
                <h3 className="text-xl font-bold mb-1 tracking-tight">{trait.name}</h3>
                {trait.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{trait.description}</p>
                )}
                <div className="mt-auto pt-4 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-primary font-bold">
                    <Coins className="w-4 h-4" />
                    <span>{trait.priceEth} ETH</span>
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">
                    {trait.remainingSupply} / {trait.totalSupply} left
                  </div>
                </div>
              </CardContent>

              <CardFooter className="p-0 border-t border-border/20">
                <Button
                  onClick={() => handleBuyClick(trait)}
                  disabled={!trait.isActive || trait.remainingSupply <= 0}
                  className="w-full rounded-none h-12 bg-transparent hover:bg-primary hover:text-white transition-colors"
                  variant="ghost"
                >
                  {trait.remainingSupply <= 0 ? "Sold Out" : "Purchase Trait"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* ── Purchase dialog ── */}
      <Dialog open={!!traitToBuy} onOpenChange={(open) => !open && setTraitToBuy(null)}>
        <DialogContent className="bg-card border-border/50 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Purchase</DialogTitle>
            <DialogDescription>
              You are about to purchase this trait using your connected wallet.
            </DialogDescription>
          </DialogHeader>

          {traitToBuy && (
            <div className="py-4">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary/50 border border-border/50 mb-4">
                <div className="w-16 h-16 rounded-md bg-secondary flex items-center justify-center p-2">
                  {traitToBuy.imageUrl ? (
                    <img src={traitToBuy.imageUrl} alt={traitToBuy.name} className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-xl font-black text-muted-foreground/50">{traitToBuy.category[0]}</div>
                  )}
                </div>
                <div>
                  <div className="font-bold">{traitToBuy.name}</div>
                  <div className="text-sm text-muted-foreground capitalize">
                    {traitToBuy.category} &bull; {traitToBuy.rarity}
                    {traitToBuy.theme && ` · ${traitToBuy.theme}`}
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <div className="font-bold text-primary">{traitToBuy.priceEth} ETH</div>
                </div>
              </div>

              <div className="bg-black/20 rounded-md p-3 text-xs text-muted-foreground space-y-2">
                <div className="flex justify-between">
                  <span>Wallet:</span>
                  <span className="font-mono">
                    {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
                  </span>
                </div>
                <div className="flex justify-between text-primary font-bold pt-2 border-t border-border/20">
                  <span>Total:</span>
                  <span>{traitToBuy.priceEth} ETH</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setTraitToBuy(null)} disabled={purchaseTrait.isPending}>
              Cancel
            </Button>
            <Button
              onClick={confirmPurchase}
              disabled={purchaseTrait.isPending}
              className="bg-primary text-white hover:bg-primary/90 shadow-[0_0_15px_rgba(157,0,255,0.4)]"
            >
              {purchaseTrait.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirming...
                </>
              ) : (
                "Confirm Purchase"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
