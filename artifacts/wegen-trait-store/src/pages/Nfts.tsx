import { useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useCollection } from "@/contexts/CollectionContext";
import { WalletConnectGuard } from "@/components/shared/WalletConnectGuard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useApplyTrait,
  useRemoveTrait,
  getGetUserNftsQueryKey,
  getGetLockerQueryKey,
} from "@workspace/api-client-react";
import { WegenNft, LockerItem } from "@workspace/api-client-react/src/generated/api.schemas";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Fingerprint,
  Gem,
  Plus,
  X,
  Loader2,
  Link2,
  CheckCircle2,
  Upload,
  Layers,
  ExternalLink,
} from "lucide-react";

export function Nfts() {
  const { collection, collectionLabel } = useCollection();
  return (
    <WalletConnectGuard
      message={`Connect your wallet to view and customize your ${collectionLabel} NFTs.`}
    >
      <NftsContent />
    </WalletConnectGuard>
  );
}

function NftsContent() {
  const [selectedNft, setSelectedNft] = useState<WegenNft | null>(null);
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>("all");

  const [saveDialogNft, setSaveDialogNft] = useState<WegenNft | null>(null);
  const [saveVariantPack, setSaveVariantPack] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveTxResult, setSaveTxResult] = useState<{
    txHash: string;
    tokenId: number;
  } | null>(null);

  const { walletAddress } = useWallet();
  const { collection, collectionLabel } = useCollection();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: nftsData, isLoading: isLoadingNfts } = useQuery({
    queryKey: [...getGetUserNftsQueryKey(walletAddress || ""), collection],
    enabled: !!walletAddress,
    queryFn: async () => {
      const res = await fetch(
        `/api/nfts/${walletAddress}?nftCollection=${encodeURIComponent(collection)}`,
      );
      if (!res.ok) throw new Error("Failed to fetch NFTs");
      return res.json() as Promise<{ nfts: (WegenNft & { metadataTxHash?: string | null; metadataUpdatedAt?: string | null; variantPack?: string | null })[] }>;
    },
  });

  const { data: lockerData, isLoading: isLoadingLocker } = useQuery({
    queryKey: [...getGetLockerQueryKey(walletAddress || ""), collection],
    enabled: !!walletAddress,
    queryFn: async () => {
      const res = await fetch(
        `/api/locker/${walletAddress}?nftCollection=${encodeURIComponent(collection)}`,
      );
      if (!res.ok) throw new Error("Failed to fetch locker");
      return res.json() as Promise<{ items: LockerItem[] }>;
    },
  });

  const { data: variantCollectionsData } = useQuery({
    queryKey: ["trait-variant-collections", collection],
    queryFn: async () => {
      const res = await fetch(
        `/api/traits/variant-collections?nftCollection=${encodeURIComponent(collection)}`,
      );
      if (!res.ok) return { collections: [] as string[] };
      return res.json() as Promise<{ collections: string[] }>;
    },
  });
  const variantPacks: string[] = variantCollectionsData?.collections ?? [];

  const applyTrait = useApplyTrait({
    mutation: {
      onSuccess: (_data, variables) => {
        const isReplacing = selectedNft?.equippedTraits.some((et) => {
          const item = lockerData?.items?.find(
            (i) => i.id === variables.data.lockerItemId,
          );
          return item && et.category === item.trait.category;
        });
        toast({
          title: isReplacing ? "Trait Swapped" : "Trait Equipped",
          description: isReplacing
            ? "The previous trait was returned to your locker."
            : "The trait has been equipped to your NFT.",
        });
        queryClient.invalidateQueries({
          queryKey: [...getGetUserNftsQueryKey(walletAddress || ""), collection],
        });
        queryClient.invalidateQueries({
          queryKey: [...getGetLockerQueryKey(walletAddress || ""), collection],
        });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to apply trait.",
          variant: "destructive",
        });
      },
    },
  });

  const removeTrait = useRemoveTrait({
    mutation: {
      onSuccess: () => {
        toast({
          title: "Trait Removed",
          description: "The trait has been returned to your locker.",
        });
        queryClient.invalidateQueries({
          queryKey: [...getGetUserNftsQueryKey(walletAddress || ""), collection],
        });
        queryClient.invalidateQueries({
          queryKey: [...getGetLockerQueryKey(walletAddress || ""), collection],
        });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to remove trait.",
          variant: "destructive",
        });
      },
    },
  });

  const handleApplyTrait = (lockerItem: LockerItem) => {
    if (!selectedNft || !walletAddress) return;
    applyTrait.mutate({
      tokenId: selectedNft.tokenId,
      data: { lockerItemId: lockerItem.id, walletAddress },
    });
  };

  const handleRemoveTrait = (
    nft: WegenNft,
    category: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    if (!walletAddress) return;
    removeTrait.mutate({ tokenId: nft.tokenId, data: { category, walletAddress } });
  };

  const openSaveDialog = (nft: WegenNft & { variantPack?: string | null }) => {
    setSaveDialogNft(nft);
    setSaveVariantPack(nft.variantPack ?? null);
    setSaveTxResult(null);
  };

  const handleSaveToChain = async () => {
    if (!saveDialogNft || !walletAddress) return;
    setIsSaving(true);
    try {
      const res = await fetch(
        `/api/nfts/${saveDialogNft.tokenId}/confirm-traits`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress,
            variantPack: saveVariantPack,
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Save failed");
      }
      const data = (await res.json()) as { txHash: string; tokenId: number };
      setSaveTxResult({ txHash: data.txHash, tokenId: data.tokenId });
      queryClient.invalidateQueries({
        queryKey: [...getGetUserNftsQueryKey(walletAddress), collection],
      });
      toast({
        title: "Saved to Chain",
        description: `Trait loadout confirmed. Tx: ${data.txHash.slice(0, 10)}…`,
      });
    } catch (err) {
      toast({
        title: "Save Failed",
        description: err instanceof Error ? err.message : "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const availableLockerItems =
    lockerData?.items?.filter((item) => item.equippedToTokenId === null) || [];
  const categories = Array.from(
    new Set(availableLockerItems.map((item) => item.trait.category)),
  );

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "legendary":
        return "text-yellow-500";
      case "rare":
        return "text-blue-500";
      case "uncommon":
        return "text-green-500";
      default:
        return "text-gray-400";
    }
  };

  const fmtDate = (iso: string | null | undefined) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">
          My {collectionLabel}
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          View your {collectionLabel} NFTs and customize them with traits from
          your locker.
        </p>
      </div>

      {isLoadingNfts ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-card border-border/50">
              <Skeleton className="h-[400px] w-full rounded-none" />
              <CardContent className="p-6">
                <Skeleton className="h-8 w-3/4 mb-4" />
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : nftsData?.nfts?.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-border/50 rounded-xl bg-card/90">
          <div className="w-20 h-20 rounded-full bg-secondary mx-auto flex items-center justify-center mb-6">
            <Gem className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-2xl font-bold mb-2">
            No {collectionLabel} Found
          </h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            We couldn't find any {collectionLabel} NFTs in your connected
            wallet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {nftsData?.nfts?.map((nft) => {
            const nftExt = nft as WegenNft & {
              metadataTxHash?: string | null;
              metadataUpdatedAt?: string | null;
              variantPack?: string | null;
            };
            const hasEquipped = nft.equippedTraits.length > 0;
            const isOnChain = !!nftExt.metadataTxHash;

            return (
              <Card
                key={nft.tokenId}
                className="bg-card/90 border-border/60 overflow-hidden flex flex-col group relative"
              >
                <div className="absolute top-4 left-4 z-10 flex gap-2">
                  <Badge
                    variant="secondary"
                    className="bg-black/60 backdrop-blur-md font-mono"
                  >
                    <Fingerprint className="w-3 h-3 mr-1" />#{nft.tokenId}
                  </Badge>
                  {isOnChain && (
                    <Badge className="bg-green-600/80 backdrop-blur-md text-white border-0 text-[10px]">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      On-Chain
                    </Badge>
                  )}
                </div>

                <div className="relative aspect-[3/4] bg-secondary/30 overflow-hidden p-6 flex flex-col items-center justify-center">
                  {nft.imageUrl ? (
                    <img
                      src={nft.imageUrl}
                      alt={nft.name}
                      className="absolute inset-0 w-full h-full object-cover z-0"
                    />
                  ) : (
                    <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-secondary to-background z-0 flex items-center justify-center">
                      <Gem className="w-24 h-24 text-muted-foreground/20" />
                    </div>
                  )}
                  <div className="relative z-10 w-full h-full flex flex-col justify-end gap-2 p-2">
                    {nft.equippedTraits.map((et) => (
                      <div
                        key={et.category}
                        className="bg-black/70 backdrop-blur-md rounded-md p-2 flex items-center gap-3 border border-white/10"
                      >
                        {et.trait.imageUrl ? (
                          <img
                            src={et.trait.imageUrl}
                            alt={et.trait.name}
                            className="w-8 h-8 object-contain rounded"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center text-xs font-bold uppercase">
                            {et.category[0]}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div
                            className={`text-xs font-bold truncate ${getRarityColor(et.trait.rarity)}`}
                          >
                            {et.trait.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            {et.category}
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                          onClick={(e) =>
                            handleRemoveTrait(nft, et.category, e)
                          }
                          disabled={removeTrait.isPending}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <CardContent className="p-6 flex flex-col flex-1 border-t border-border/50 bg-card">
                  <h3 className="text-2xl font-bold tracking-tight">
                    {nft.name}
                  </h3>

                  {isOnChain && (
                    <div className="mt-2 mb-4 flex items-center gap-2 text-xs text-muted-foreground font-mono">
                      <Link2 className="w-3 h-3 shrink-0 text-green-500" />
                      <span className="truncate">
                        {nftExt.metadataTxHash?.slice(0, 18)}…
                      </span>
                      {nftExt.metadataUpdatedAt && (
                        <span className="shrink-0">
                          {fmtDate(nftExt.metadataUpdatedAt)}
                        </span>
                      )}
                    </div>
                  )}

                  <div className={`mt-auto space-y-2 ${!isOnChain ? "mt-6" : ""}`}>
                    <Button
                      onClick={() => setSelectedNft(nft)}
                      className="w-full bg-secondary text-foreground hover:bg-primary hover:text-white transition-colors"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Equip Traits
                    </Button>

                    {hasEquipped && (
                      <Button
                        onClick={() => openSaveDialog(nftExt)}
                        variant="outline"
                        className="w-full border-green-500/50 text-green-400 hover:bg-green-500/10 hover:text-green-300 transition-colors"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {isOnChain ? "Update On-Chain Metadata" : "Save to Chain"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Equip Traits Dialog ───────────────────────────────────────────── */}
      <Dialog
        open={!!selectedNft}
        onOpenChange={(open) => !open && setSelectedNft(null)}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              Equip Traits to {selectedNft?.name}
            </DialogTitle>
            <DialogDescription>
              Select traits from your locker to equip. Replacing a category
              automatically returns the previous trait to your locker — nothing
              is ever lost.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col pt-4">
            <Tabs
              defaultValue="all"
              className="flex-1 flex flex-col h-full"
              value={activeCategoryTab}
              onValueChange={setActiveCategoryTab}
            >
              <TabsList className="w-full justify-start overflow-x-auto rounded-none border-b border-border bg-transparent p-0 h-auto hide-scrollbar">
                <TabsTrigger
                  value="all"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                >
                  All Traits
                </TabsTrigger>
                {categories.map((cat) => (
                  <TabsTrigger
                    key={cat}
                    value={cat}
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 capitalize"
                  >
                    {cat}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="flex-1 overflow-y-auto p-4 hide-scrollbar">
                {isLoadingLocker ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : availableLockerItems.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    You have no available {collectionLabel} traits in your
                    locker to equip.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {availableLockerItems
                      .filter(
                        (item) =>
                          activeCategoryTab === "all" ||
                          item.trait.category === activeCategoryTab,
                      )
                      .map((item) => {
                        const isCategoryOccupied =
                          selectedNft?.equippedTraits.some(
                            (et) => et.category === item.trait.category,
                          );
                        const isPending =
                          applyTrait.isPending &&
                          applyTrait.variables?.data.lockerItemId === item.id;
                        return (
                          <div
                            key={item.id}
                            className="border border-border/50 rounded-lg bg-secondary/20 overflow-hidden flex flex-col group hover:border-primary/50 transition-colors"
                          >
                            <div className="aspect-square p-4 flex items-center justify-center bg-secondary/40 relative">
                              {item.trait.imageUrl ? (
                                <img
                                  src={item.trait.imageUrl}
                                  alt={item.trait.name}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <div className="text-4xl font-black text-muted-foreground/20 uppercase tracking-tighter mix-blend-overlay">
                                  {item.trait.category.slice(0, 3)}
                                </div>
                              )}
                              <Badge
                                variant="outline"
                                className={`absolute top-2 right-2 text-[8px] uppercase px-1 py-0 ${getRarityColor(item.trait.rarity)} border-current`}
                              >
                                {item.trait.rarity}
                              </Badge>
                            </div>
                            <div className="p-3 flex-1 flex flex-col">
                              <div className="font-bold text-sm mb-1 truncate">
                                {item.trait.name}
                              </div>
                              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                                {item.trait.category}
                              </div>
                              <Button
                                size="sm"
                                className={`w-full mt-auto ${isCategoryOccupied ? "bg-orange-500 hover:bg-orange-600 text-white" : "bg-primary hover:bg-primary/90 text-white"}`}
                                onClick={() => handleApplyTrait(item)}
                                disabled={isPending || applyTrait.isPending}
                              >
                                {isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : isCategoryOccupied ? (
                                  "Replace"
                                ) : (
                                  "Equip"
                                )}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Save to Chain Dialog ──────────────────────────────────────────── */}
      <Dialog
        open={!!saveDialogNft}
        onOpenChange={(open) => {
          if (!open) {
            setSaveDialogNft(null);
            setSaveTxResult(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Upload className="w-5 h-5 text-green-400" />
              {saveTxResult
                ? "Metadata Saved to Chain"
                : `Save ${saveDialogNft?.name} to Chain`}
            </DialogTitle>
            <DialogDescription>
              {saveTxResult
                ? "Your NFT's on-chain metadata has been updated with the current trait loadout."
                : "This will update your NFT's on-chain metadata URI with the current trait loadout and chosen skin variant."}
            </DialogDescription>
          </DialogHeader>

          {saveTxResult ? (
            /* ── Success State ── */
            <div className="space-y-4 pt-2">
              <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-5 space-y-3">
                <div className="flex items-center gap-2 text-green-400 font-bold text-lg">
                  <CheckCircle2 className="w-5 h-5" />
                  Transaction Confirmed
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Tx Hash
                  </div>
                  <div className="font-mono text-xs break-all text-foreground/80">
                    {saveTxResult.txHash}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Metadata URL
                  </div>
                  <a
                    href={`/api/metadata/${collection}/${saveTxResult.tokenId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-primary hover:underline break-all flex items-center gap-1"
                  >
                    /api/metadata/{collection}/{saveTxResult.tokenId}
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <a
                  href={`/api/metadata/${collection}/${saveTxResult.tokenId}/image`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" className="w-full">
                    <Layers className="w-4 h-4 mr-2" />
                    View Composited Image
                  </Button>
                </a>
                <Button
                  onClick={() => {
                    setSaveDialogNft(null);
                    setSaveTxResult(null);
                  }}
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            /* ── Pre-Save State ── */
            <div className="space-y-5 pt-2">
              {/* Composited image preview */}
              {saveDialogNft && (
                <div className="rounded-xl overflow-hidden border border-border/50 bg-secondary/20 aspect-square max-h-48 flex items-center justify-center mx-auto w-48">
                  <img
                    key={`${saveDialogNft.tokenId}-${saveVariantPack}`}
                    src={`/api/metadata/${collection}/${saveDialogNft.tokenId}/image`}
                    alt="Composited NFT preview"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}

              {/* Equipped traits summary */}
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-semibold">
                  Traits to Confirm ({saveDialogNft?.equippedTraits.length})
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto hide-scrollbar">
                  {saveDialogNft?.equippedTraits.map((et) => (
                    <div
                      key={et.category}
                      className="flex items-center gap-3 rounded-lg bg-secondary/30 p-2"
                    >
                      {et.trait.imageUrl ? (
                        <img
                          src={et.trait.imageUrl}
                          alt={et.trait.name}
                          className="w-7 h-7 object-contain rounded"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded bg-white/10 flex items-center justify-center text-[10px] font-bold uppercase">
                          {et.category[0]}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-sm font-bold truncate ${getRarityColor(et.trait.rarity)}`}
                        >
                          {et.trait.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase">
                          {et.category}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Variant pack selector */}
              {variantPacks.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-semibold">
                    Skin Variant to Save
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSaveVariantPack(null)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                        saveVariantPack === null
                          ? "border-primary bg-primary/20 text-primary"
                          : "border-border/50 bg-secondary/20 text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      Original
                    </button>
                    {variantPacks.map((pack) => (
                      <button
                        key={pack}
                        onClick={() => setSaveVariantPack(pack)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                          saveVariantPack === pack
                            ? "border-primary bg-primary/20 text-primary"
                            : "border-border/50 bg-secondary/20 text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {pack}
                      </button>
                    ))}
                  </div>
                  {saveVariantPack && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      The <span className="text-foreground font-semibold">{saveVariantPack}</span> variant images will be used when compositing your on-chain metadata image.
                    </p>
                  )}
                </div>
              )}

              {/* Warning / info */}
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-200/80">
                This is a simulated transaction. In production, this would sign
                an on-chain metadata update via your connected wallet.
              </div>

              <Button
                onClick={handleSaveToChain}
                disabled={isSaving || !saveDialogNft?.equippedTraits.length}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold text-base h-12"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Signing Transaction…
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 mr-2" />
                    Sign &amp; Save to Chain
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
