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
import type { WegenNft, LockerItem } from "@workspace/api-client-react";
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
  Layers,
  ExternalLink,
  Zap,
  Shield,
  ChevronRight,
  Crown,
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
  // Page-level variant preview — controls which version is shown on all cards
  const [previewVariant, setPreviewVariant] = useState<string | null>(null);

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

  const { data: feeData } = useQuery({
    queryKey: ["admin-fees-public", collection],
    queryFn: async () => {
      const res = await fetch(`/api/admin/fees?nftCollection=${encodeURIComponent(collection)}`);
      if (!res.ok) return null;
      return res.json() as Promise<{ onChainUpdateFeeEth: string; onChainUpdateFeeWallet: string | null }>;
    },
    staleTime: 1000 * 60 * 5,
  });
  const onChainFeeEth = parseFloat(feeData?.onChainUpdateFeeEth ?? "0") || 0;

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

  // Fetch variantMap (traitId → variant imageUrl) for equipped trait thumbnail swaps
  const { data: previewVariantData, isLoading: isLoadingPreview } = useQuery({
    queryKey: ["trait-variants-preview", previewVariant, collection],
    enabled: !!previewVariant,
    queryFn: async () => {
      const res = await fetch(
        `/api/traits/variants/by-collection?name=${encodeURIComponent(previewVariant!)}&nftCollection=${encodeURIComponent(collection)}`,
      );
      type VariantEntry = { imageUrl: string | null; mediaType: string };
      type VariantData = { variantMap: Record<string, VariantEntry>; nameMap: Record<string, unknown> };
      if (!res.ok) return { variantMap: {}, nameMap: {} } as VariantData;
      return res.json() as Promise<VariantData>;
    },
  });
  // variantMap keyed by traitId string → variant imageUrl for equipped trait thumbnails
  const previewVariantMap: Record<string, { imageUrl: string | null }> =
    (previewVariantData?.variantMap ?? {}) as Record<string, { imageUrl: string | null }>;

  // For the card's main image: when a variant is selected, composite the variant versions of
  // the NFT's on-chain trait layers via the server-side preview endpoint. Falls back to the
  // original imageUrl if no on-chain attributes are available.
  const getCardImageUrl = (nft: { imageUrl?: string | null; onChainAttributes?: { trait_type: string; value: string }[] }) => {
    if (!previewVariant) return nft.imageUrl ?? null;
    const attrs = (nft.onChainAttributes ?? []).filter((a) => a.trait_type.toLowerCase() !== "origin" && a.trait_type.toLowerCase() !== "seasoned wegen" && a.trait_type.toLowerCase() !== "legend" && a.trait_type.toLowerCase() !== "ultra rare");
    const attrsParam = attrs.map((a) => `${a.trait_type}:${a.value}`).join("|");
    const base = nft.imageUrl ? `&baseImageUrl=${encodeURIComponent(nft.imageUrl)}` : "";
    // Always call the endpoint even with no attrs so the base image is returned resized
    if (attrs.length === 0 && !nft.imageUrl) return null;
    return `/api/traits/variant-preview-image?variant=${encodeURIComponent(previewVariant)}&nftCollection=${encodeURIComponent(collection)}&attrs=${encodeURIComponent(attrsParam || "_")}${base}`;
  };

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
    // Pre-populate from the page-level preview selection, falling back to the NFT's saved pack
    setSaveVariantPack(previewVariant ?? nft.variantPack ?? null);
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
              <Skeleton className="aspect-square w-full rounded-none" />
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
      ) : !nftsData?.nfts?.length ? (
        <div className="text-center py-24 border border-dashed border-border/50 rounded-xl bg-card/90">
          <div className="w-20 h-20 rounded-full bg-secondary mx-auto flex items-center justify-center mb-6">
            <Gem className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-2xl font-bold mb-2">No NFTs Found</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            We couldn't find any Wegen NFTs in your connected wallet.
          </p>
        </div>
      ) : (() => {
        const allNfts = nftsData.nfts;
        const wegens = allNfts.filter(n => !n.isWegenette);
        const wegenettes = allNfts.filter(n => n.isWegenette);

        const renderGrid = (nfts: typeof allNfts) => (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {nfts.map((nft) => {
            const nftExt = nft as WegenNft & {
              metadataTxHash?: string | null;
              metadataUpdatedAt?: string | null;
              variantPack?: string | null;
            };
            const hasEquipped = nft.equippedTraits.length > 0;
            const isOnChain = !!nftExt.metadataTxHash;
            const isLegend = !!nft.isLegend;

            return (
              <Card
                key={nft.tokenId}
                className="bg-card/90 border-border/60 overflow-hidden flex flex-col group relative"
              >
                <div className="absolute top-4 left-4 z-10 flex gap-2 flex-wrap">
                  <Badge
                    variant="secondary"
                    className="bg-black/60 backdrop-blur-md font-mono"
                  >
                    <Fingerprint className="w-3 h-3 mr-1" />#{nft.tokenId}
                  </Badge>
                  {isLegend && (
                    <Badge
                      className="backdrop-blur-md text-[10px] border font-bold tracking-wider"
                      style={{
                        background: 'linear-gradient(135deg, rgba(234,179,8,0.9), rgba(245,158,11,0.8))',
                        borderColor: 'rgba(234,179,8,0.7)',
                        color: '#000',
                        boxShadow: '0 0 12px rgba(234,179,8,0.5)',
                      }}
                    >
                      <Crown className="w-3 h-3 mr-1 fill-current" />
                      Legend
                    </Badge>
                  )}
                  {isOnChain && (
                    <Badge
                      className="backdrop-blur-md text-[10px] border font-bold tracking-wider"
                      style={{
                        background: 'linear-gradient(135deg, rgba(234,179,8,0.85), rgba(245,158,11,0.75))',
                        borderColor: 'rgba(234,179,8,0.6)',
                        color: '#000',
                        boxShadow: '0 0 10px rgba(234,179,8,0.4)',
                      }}
                    >
                      <Zap className="w-3 h-3 mr-1 fill-current" />
                      SOC'd
                    </Badge>
                  )}
                </div>

                <div className="relative aspect-square bg-secondary/30 overflow-hidden">
                  {isLoadingPreview && previewVariant && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
                      <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
                    </div>
                  )}
                  {(() => {
                    const cardImg = getCardImageUrl(nft);
                    return cardImg ? (
                      <img
                        src={cardImg}
                        alt={nft.name}
                        className="absolute inset-0 w-full h-full object-contain z-0"
                      />
                    ) : (
                      <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-secondary to-background z-0 flex items-center justify-center">
                        <Gem className="w-24 h-24 text-muted-foreground/20" />
                      </div>
                    );
                  })()}
                  {/* Variant badge overlay */}
                  {previewVariant && (
                    <div className="absolute bottom-2 left-2 z-20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded"
                      style={{ background: 'rgba(255,200,0,0.85)', color: '#000', fontFamily: "'Bungee', Impact, sans-serif" }}>
                      {previewVariant}
                    </div>
                  )}
                </div>

                <CardContent className="p-6 flex flex-col flex-1 border-t border-border/50 bg-card">
                  <h3 className="text-2xl font-bold tracking-tight">
                    {nft.name}
                  </h3>

                  {isOnChain && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground font-mono">
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

                  {/* On-chain attributes (native NFT traits) */}
                  {(() => {
                    const attrs = ((nft as { onChainAttributes?: { trait_type: string; value: string }[] }).onChainAttributes ?? [])
                      .filter(a => a.trait_type.toLowerCase() !== 'origin');
                    if (attrs.length === 0) return null;
                    return (
                      <div className="mt-4">
                        <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-2">Traits</p>
                        <div className="grid grid-cols-2 gap-1">
                          {attrs.map(attr => (
                            <div key={attr.trait_type}
                              className="rounded px-2 py-1 flex flex-col min-w-0"
                              style={{ background: 'rgba(157,0,255,0.07)', border: '1px solid rgba(157,0,255,0.15)' }}>
                              <span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-wider truncate leading-tight">
                                {attr.trait_type}
                              </span>
                              <span className="text-[11px] font-semibold text-foreground/90 truncate leading-snug">
                                {attr.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Equipped locker traits */}
                  {nft.equippedTraits.length > 0 && (
                    <div className="mt-4 space-y-1.5">
                      <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">
                        Equipped Traits
                      </p>
                      {nft.equippedTraits.map((et) => (
                        <div
                          key={et.category}
                          className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 bg-secondary/40 border border-border/40"
                        >
                          {(() => {
                            const variantImg = previewVariant
                              ? (previewVariantMap[String(et.trait.id)]?.imageUrl ?? null)
                              : null;
                            const src = variantImg ?? et.trait.imageUrl;
                            return src ? (
                              <img
                                src={src}
                                alt={et.trait.name}
                                className="w-7 h-7 object-contain rounded shrink-0"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded bg-secondary flex items-center justify-center text-xs font-bold uppercase shrink-0">
                                {et.category[0]}
                              </div>
                            );
                          })()}
                          <div className="flex-1 min-w-0">
                            <div className={`text-xs font-semibold truncate ${getRarityColor(et.trait.rarity)}`}>
                              {et.trait.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                              {et.category}
                            </div>
                          </div>
                          {!isLegend && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                              onClick={(e) => handleRemoveTrait(nft, et.category, e)}
                              disabled={removeTrait.isPending}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto pt-4 space-y-2">
                    {isLegend ? (
                      <div
                        className="w-full flex items-center justify-center gap-2 rounded-md px-4 py-2 text-xs text-amber-300/70 border"
                        style={{
                          borderColor: 'rgba(234,179,8,0.25)',
                          background: 'linear-gradient(135deg, rgba(234,179,8,0.06), rgba(245,158,11,0.03))',
                          fontFamily: "'Bungee', Impact, sans-serif",
                          letterSpacing: '0.06em',
                        }}
                      >
                        <Crown className="w-3.5 h-3.5 text-amber-400/60 fill-amber-400/30" />
                        Legend — Variant Only
                      </div>
                    ) : (
                      <Button
                        onClick={() => setSelectedNft(nft)}
                        className="w-full bg-secondary text-foreground hover:bg-primary hover:text-white transition-colors"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Equip Traits
                      </Button>
                    )}

                    {/* SOC — Save On Chain button, always visible */}
                    {(() => {
                      const canSoc = true; // variant-only saves now supported
                      return (
                        <button
                          onClick={() => openSaveDialog(nftExt)}
                          disabled={!canSoc}
                          title={
                            isLegend
                              ? (isOnChain ? "Update your Legend variant on-chain" : "Save your Legend variant on-chain")
                              : canSoc
                              ? (isOnChain ? "Update your on-chain SOC" : "Save this loadout on-chain")
                              : "Equip traits first to SOC"
                          }
                          className={`w-full flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-black uppercase tracking-widest transition-all duration-200 border-2 ${
                            !canSoc
                              ? "opacity-40 cursor-not-allowed border-border/40 bg-secondary/20 text-muted-foreground"
                              : isOnChain
                              ? "border-amber-400/60 text-amber-300 hover:border-amber-400 hover:shadow-[0_0_18px_rgba(234,179,8,0.35)] active:scale-95"
                              : "border-amber-500/80 text-amber-400 hover:border-amber-400 hover:shadow-[0_0_24px_rgba(234,179,8,0.5)] active:scale-95 animate-pulse"
                          }`}
                          style={canSoc ? {
                            background: isOnChain
                              ? 'linear-gradient(135deg, rgba(234,179,8,0.08), rgba(245,158,11,0.05))'
                              : 'linear-gradient(135deg, rgba(234,179,8,0.12), rgba(245,158,11,0.08))',
                            fontFamily: "'Bungee', Impact, sans-serif",
                            letterSpacing: '0.12em',
                          } : { fontFamily: "'Bungee', Impact, sans-serif", letterSpacing: '0.12em' }}
                        >
                          <Zap className={`w-4 h-4 ${canSoc ? 'fill-amber-400 text-amber-400' : ''}`} />
                          <span>{isOnChain ? "Re-SOC" : "SOC"}</span>
                          <span className="text-[9px] font-normal normal-case tracking-normal opacity-70 -ml-1">{isOnChain ? "" : "Save On Chain"}</span>
                          {canSoc && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-60" />}
                        </button>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          </div>
        );

        return (
          <>
          {/* ── Variant Toggle Band ── */}
          {variantPacks.length > 0 && (
            <div
              className="mb-6 flex items-center gap-3 flex-wrap px-4 py-3 rounded-xl border"
              style={{
                background: 'linear-gradient(90deg,rgba(26,16,40,0.95),rgba(16,11,24,0.95))',
                borderColor: 'rgba(157,0,255,0.2)',
              }}
            >
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Layers className="w-3.5 h-3.5 text-muted-foreground/50" />
                <span className="text-[11px] font-mono text-muted-foreground/50 uppercase tracking-widest">
                  Display Version
                </span>
              </div>

              {/* Original button */}
              <button
                onClick={() => setPreviewVariant(null)}
                className="flex-shrink-0 px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide transition-all rounded"
                style={{
                  background: previewVariant === null ? 'rgba(157,0,255,0.2)' : 'rgba(157,0,255,0.05)',
                  border: previewVariant === null ? '1px solid rgba(157,0,255,0.7)' : '1px solid rgba(157,0,255,0.2)',
                  color: previewVariant === null ? 'hsl(272 100% 78%)' : 'hsl(272 30% 60%)',
                  boxShadow: previewVariant === null ? '0 0 10px rgba(157,0,255,0.3)' : 'none',
                  fontFamily: "'Bungee', Impact, sans-serif",
                }}
              >
                Original
              </button>

              {/* Variant pack buttons */}
              {variantPacks.map(pack => (
                <button
                  key={pack}
                  onClick={() => setPreviewVariant(previewVariant === pack ? null : pack)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide transition-all rounded"
                  style={{
                    background: previewVariant === pack ? 'rgba(255,200,0,0.15)' : 'rgba(157,0,255,0.05)',
                    border: previewVariant === pack ? '1px solid rgba(255,200,0,0.6)' : '1px solid rgba(157,0,255,0.2)',
                    color: previewVariant === pack ? 'hsl(43 100% 65%)' : 'hsl(272 30% 60%)',
                    boxShadow: previewVariant === pack ? '0 0 10px rgba(255,200,0,0.15)' : 'none',
                    fontFamily: "'Bungee', Impact, sans-serif",
                  }}
                >
                  {pack}
                  {isLoadingPreview && previewVariant === pack && (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  )}
                </button>
              ))}

              <span className="text-[10px] font-mono text-muted-foreground/40 ml-auto">
                {previewVariant
                  ? `Previewing ${previewVariant} — SOC a card to save this version on-chain`
                  : 'Switch version to preview · SOC to save on-chain'}
              </span>
            </div>
          )}

          <Tabs defaultValue={wegens.length > 0 ? "wegens" : "wegenettes"} className="w-full">
            <TabsList className="mb-6 h-auto p-1 gap-1 bg-card/60 border border-border/40">
              {wegens.length > 0 && (
                <TabsTrigger value="wegens" className="flex items-center gap-2 px-4 py-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                  Wegens
                  <Badge variant="secondary" className="ml-0.5 text-[11px] h-5 px-1.5">{wegens.length}</Badge>
                </TabsTrigger>
              )}
              {wegenettes.length > 0 && (
                <TabsTrigger value="wegenettes" className="flex items-center gap-2 px-4 py-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                  Wegenettes
                  <Badge variant="secondary" className="ml-0.5 text-[11px] h-5 px-1.5">{wegenettes.length}</Badge>
                </TabsTrigger>
              )}
            </TabsList>
            {wegens.length > 0 && (
              <TabsContent value="wegens" className="mt-0">
                {renderGrid(wegens)}
              </TabsContent>
            )}
            {wegenettes.length > 0 && (
              <TabsContent value="wegenettes" className="mt-0">
                {renderGrid(wegenettes)}
              </TabsContent>
            )}
          </Tabs>
          </>
        );
      })()}

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

      {/* ── SOC Dialog ── Save On Chain ────────────────────────────────────── */}
      <Dialog
        open={!!saveDialogNft}
        onOpenChange={(open) => {
          if (!open) {
            setSaveDialogNft(null);
            setSaveTxResult(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl border-0 p-0 overflow-hidden bg-card">
          {/* SOC header bar */}
          <div
            className="px-6 py-4 flex items-center gap-3"
            style={{
              background: saveTxResult
                ? 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(16,185,129,0.1))'
                : 'linear-gradient(135deg, rgba(234,179,8,0.2), rgba(245,158,11,0.1))',
              borderBottom: saveTxResult
                ? '1px solid rgba(34,197,94,0.3)'
                : '1px solid rgba(234,179,8,0.3)',
            }}
          >
            {/* SOC badge */}
            <div
              className="flex items-center justify-center w-12 h-12 rounded-xl shrink-0 font-black text-lg"
              style={{
                background: saveTxResult
                  ? 'linear-gradient(135deg, rgba(34,197,94,0.3), rgba(16,185,129,0.2))'
                  : 'linear-gradient(135deg, rgba(234,179,8,0.3), rgba(245,158,11,0.2))',
                border: saveTxResult ? '2px solid rgba(34,197,94,0.6)' : '2px solid rgba(234,179,8,0.6)',
                color: saveTxResult ? '#4ade80' : '#fbbf24',
                fontFamily: "'Bungee', Impact, sans-serif",
                boxShadow: saveTxResult
                  ? '0 0 16px rgba(34,197,94,0.3)'
                  : '0 0 16px rgba(234,179,8,0.35)',
              }}
            >
              {saveTxResult ? <CheckCircle2 className="w-6 h-6" /> : <Zap className="w-6 h-6 fill-amber-400" />}
            </div>
            <div>
              <DialogTitle
                className="text-xl font-black tracking-wider"
                style={{
                  fontFamily: "'Bungee', Impact, sans-serif",
                  color: saveTxResult ? '#4ade80' : '#fbbf24',
                  textShadow: saveTxResult
                    ? '0 0 12px rgba(34,197,94,0.4)'
                    : '0 0 12px rgba(234,179,8,0.4)',
                }}
              >
                {saveTxResult ? "SOC'd!" : "SOC — Save On Chain"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {saveTxResult
                  ? `${saveDialogNft?.name} is now locked on-chain — this loadout is the canonical version.`
                  : `Lock ${saveDialogNft?.name}'s current trait loadout as the canonical on-chain version.`}
              </DialogDescription>
            </div>
          </div>

          <div className="px-6 py-5">
            {saveTxResult ? (
              /* ── Success State ── */
              <div className="space-y-4">
                <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-5 space-y-3">
                  <div className="flex items-center gap-2 text-green-400 font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    Transaction Confirmed
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Tx Hash</div>
                    <div className="font-mono text-xs break-all text-foreground/80">{saveTxResult.txHash}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">On-Chain Metadata URL</div>
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
                      View On-Chain Image
                    </Button>
                  </a>
                  <Button
                    onClick={() => { setSaveDialogNft(null); setSaveTxResult(null); }}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold"
                  >
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              /* ── Pre-SOC State ── */
              <div className="space-y-5">
                <div className="flex gap-4">
                  {/* Composited image preview */}
                  {saveDialogNft && (
                    <div
                      className="rounded-xl overflow-hidden border bg-secondary/20 w-32 h-32 shrink-0 flex items-center justify-center"
                      style={{ borderColor: 'rgba(234,179,8,0.3)' }}
                    >
                      <img
                        key={`${saveDialogNft.tokenId}-${saveVariantPack}`}
                        src={`/api/metadata/${collection}/${saveDialogNft.tokenId}/image`}
                        alt="On-chain NFT preview"
                        className="w-full h-full object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                  )}

                  {/* Equipped traits summary / Legend notice */}
                  <div className="flex-1 min-w-0">
                    {saveDialogNft?.isLegend ? (
                      <div
                        className="flex items-center gap-2 rounded-lg p-3 border"
                        style={{
                          borderColor: 'rgba(234,179,8,0.3)',
                          background: 'linear-gradient(135deg, rgba(234,179,8,0.08), rgba(245,158,11,0.04))',
                        }}
                      >
                        <Crown className="w-4 h-4 shrink-0 text-amber-400" />
                        <div>
                          <div className="text-xs font-bold text-amber-300">Legend / 1-of-1</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Traits are locked. Choose a variant below to SOC.
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-semibold">
                          Traits Being SOC'd ({saveDialogNft?.equippedTraits.length})
                        </div>
                        <div className="space-y-1.5 max-h-28 overflow-y-auto hide-scrollbar">
                          {saveDialogNft?.equippedTraits.map((et) => (
                            <div key={et.category} className="flex items-center gap-2 rounded-lg bg-secondary/30 p-2">
                              {et.trait.imageUrl ? (
                                <img src={et.trait.imageUrl} alt={et.trait.name} className="w-6 h-6 object-contain rounded" />
                              ) : (
                                <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-[10px] font-bold uppercase">
                                  {et.category[0]}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className={`text-xs font-bold truncate ${getRarityColor(et.trait.rarity)}`}>{et.trait.name}</div>
                                <div className="text-[10px] text-muted-foreground uppercase">{et.category}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Variant pack selector */}
                {variantPacks.length > 0 && (
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-semibold">
                      Choose Variant to SOC
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSaveVariantPack(null)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                          saveVariantPack === null
                            ? "border-amber-400/70 bg-amber-400/15 text-amber-300 shadow-[0_0_10px_rgba(234,179,8,0.2)]"
                            : "border-border/50 bg-secondary/20 text-muted-foreground hover:border-amber-400/40"
                        }`}
                      >
                        Original
                      </button>
                      {variantPacks.map((pack) => (
                        <button
                          key={pack}
                          onClick={() => setSaveVariantPack(pack)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                            saveVariantPack === pack
                              ? "border-amber-400/70 bg-amber-400/15 text-amber-300 shadow-[0_0_10px_rgba(234,179,8,0.2)]"
                              : "border-border/50 bg-secondary/20 text-muted-foreground hover:border-amber-400/40"
                          }`}
                        >
                          {pack}
                        </button>
                      ))}
                    </div>
                    {saveVariantPack && (
                      <p className="text-xs text-muted-foreground mt-1.5">
                        The <span className="text-amber-300 font-semibold">{saveVariantPack}</span> variant will be used as the on-chain image.
                      </p>
                    )}
                  </div>
                )}

                {/* On-chain fee notice */}
                {onChainFeeEth > 0 && (
                  <div className="rounded-lg border border-amber-400/40 bg-amber-400/8 p-3 flex items-center gap-3">
                    <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                    <div className="flex-1 text-xs text-amber-200/80">
                      A flat SOC fee of{" "}
                      <span className="font-bold text-amber-300">{onChainFeeEth.toFixed(4)} ETH</span>{" "}
                      will be charged to your wallet to cover on-chain update costs.
                    </div>
                    <div className="text-lg font-black tabular-nums shrink-0" style={{ fontFamily: "'Bungee', Impact, sans-serif", color: "#fbbf24" }}>
                      {onChainFeeEth.toFixed(4)} ETH
                    </div>
                  </div>
                )}

                {/* Info note */}
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/8 p-3 text-xs text-amber-200/70 flex items-start gap-2">
                  <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400/70" />
                  <span>
                    SOC locks your chosen trait loadout and variant as the canonical on-chain metadata. Anyone querying your NFT's tokenURI will see this version.
                  </span>
                </div>

                {/* SOC button */}
                <button
                  onClick={handleSaveToChain}
                  disabled={isSaving || (!saveDialogNft?.isLegend && !saveDialogNft?.equippedTraits.length && saveVariantPack === null)}
                  className="w-full flex items-center justify-center gap-3 rounded-xl py-3.5 text-base font-black uppercase tracking-widest transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                  style={{
                    background: isSaving
                      ? 'linear-gradient(135deg, rgba(234,179,8,0.3), rgba(245,158,11,0.2))'
                      : 'linear-gradient(135deg, rgba(234,179,8,0.85), rgba(245,158,11,0.7))',
                    border: '2px solid rgba(234,179,8,0.8)',
                    color: isSaving ? 'rgba(234,179,8,0.7)' : '#000',
                    fontFamily: "'Bungee', Impact, sans-serif",
                    letterSpacing: '0.14em',
                    boxShadow: isSaving ? 'none' : '0 0 24px rgba(234,179,8,0.4), 2px 2px 0 rgba(0,0,0,0.6)',
                  }}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                      <span className="text-amber-300">Signing Transaction…</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5 fill-black" />
                      SOC It
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
