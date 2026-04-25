import { useState, useEffect, useCallback } from "react";
import { TraitMedia } from "@/components/TraitMedia";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  ShoppingCart,
  Plus,
  Check,
  Trash2,
  X,
  Zap,
} from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────

const BANGERS  = { fontFamily: "'Bungee', Impact, sans-serif", letterSpacing: "0.08em" };
const DISPLAY  = { fontFamily: "'Bungee Shade', 'Bungee', Impact, sans-serif", letterSpacing: "0.02em" };

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
  ineligibleNfts = [],
}: {
  walletAddress: string | null;
  isConnected: boolean;
  connect: () => void;
  previewTrait: Trait | null;
  ineligibleNfts?: string[];
}) {
  const [previewNft, setPreviewNft] = useState<WegenNft | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const isNftIneligible = (nft: WegenNft) =>
    ineligibleNfts.includes(String(nft.tokenId).toLowerCase()) ||
    ineligibleNfts.includes((nft.name ?? "").toLowerCase());
  const previewNftBlocked = previewNft ? isNftIneligible(previewNft) : false;
  const effectivePreviewTrait = previewNftBlocked ? null : previewTrait;

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
                    previewNftBlocked
                      ? "border-red-500/50 shadow-[0_0_18px_rgba(239,68,68,0.2)]"
                      : effectivePreviewTrait
                      ? `border-primary ${getRarityGlow(effectivePreviewTrait.rarity)}`
                      : "border-border/40"
                  }`}
                >
                  {/* Base NFT image */}
                  {previewNft?.imageUrl ? (
                    <img
                      src={previewNft.imageUrl}
                      alt={previewNft.name}
                      className={`absolute inset-0 w-full h-full object-cover transition-all duration-200 ${previewNftBlocked ? "opacity-40 grayscale" : ""}`}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Gem className="w-20 h-20 text-muted-foreground/20" />
                    </div>
                  )}

                  {/* Currently equipped trait overlays (shown when nothing is being previewed) */}
                  {previewNft && !effectivePreviewTrait && !previewNftBlocked &&
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
                  {effectivePreviewTrait?.imageUrl && (
                    <img
                      src={effectivePreviewTrait.imageUrl}
                      alt={effectivePreviewTrait.name}
                      className="absolute inset-0 w-full h-full object-cover animate-in fade-in duration-150"
                    />
                  )}

                  {/* Token ID */}
                  {previewNft && (
                    <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md rounded px-2 py-0.5 text-[10px] font-mono text-white/80 border border-white/10">
                      #{previewNft.tokenId}
                    </div>
                  )}

                  {/* Ineligible overlay */}
                  {previewNftBlocked && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 backdrop-blur-[2px]">
                      <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                        </svg>
                      </div>
                      <span className="text-xs text-red-300 font-semibold text-center px-2 leading-tight">Ineligible NFT</span>
                    </div>
                  )}

                  {/* Preview label */}
                  {effectivePreviewTrait && !previewNftBlocked && (
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-primary flex-shrink-0" />
                        <span className="text-[11px] text-white font-semibold truncate">{effectivePreviewTrait.name}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* NFT selector (multiple NFTs) */}
                {nfts.length > 1 && (
                  <div className="flex gap-1.5 flex-wrap justify-center max-w-[240px]">
                    {nfts.map(nft => {
                      const blocked = isNftIneligible(nft);
                      return (
                        <button
                          key={nft.tokenId}
                          type="button"
                          onClick={() => setPreviewNft(nft)}
                          title={blocked ? `#${nft.tokenId} — Ineligible NFT` : nft.name}
                          className={`relative w-10 h-10 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
                            previewNft?.tokenId === nft.tokenId
                              ? blocked
                                ? "border-red-500/70 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                                : "border-primary shadow-[0_0_8px_rgba(157,0,255,0.5)]"
                              : blocked
                              ? "border-red-500/30 opacity-60"
                              : "border-border/30 opacity-50 hover:opacity-90 hover:border-border"
                          }`}
                        >
                          {nft.imageUrl ? (
                            <img src={nft.imageUrl} alt={nft.name} className={`w-full h-full object-cover ${blocked ? "grayscale opacity-50" : ""}`} />
                          ) : (
                            <div className="w-full h-full bg-secondary/50 flex items-center justify-center">
                              <span className="text-[8px] font-bold text-muted-foreground">#{nft.tokenId}</span>
                            </div>
                          )}
                          {blocked && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                              </svg>
                            </div>
                          )}
                        </button>
                      );
                    })}
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
                  <div style={BANGERS} className={`text-2xl leading-tight ${previewNftBlocked ? "text-red-400/80" : "text-foreground"}`}>
                    {previewNft?.name ?? "Select a Wegen"}
                  </div>
                </div>

                {/* Ineligible NFT warning */}
                {previewNftBlocked && (
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                    </svg>
                    <div>
                      <div className="text-xs font-semibold text-red-300 mb-0.5">Ineligible NFT</div>
                      <p className="text-[11px] text-red-300/70 leading-relaxed">
                        This NFT is not eligible for trait preview or upgrade in this store. Select a different Wegen to continue.
                      </p>
                    </div>
                  </div>
                )}

                {/* Equipped traits */}
                {previewNft && !previewNftBlocked && previewNft.equippedTraits.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold mb-2">
                      Equipped Traits
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {previewNft.equippedTraits.map(et => (
                        <div
                          key={et.category}
                          className={`flex items-center gap-1.5 rounded px-2 py-1 border text-[11px] transition-all duration-200 ${
                            effectivePreviewTrait?.category === et.category
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
                          {effectivePreviewTrait?.category === et.category && (
                            <span className="text-orange-400/80 text-[9px] font-bold ml-0.5 flex-shrink-0">→ replace</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Previewed trait detail / empty state */}
                {effectivePreviewTrait ? (
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/25 space-y-3 animate-in fade-in duration-150">
                    <div className="text-[10px] uppercase tracking-widest text-primary/70 font-semibold flex items-center gap-1.5">
                      <Eye className="w-3 h-3" /> Previewing
                    </div>
                    <div className="flex items-start gap-3">
                      {effectivePreviewTrait.imageUrl ? (
                        <img
                          src={effectivePreviewTrait.imageUrl}
                          alt={effectivePreviewTrait.name}
                          className="w-14 h-14 rounded-lg object-contain bg-secondary/40 p-1 border border-border/30 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-secondary/40 flex items-center justify-center flex-shrink-0 border border-border/30">
                          <Package className="w-6 h-6 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-base leading-tight mb-1.5">{effectivePreviewTrait.name}</div>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1.5 py-0 uppercase tracking-wide ${getRarityColor(effectivePreviewTrait.rarity)}`}
                          >
                            {effectivePreviewTrait.rarity}
                          </Badge>
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 uppercase tracking-wide">
                            {effectivePreviewTrait.category}
                          </Badge>
                          {effectivePreviewTrait.theme && (
                            <Badge className="text-[9px] px-1.5 py-0 bg-primary/20 text-primary border-primary/30 uppercase tracking-wide">
                              {effectivePreviewTrait.theme}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-primary font-bold text-sm">
                          <Coins className="w-3.5 h-3.5" />
                          {effectivePreviewTrait.priceEth} ETH
                        </div>
                      </div>
                    </div>
                    {effectivePreviewTrait.description && (
                      <p className="text-xs text-muted-foreground/80 line-clamp-2 italic">{effectivePreviewTrait.description}</p>
                    )}
                  </div>
                ) : !previewNftBlocked ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-5 gap-2 text-muted-foreground/35 border border-dashed border-border/25 rounded-lg">
                    <Eye className="w-8 h-8" />
                    <p className="text-xs text-center leading-relaxed">
                      Hover any trait below<br />to see it on your Wegen
                    </p>
                  </div>
                ) : null}
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
  const [previewTrait, setPreviewTrait] = useState<Trait | null>(null);
  const [cart, setCart] = useState<Map<number, Trait>>(new Map());
  const [cartOpen, setCartOpen] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutProgress, setCheckoutProgress] = useState<{ done: number; total: number } | null>(null);

  const { walletAddress, isConnected, connect } = useWallet();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Maintenance mode gate ──
  const [storeConfig, setStoreConfig] = useState<{
    storeOpen: boolean;
    maintenanceMode: boolean;
    maintenanceWhitelist: string[];
    ineligibleNfts: string[];
    storeName: string;
    announcementBanner: string | null;
  } | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  const fetchConfig = useCallback(() => {
    setConfigLoading(true);
    fetch("/api/store/config")
      .then(r => r.json())
      .then(data => { setStoreConfig(data); setConfigLoading(false); })
      .catch(() => setConfigLoading(false));
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const { data: storeStats } = useGetStoreStats();
  const { data: themesData } = useListStoreThemes();
  const { data: categoriesData, isLoading: isLoadingCategories } = useListTraitCategories();
  const { data: traitsData, isLoading: isLoadingTraits } = useListTraits(
    { category: selectedCategory, theme: selectedTheme, limit: 9999 },
    {
      query: {
        queryKey: getListTraitsQueryKey({ category: selectedCategory, theme: selectedTheme, limit: 9999 }),
      },
    },
  );

  const purchaseTrait = usePurchaseTrait();

  // ── Cart helpers ──
  const cartCount = cart.size;
  const cartItems = Array.from(cart.values());
  const cartTotal = cartItems.reduce((sum, t) => sum + parseFloat(t.priceEth || "0"), 0);
  const isInCart = (id: number) => cart.has(id);

  const toggleCart = (trait: Trait) => {
    if (!isConnected) { connect(); return; }
    setCart(prev => {
      const next = new Map(prev);
      if (next.has(trait.id)) next.delete(trait.id);
      else next.set(trait.id, trait);
      return next;
    });
  };

  const removeFromCart = (id: number) => {
    setCart(prev => { const next = new Map(prev); next.delete(id); return next; });
  };

  const handleCheckout = async () => {
    if (!walletAddress || cartItems.length === 0) return;
    setIsCheckingOut(true);
    setCheckoutProgress({ done: 0, total: cartItems.length });
    let succeeded = 0;
    let failed = 0;
    for (let i = 0; i < cartItems.length; i++) {
      const trait = cartItems[i];
      try {
        await purchaseTrait.mutateAsync({
          walletAddress,
          data: {
            traitId: trait.id,
            quantity: 1,
            txHash: `0xsimulated${Date.now()}`,
          },
        });
        succeeded++;
      } catch {
        failed++;
      }
      setCheckoutProgress({ done: i + 1, total: cartItems.length });
    }
    queryClient.invalidateQueries({ queryKey: getListTraitsQueryKey({ category: selectedCategory, theme: selectedTheme, limit: 9999 }) });
    queryClient.invalidateQueries({ queryKey: getGetStoreStatsQueryKey() });
    setCart(new Map());
    setCartOpen(false);
    setIsCheckingOut(false);
    setCheckoutProgress(null);
    if (failed === 0) {
      toast({ title: `${succeeded} trait${succeeded > 1 ? "s" : ""} purchased!`, description: "Check your Locker to equip them." });
    } else {
      toast({ title: `${succeeded} purchased, ${failed} failed`, description: "Some items could not be completed.", variant: "destructive" });
    }
  };

  const handleThemeSelect = (theme: string | undefined) => {
    setSelectedTheme(theme);
    setSelectedCategory(undefined);
  };

  const themes = themesData?.themes ?? [];

  // ── Maintenance gate check ──
  const isBlocked = storeConfig?.maintenanceMode === true &&
    !storeConfig.maintenanceWhitelist.includes((walletAddress ?? "").toLowerCase());

  if (configLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <span className="text-sm uppercase tracking-widest" style={{ fontFamily: "'Bangers', cursive" }}>Loading Store...</span>
        </div>
      </div>
    );
  }

  if (isBlocked) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="flex flex-col items-center gap-8 text-center max-w-md">
          {/* Icon */}
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center shadow-[0_0_40px_rgba(245,158,11,0.2)]">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-500 border-2 border-background flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-black" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3A5.25 5.25 0 0012 1.5zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
              </svg>
            </div>
          </div>

          {/* Text */}
          <div className="space-y-3">
            <h2
              className="text-4xl text-amber-400 leading-none"
              style={{ fontFamily: "'Bangers', cursive", letterSpacing: "0.05em", textShadow: "3px 3px 0 rgba(0,0,0,0.8), 0 0 30px rgba(245,158,11,0.5)" }}
            >
              MAINTENANCE MODE
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The Wegen Trait Store is currently undergoing maintenance. We'll be back shortly with something amazing.
            </p>
            {!isConnected && (
              <p className="text-xs text-muted-foreground/60 italic">
                Connect your wallet — if you're whitelisted, you'll get instant access.
              </p>
            )}
          </div>

          {/* Action */}
          {!isConnected ? (
            <button
              onClick={connect}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 font-semibold hover:bg-amber-500/25 transition-all text-sm uppercase tracking-widest"
              style={{ fontFamily: "'Bangers', cursive", letterSpacing: "0.1em" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="M16 12h.01" />
              </svg>
              Connect Wallet
            </button>
          ) : (
            <button
              onClick={fetchConfig}
              className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors uppercase tracking-widest"
              style={{ fontFamily: "'Bangers', cursive" }}
            >
              Refresh Status
            </button>
          )}

          {/* Decorative */}
          <div className="flex items-center gap-2 text-muted-foreground/20">
            <div className="h-px w-16 bg-current" />
            <span className="text-xs uppercase tracking-widest font-mono">Wegen NFT</span>
            <div className="h-px w-16 bg-current" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* ── Page header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1
            className="leading-none mb-3 select-none"
            style={{
              ...DISPLAY,
              fontSize: 'clamp(3.5rem, 9vw, 6.5rem)',
              color: '#9900ff',
              textShadow: [
                '0 0 12px #9900ff',
                '0 0 30px #6600cc',
                '0 0 60px #44009988',
                '0 0 2px #000',
              ].join(', '),
            }}
          >
            TRAIT{" "}
            <span
              style={{
                color: '#c8920a',
                textShadow: [
                  '0 0 12px #c8920a',
                  '0 0 30px #8a5c00',
                  '0 0 60px #5a360088',
                  '0 0 2px #000',
                ].join(', '),
              }}
            >
              STORE
            </span>
          </h1>
          <p className="text-muted-foreground text-base max-w-2xl uppercase tracking-widest" style={BANGERS}>
            // Acquire exclusive artifacts for your Wegen NFTs //
          </p>
        </div>

        {/* ── Cart button ── */}
        <button
          onClick={() => { if (!isConnected) { connect(); return; } setCartOpen(true); }}
          className="relative flex items-center gap-3 px-5 py-3 rounded-xl border transition-all group"
          style={{
            background: cartCount > 0
              ? "linear-gradient(135deg, hsl(272 100% 65% / 0.2), hsl(43 100% 56% / 0.1))"
              : "hsl(268 35% 6%)",
            border: cartCount > 0
              ? "1px solid hsl(272 100% 65% / 0.6)"
              : "1px solid hsl(268 22% 16%)",
            boxShadow: cartCount > 0 ? "0 0 20px hsl(272 100% 65% / 0.25)" : "none",
          }}
        >
          <div className="relative">
            <ShoppingCart className={`w-5 h-5 transition-colors ${cartCount > 0 ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
            {cartCount > 0 && (
              <span
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                style={{ background: "hsl(272 100% 65%)", boxShadow: "0 0 8px hsl(272 100% 65% / 0.8)" }}
              >
                {cartCount}
              </span>
            )}
          </div>
          <div className="text-left">
            <div className={`text-sm font-bold leading-none mb-0.5 ${cartCount > 0 ? "text-foreground" : "text-muted-foreground"}`} style={BANGERS}>
              {cartCount > 0 ? `${cartCount} item${cartCount > 1 ? "s" : ""} in cart` : "Cart empty"}
            </div>
            {cartCount > 0 && (
              <div className="text-xs text-accent font-semibold font-mono">
                {cartTotal.toFixed(4)} ETH total
              </div>
            )}
          </div>
          {cartCount > 0 && (
            <Zap className="w-4 h-4 text-accent ml-1" />
          )}
        </button>
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
        ineligibleNfts={storeConfig?.ineligibleNfts ?? []}
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
                  <TraitMedia
                    url={trait.imageUrl}
                    mediaType={(trait as Record<string, unknown>).mediaType as string}
                    alt={trait.name}
                    className="w-full h-full group-hover:scale-110 transition-transform duration-500 drop-shadow-2xl"
                    showBadge
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
                {trait.remainingSupply <= 0 ? (
                  <div className="w-full h-11 flex items-center justify-center text-sm text-muted-foreground/50 font-semibold" style={BANGERS}>
                    SOLD OUT
                  </div>
                ) : isInCart(trait.id) ? (
                  <button
                    onClick={() => toggleCart(trait)}
                    className="w-full h-11 flex items-center justify-center gap-2 text-sm font-bold transition-all"
                    style={{
                      background: "linear-gradient(135deg, hsl(272 100% 65% / 0.25), hsl(43 100% 56% / 0.15))",
                      color: "hsl(43 100% 60%)",
                      ...BANGERS,
                    }}
                  >
                    <Check className="w-3.5 h-3.5" />
                    IN CART — REMOVE
                  </button>
                ) : (
                  <button
                    onClick={() => toggleCart(trait)}
                    className="w-full h-11 flex items-center justify-center gap-2 text-sm font-bold text-muted-foreground hover:text-white hover:bg-primary/80 transition-all group/btn"
                    style={BANGERS}
                  >
                    <Plus className="w-3.5 h-3.5 group-hover/btn:rotate-90 transition-transform" />
                    ADD TO CART
                  </button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* ── Cart Sheet ── */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent
          className="flex flex-col w-full sm:max-w-md p-0 border-l border-primary/30"
          style={{
            background: "hsl(268 40% 4%)",
            boxShadow: "-10px 0 60px hsl(272 100% 65% / 0.15)",
          }}
        >
          {/* Header */}
          <SheetHeader className="px-6 py-5 border-b border-primary/20 flex-shrink-0">
            <SheetTitle asChild>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: "hsl(272 100% 65% / 0.2)", border: "1px solid hsl(272 100% 65% / 0.4)" }}
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
                    onClick={() => setCart(new Map())}
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
                <Button size="sm" variant="outline" className="border-primary/40 text-primary" onClick={() => setCartOpen(false)}>
                  Browse Traits
                </Button>
              </div>
            ) : (
              cartItems.map((trait) => (
                <div
                  key={trait.id}
                  className="flex items-center gap-3 p-3 rounded-xl border transition-all"
                  style={{
                    background: "hsl(268 35% 6%)",
                    border: "1px solid hsl(268 22% 14%)",
                  }}
                >
                  {/* Thumbnail */}
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-secondary/40 flex-shrink-0 border border-border/20">
                    {trait.imageUrl ? (
                      <TraitMedia url={trait.imageUrl} mediaType={(trait as Record<string, unknown>).mediaType as string} alt={trait.name} className="w-full h-full object-contain" />
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
                      {trait.priceEth} ETH
                    </div>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => removeFromCart(trait.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
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
                  <span>{cartCount} trait{cartCount > 1 ? "s" : ""}</span>
                  <span className="font-mono">{cartTotal.toFixed(4)} ETH</span>
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
                  <span className="font-mono text-base">{cartTotal.toFixed(4)} ETH</span>
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
                        background: "linear-gradient(90deg, hsl(272 100% 65%), hsl(43 100% 56%))",
                        boxShadow: "0 0 10px hsl(272 100% 65% / 0.6)",
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Connect / Checkout button */}
              {!isConnected ? (
                <Button
                  className="w-full gap-2 font-bold"
                  style={{ ...BANGERS, background: "linear-gradient(135deg, hsl(272 100% 55%), hsl(272 100% 68%))" }}
                  onClick={connect}
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
                      CHECKOUT — {cartTotal.toFixed(4)} ETH
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
    </div>
  );
}
