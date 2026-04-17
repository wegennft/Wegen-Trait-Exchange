import { useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import {
  useListTraits,
  useListTraitCategories,
  useListStoreThemes,
  usePurchaseTrait,
  useGetStoreStats,
  getListTraitsQueryKey,
  getGetStoreStatsQueryKey,
} from "@workspace/api-client-react";
import type { Trait } from "@workspace/api-client-react";
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
} from "lucide-react";

export function Store() {
  const [selectedTheme, setSelectedTheme] = useState<string | undefined>();
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [traitToBuy, setTraitToBuy] = useState<Trait | null>(null);

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

  const getRarityColor = (rarity: string) => {
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
  };

  const themes = themesData?.themes ?? [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent mb-2">
            Trait Store
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Acquire exclusive artifacts for your Wegen NFTs. Filter by collection or category.
          </p>
        </div>
      </div>

      {/* Stats */}
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

      {/* ── Theme tabs (only shown when themes exist) ──────────────────── */}
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

      {/* ── Category pills ──────────────────────────────────────────────── */}
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
            className={
              !selectedCategory
                ? "bg-primary/80 text-white shadow-[0_0_10px_rgba(157,0,255,0.3)]"
                : ""
            }
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
                  selectedCategory === cat
                    ? "bg-primary/80 text-white shadow-[0_0_10px_rgba(157,0,255,0.3)]"
                    : ""
                }`}
              >
                {cat}
              </Button>
            ))
          )}
        </div>
      </div>

      {/* ── Trait grid ─────────────────────────────────────────────────── */}
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
              className="bg-card/50 border-border/50 overflow-hidden group hover:border-primary/50 transition-all duration-300 hover:shadow-[0_0_20px_rgba(157,0,255,0.15)] flex flex-col"
              style={{ animationDelay: `${index * 50}ms` }}
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
                    <Badge
                      variant="secondary"
                      className="bg-primary/20 text-primary border-primary/30 text-[9px] uppercase tracking-wider font-bold"
                    >
                      {trait.theme}
                    </Badge>
                  )}
                  <Badge
                    variant="secondary"
                    className="bg-black/50 backdrop-blur-md text-white border-none uppercase text-[10px]"
                  >
                    {trait.category}
                  </Badge>
                </div>
              </div>

              <CardContent className="p-5 flex-1 flex flex-col">
                <h3 className="text-xl font-bold mb-1 tracking-tight">{trait.name}</h3>
                {trait.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {trait.description}
                  </p>
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

      {/* Purchase dialog */}
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
                    <img
                      src={traitToBuy.imageUrl}
                      alt={traitToBuy.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-xl font-black text-muted-foreground/50">
                      {traitToBuy.category[0]}
                    </div>
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
            <Button
              variant="outline"
              onClick={() => setTraitToBuy(null)}
              disabled={purchaseTrait.isPending}
            >
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
