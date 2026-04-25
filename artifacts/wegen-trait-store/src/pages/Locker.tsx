import { useState, useMemo } from "react";
import { TraitMedia } from "@/components/TraitMedia";
import { useWallet } from "@/contexts/WalletContext";
import { WalletConnectGuard } from "@/components/shared/WalletConnectGuard";
import {
  useGetLocker,
  useGetUserNfts,
  useApplyTrait,
  useRemoveTrait,
  getGetLockerQueryKey,
  getGetUserNftsQueryKey,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Fingerprint, Lock, Unlock, Gem, Loader2, X, Plus, Eye,
  ChevronDown, SlidersHorizontal, Package,
} from "lucide-react";
import { format } from "date-fns";

const BANGERS = { fontFamily: "'Bungee', Impact, sans-serif", letterSpacing: '0.08em' };

const RARITY_ORDER: Record<string, number> = { legendary: 4, rare: 3, uncommon: 2, common: 1 };

/* ─── Sample / Demo data ──────────────────────────────────────────── */

const SAMPLE_NFTS = [
  {
    tokenId: 420, name: "Wegen #420", imageUrl: null as string | null,
    equippedTraits: [
      { category: "Background", trait: { id: 266, name: "420 Black And Green",
          imageUrl: "/api/storage/objects/uploads/86f560bd-abc4-4307-8e2b-960a44c3cee1", mediaType: "image" } },
    ],
  },
  {
    tokenId: 69, name: "Wegen #69", imageUrl: null as string | null,
    equippedTraits: [
      { category: "Body", trait: { id: 362, name: "Azure",
          imageUrl: "/api/storage/objects/uploads/34f5dc22-fb4c-4fed-9434-9efdf23da646", mediaType: "image" } },
    ],
  },
  { tokenId: 7, name: "Wegen #7", imageUrl: null as string | null, equippedTraits: [] },
];

const DEMO_LOCKER_ITEMS = [
  { id: -1, quantity: 1, purchasedAt: new Date(Date.now() - 86400e3 * 3).toISOString(), equippedToTokenId: 420,
    trait: { id: 266, name: "420 Black And Green", category: "Background", rarity: "rare",
      imageUrl: "/api/storage/objects/uploads/86f560bd-abc4-4307-8e2b-960a44c3cee1", mediaType: "image" } },
  { id: -2, quantity: 2, purchasedAt: new Date(Date.now() - 86400e3 * 7).toISOString(), equippedToTokenId: null,
    trait: { id: 369, name: "Gold Body", category: "Body", rarity: "legendary",
      imageUrl: "/api/storage/objects/uploads/4858e6ce-c4f2-48d2-8c4b-e5ef9d39f5b5", mediaType: "image" } },
  { id: -3, quantity: 1, purchasedAt: new Date(Date.now() - 86400e3 * 1).toISOString(), equippedToTokenId: null,
    trait: { id: 272, name: "Arcade Spot", category: "Background", rarity: "uncommon",
      imageUrl: "/api/storage/objects/uploads/35ac29b2-f60b-4209-86fc-baaabac561a3", mediaType: "image" } },
  { id: -4, quantity: 1, purchasedAt: new Date(Date.now() - 86400e3 * 12).toISOString(), equippedToTokenId: null,
    trait: { id: 365, name: "Crimson", category: "Body", rarity: "rare",
      imageUrl: "/api/storage/objects/uploads/d7bb5b5b-b090-4de6-a305-9ea96d875308", mediaType: "image" } },
  { id: -5, quantity: 3, purchasedAt: new Date(Date.now() - 86400e3 * 2).toISOString(), equippedToTokenId: null,
    trait: { id: 270, name: "Alchemical Mixdown", category: "Background", rarity: "uncommon",
      imageUrl: "/api/storage/objects/uploads/c1f47943-e8dd-4efc-9ea4-37dc54f17a90", mediaType: "image" } },
  { id: -6, quantity: 1, purchasedAt: new Date(Date.now() - 86400e3 * 5).toISOString(), equippedToTokenId: 69,
    trait: { id: 362, name: "Azure", category: "Body", rarity: "common",
      imageUrl: "/api/storage/objects/uploads/34f5dc22-fb4c-4fed-9434-9efdf23da646", mediaType: "image" } },
];

/* ─── Helpers ─────────────────────────────────────────────────────── */

function getRarityColor(rarity: string) {
  switch (rarity) {
    case "legendary": return { pill: "text-yellow-400 border-yellow-500/50 bg-yellow-500/10", glow: "rgba(234,179,8,0.35)" };
    case "rare":      return { pill: "text-blue-400 border-blue-500/50 bg-blue-500/10",   glow: "rgba(59,130,246,0.35)" };
    case "uncommon":  return { pill: "text-green-400 border-green-500/50 bg-green-500/10", glow: "rgba(34,197,94,0.35)" };
    default:          return { pill: "text-gray-400 border-gray-500/50 bg-gray-500/10",   glow: "rgba(157,0,255,0.15)" };
  }
}

/* ─── Entry point ─────────────────────────────────────────────────── */

export function Locker() {
  const isDemo = useMemo(() => new URLSearchParams(window.location.search).has("demo"), []);
  if (isDemo) return <LockerContent demo />;
  return (
    <WalletConnectGuard message="Connect your wallet to open your Trait Locker.">
      <LockerContent />
    </WalletConnectGuard>
  );
}

/* ─── Main workspace ──────────────────────────────────────────────── */

function LockerContent({ demo = false }: { demo?: boolean }) {
  const { walletAddress } = useWallet();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(demo);
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(demo ? 420 : null);
  const [hoverTrait, setHoverTrait] = useState<{ imageUrl: string; name: string; category: string } | null>(null);
  const [filterLayer, setFilterLayer]   = useState("all");
  const [filterRarity, setFilterRarity] = useState("all");
  const [sortBy, setSortBy]             = useState<"rarity-desc" | "rarity-asc" | "name" | "date">("rarity-desc");

  const { data: lockerData, isLoading: isLoadingLocker } = useGetLocker(walletAddress || "", {
    query: { enabled: !!walletAddress && !demo, queryKey: getGetLockerQueryKey(walletAddress || "") },
  });
  const { data: nftsData, isLoading: isLoadingNfts } = useGetUserNfts(walletAddress || "", {
    query: { enabled: !!walletAddress && !demo, queryKey: getGetUserNftsQueryKey(walletAddress || "") },
  });

  const applyTrait = useApplyTrait({
    mutation: {
      onSuccess: (_data, variables) => {
        const item = lockerData?.items?.find(i => i.id === variables.data.lockerItemId);
        const replacing = activeNft?.equippedTraits.some(et => et.category === item?.trait.category);
        toast({ title: replacing ? "Trait Swapped!" : "Trait Equipped!", description: replacing ? "Previous trait returned to stash." : "Looking fresh." });
        queryClient.invalidateQueries({ queryKey: getGetUserNftsQueryKey(walletAddress || "") });
        queryClient.invalidateQueries({ queryKey: getGetLockerQueryKey(walletAddress || "") });
      },
      onError: () => toast({ title: "Error", description: "Failed to equip trait.", variant: "destructive" }),
    },
  });

  const removeTrait = useRemoveTrait({
    mutation: {
      onSuccess: () => {
        toast({ title: "Trait Removed", description: "Returned to your stash." });
        queryClient.invalidateQueries({ queryKey: getGetUserNftsQueryKey(walletAddress || "") });
        queryClient.invalidateQueries({ queryKey: getGetLockerQueryKey(walletAddress || "") });
      },
      onError: () => toast({ title: "Error", description: "Failed to remove trait.", variant: "destructive" }),
    },
  });

  const nfts = demo ? SAMPLE_NFTS : (nftsData?.nfts ?? []);
  const lockerItems = demo ? DEMO_LOCKER_ITEMS : (lockerData?.items ?? []);
  const activeNft = selectedTokenId != null
    ? nfts.find(n => n.tokenId === selectedTokenId)
    : nfts[0] ?? null;

  const allLayers  = useMemo(() => Array.from(new Set(lockerItems.map(i => i.trait.category))).sort(), [lockerItems]);
  const allRarities = ["legendary", "rare", "uncommon", "common"];

  const filteredStash = useMemo(() => {
    let items = [...lockerItems];
    if (filterLayer  !== "all") items = items.filter(i => i.trait.category === filterLayer);
    if (filterRarity !== "all") items = items.filter(i => i.trait.rarity   === filterRarity);
    items.sort((a, b) => {
      if (sortBy === "rarity-desc") return (RARITY_ORDER[b.trait.rarity] ?? 0) - (RARITY_ORDER[a.trait.rarity] ?? 0);
      if (sortBy === "rarity-asc")  return (RARITY_ORDER[a.trait.rarity] ?? 0) - (RARITY_ORDER[b.trait.rarity] ?? 0);
      if (sortBy === "name")        return a.trait.name.localeCompare(b.trait.name);
      if (sortBy === "date")        return new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime();
      return 0;
    });
    return items;
  }, [lockerItems, filterLayer, filterRarity, sortBy]);

  const handleEquip = (lockerItemId: number) => {
    if (demo) { toast({ title: "Demo Mode", description: "Connect your wallet to equip traits." }); return; }
    if (!activeNft || !walletAddress) return;
    applyTrait.mutate({ tokenId: activeNft.tokenId, data: { lockerItemId, walletAddress } });
  };

  const handleRemove = (category: string) => {
    if (demo) { toast({ title: "Demo Mode", description: "Connect your wallet to remove traits." }); return; }
    if (!activeNft || !walletAddress) return;
    removeTrait.mutate({ tokenId: activeNft.tokenId, data: { category, walletAddress } });
  };

  return (
    <div className="flex flex-col animate-in fade-in duration-500" style={{ height: "calc(100vh - 60px)" }}>

      {/* ── Top Bar ── */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-4 py-2 border-b"
        style={{ background: 'linear-gradient(90deg,rgba(30,20,40,0.98),rgba(16,11,24,0.98))', borderColor: 'rgba(157,0,255,0.2)' }}
      >
        {/* Title */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-primary text-xl" style={BANGERS}>TRAIT</span>
          <span className="text-accent text-xl" style={BANGERS}>LOCKER</span>
        </div>

        {/* NFT selector chips */}
        <div className="flex items-center gap-2 overflow-x-auto flex-1 mx-2">
          {isLoadingNfts ? (
            <>{[1,2,3].map(i => <Skeleton key={i} className="h-8 w-20 flex-shrink-0" />)}</>
          ) : nfts.length > 0 ? nfts.map(nft => {
            const isSel = (selectedTokenId ?? nfts[0]?.tokenId) === nft.tokenId;
            return (
              <button
                key={nft.tokenId}
                onClick={() => setSelectedTokenId(nft.tokenId)}
                className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono transition-all"
                style={{
                  background: isSel ? 'rgba(157,0,255,0.18)' : 'rgba(157,0,255,0.05)',
                  border: isSel ? '1px solid rgba(157,0,255,0.7)' : '1px solid rgba(157,0,255,0.2)',
                  boxShadow: isSel ? '0 0 10px rgba(157,0,255,0.3)' : 'none',
                  color: isSel ? 'hsl(272 100% 78%)' : 'hsl(272 30% 70%)',
                }}
              >
                {nft.imageUrl
                  ? <img src={nft.imageUrl} alt="" className="w-5 h-5 object-cover rounded-sm" />
                  : <Gem className="w-3.5 h-3.5 opacity-50" />
                }
                <span>#{nft.tokenId}</span>
                {nft.equippedTraits.length > 0 && (
                  <span className="text-accent text-[10px]">· {nft.equippedTraits.length}</span>
                )}
              </button>
            );
          }) : (
            <span className="text-muted-foreground text-xs font-mono">// no Wegens found //</span>
          )}
        </div>

        {/* Demo badge */}
        {demo && (
          <div className="flex-shrink-0 flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono rounded" style={{ background: 'rgba(255,200,0,0.1)', border: '1px solid rgba(255,200,0,0.3)', color: 'hsl(43 100% 65%)' }}>
            <Eye className="w-3 h-3" />DEMO
          </div>
        )}

        {/* Lock/Unlock toggle */}
        <button
          onClick={() => setIsOpen(o => !o)}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase transition-all"
          style={{
            ...BANGERS,
            background: isOpen ? 'rgba(255,200,0,0.12)' : 'rgba(157,0,255,0.15)',
            border: isOpen ? '1px solid rgba(255,200,0,0.45)' : '1px solid rgba(157,0,255,0.45)',
            color: isOpen ? 'hsl(43 100% 62%)' : 'hsl(272 100% 72%)',
          }}
        >
          {isOpen ? <><Unlock className="w-3.5 h-3.5" />OPEN</> : <><Lock className="w-3.5 h-3.5" />LOCKED</>}
        </button>
      </div>

      {/* ── Workspace ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ══ LEFT: NFT Compositor ══ */}
        <div
          className="flex-shrink-0 flex flex-col border-r"
          style={{ width: 320, background: 'linear-gradient(180deg,rgba(22,14,34,0.98),rgba(14,9,22,0.98))', borderColor: 'rgba(157,0,255,0.18)' }}
        >
          {activeNft ? (
            <>
              {/* Composited preview */}
              <div className="relative flex-shrink-0" style={{ aspectRatio: '1/1', width: '100%', maxHeight: 300 }}>
                {/* Base NFT image */}
                {activeNft.imageUrl && (
                  <img src={activeNft.imageUrl} alt={activeNft.name} className="absolute inset-0 w-full h-full object-cover" />
                )}

                {/* Equipped trait layers (skip hovered category) */}
                {activeNft.equippedTraits
                  .filter(et => !hoverTrait || et.category !== hoverTrait.category)
                  .map(et => et.trait.imageUrl ? (
                    <img key={et.category} src={et.trait.imageUrl} alt={et.trait.name}
                      className="absolute inset-0 w-full h-full object-cover" />
                  ) : null)}

                {/* Hover preview layer */}
                {hoverTrait?.imageUrl && (
                  <img src={hoverTrait.imageUrl} alt={hoverTrait.name}
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ outline: '2px solid rgba(157,0,255,0.6)' }} />
                )}

                {/* Empty state */}
                {!activeNft.imageUrl && activeNft.equippedTraits.length === 0 && !hoverTrait && (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(10,6,18,0.9)' }}>
                    <div className="text-center">
                      <Gem className="w-14 h-14 text-primary/20 mx-auto mb-2" />
                      <p className="text-xs font-mono text-muted-foreground/40 uppercase">// hover a trait to preview //</p>
                    </div>
                  </div>
                )}

                {/* Dark bg if no images yet but has slots */}
                {!activeNft.imageUrl && (activeNft.equippedTraits.length > 0 || hoverTrait) && (
                  <div className="absolute inset-0 -z-10" style={{ background: '#0a0612' }} />
                )}

                {/* Preview badge */}
                {hoverTrait && (
                  <div className="absolute bottom-2 left-2 right-2">
                    <div className="px-2 py-1 text-[10px] font-mono text-center truncate"
                      style={{ background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(157,0,255,0.4)', color: 'hsl(272 100% 78%)' }}>
                      ◈ {hoverTrait.category.toUpperCase()}: {hoverTrait.name}
                    </div>
                  </div>
                )}

                {/* Token label */}
                <div className="absolute top-2 left-2">
                  <span className="text-xs font-mono px-1.5 py-0.5" style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(157,0,255,0.3)', color: 'hsl(272 100% 72%)' }}>
                    #{activeNft.tokenId}
                  </span>
                </div>
              </div>

              {/* NFT name */}
              <div className="px-3 py-2 border-b" style={{ borderColor: 'rgba(157,0,255,0.15)' }}>
                <div className="text-sm font-bold" style={BANGERS}>{activeNft.name}</div>
                <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                  {activeNft.equippedTraits.length} trait{activeNft.equippedTraits.length !== 1 ? 's' : ''} equipped
                  {hoverTrait && <span className="ml-1.5 text-primary">· previewing {hoverTrait.category}</span>}
                </div>
              </div>

              {/* Equipped traits list */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                <div className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-2">Equipped</div>
                {activeNft.equippedTraits.length === 0 ? (
                  <div className="text-center py-6">
                    <Package className="w-8 h-8 text-muted-foreground/15 mx-auto mb-2" />
                    <p className="text-[10px] font-mono text-muted-foreground/40 uppercase">// hover a trait to preview //</p>
                  </div>
                ) : (
                  activeNft.equippedTraits.map(et => (
                    <div key={et.category} className="flex items-center gap-2 p-2 group/et rounded"
                      style={{ background: 'rgba(157,0,255,0.06)', border: '1px solid rgba(157,0,255,0.15)' }}>
                      {et.trait.imageUrl ? (
                        <div className="w-8 h-8 flex-shrink-0 rounded overflow-hidden bg-black/40">
                          <TraitMedia url={et.trait.imageUrl} mediaType={(et.trait as Record<string,unknown>).mediaType as string}
                            alt={et.trait.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center text-xs font-bold text-primary rounded"
                          style={{ background: 'rgba(157,0,255,0.2)' }}>
                          {et.category[0]}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">{et.trait.name}</div>
                        <div className="text-[9px] font-mono text-primary/60 uppercase">{et.category}</div>
                      </div>
                      <button onClick={() => handleRemove(et.category)}
                        disabled={removeTrait.isPending}
                        className="opacity-0 group-hover/et:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center rounded hover:bg-red-500/20 text-red-400/70 hover:text-red-400 flex-shrink-0">
                        {removeTrait.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center p-6">
                <Gem className="w-12 h-12 text-primary/15 mx-auto mb-3" />
                <p className="text-xs font-mono text-muted-foreground/40 uppercase tracking-widest">// select a Wegen above //</p>
              </div>
            </div>
          )}
        </div>

        {/* ══ RIGHT: Stash ══ */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Stash filter/sort bar */}
          <div className="flex-shrink-0 flex flex-wrap items-center gap-2 px-4 py-2 border-b"
            style={{ background: 'rgba(16,11,24,0.95)', borderColor: 'rgba(157,0,255,0.15)' }}>

            {/* Title */}
            <span className="text-sm text-foreground font-bold flex-shrink-0" style={BANGERS}>
              STASH
              <span className="ml-2 text-accent text-xs">{lockerItems.length} items</span>
            </span>

            <div className="flex items-center gap-2 ml-auto flex-wrap">
              {/* Layer filter */}
              <div className="relative">
                <SlidersHorizontal className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                <select
                  value={filterLayer}
                  onChange={e => setFilterLayer(e.target.value)}
                  className="pl-6 pr-6 py-1 text-xs font-mono appearance-none cursor-pointer"
                  style={{ background: 'rgba(157,0,255,0.08)', border: '1px solid rgba(157,0,255,0.25)', color: 'hsl(272 100% 72%)', outline: 'none' }}
                >
                  <option value="all">All Layers</option>
                  {allLayers.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
              </div>

              {/* Rarity filter */}
              <div className="relative">
                <select
                  value={filterRarity}
                  onChange={e => setFilterRarity(e.target.value)}
                  className="pl-3 pr-6 py-1 text-xs font-mono appearance-none cursor-pointer"
                  style={{ background: 'rgba(157,0,255,0.08)', border: '1px solid rgba(157,0,255,0.25)', color: 'hsl(272 100% 72%)', outline: 'none' }}
                >
                  <option value="all">All Rarities</option>
                  {allRarities.map(r => <option key={r} value={r} className="capitalize">{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
              </div>

              {/* Sort */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as typeof sortBy)}
                  className="pl-3 pr-6 py-1 text-xs font-mono appearance-none cursor-pointer"
                  style={{ background: 'rgba(157,0,255,0.08)', border: '1px solid rgba(157,0,255,0.25)', color: 'hsl(272 100% 72%)', outline: 'none' }}
                >
                  <option value="rarity-desc">Rarity ↓</option>
                  <option value="rarity-asc">Rarity ↑</option>
                  <option value="name">Name A–Z</option>
                  <option value="date">Newest first</option>
                </select>
                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
              </div>

              {/* Active filter pills */}
              {filterLayer !== "all" && (
                <button onClick={() => setFilterLayer("all")}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono rounded-full"
                  style={{ background: 'rgba(157,0,255,0.15)', border: '1px solid rgba(157,0,255,0.4)', color: 'hsl(272 100% 72%)' }}>
                  {filterLayer} <X className="w-2.5 h-2.5" />
                </button>
              )}
              {filterRarity !== "all" && (
                <button onClick={() => setFilterRarity("all")}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono rounded-full capitalize"
                  style={{ background: 'rgba(157,0,255,0.15)', border: '1px solid rgba(157,0,255,0.4)', color: 'hsl(272 100% 72%)' }}>
                  {filterRarity} <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          </div>

          {/* Stash grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {!isOpen ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center py-10">
                  <Lock className="w-12 h-12 text-primary/20 mx-auto mb-3"
                    style={{ filter: 'drop-shadow(0 0 10px rgba(157,0,255,0.3))' }} />
                  <p className="text-xs font-mono text-muted-foreground/60 uppercase tracking-widest">
                    // locker sealed — tap OPEN to reveal your stash //
                  </p>
                </div>
              </div>
            ) : isLoadingLocker ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                {[1,2,3,4,5,6,8].map(i => <Skeleton key={i} className="aspect-square" />)}
              </div>
            ) : filteredStash.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center py-10">
                  <Package className="w-10 h-10 text-muted-foreground/15 mx-auto mb-3" />
                  <p className="text-xs font-mono text-muted-foreground/40 uppercase">
                    {lockerItems.length === 0 ? "// no traits in stash //" : "// no traits match filters //"}
                  </p>
                  {(filterLayer !== "all" || filterRarity !== "all") && (
                    <button onClick={() => { setFilterLayer("all"); setFilterRarity("all"); }}
                      className="mt-3 text-xs text-primary/60 font-mono underline hover:text-primary">
                      clear filters
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                {filteredStash.map((item, idx) => (
                  <StashCard
                    key={item.id}
                    item={item}
                    index={idx}
                    activeNft={activeNft}
                    onEquip={() => handleEquip(item.id)}
                    onHover={() => item.trait.imageUrl && setHoverTrait({ imageUrl: item.trait.imageUrl, name: item.trait.name, category: item.trait.category })}
                    onHoverEnd={() => setHoverTrait(null)}
                    isEquipping={applyTrait.isPending && (applyTrait.variables?.data as { lockerItemId?: number })?.lockerItemId === item.id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Stash trait card ────────────────────────────────────────────── */

interface StashCardProps {
  item: {
    id: number; quantity: number; purchasedAt: string;
    equippedToTokenId: number | null;
    trait: { id: number; name: string; category: string; rarity: string; imageUrl?: string | null; mediaType?: string };
  };
  index: number;
  activeNft: { tokenId: number; equippedTraits: { category: string }[] } | null;
  onEquip: () => void;
  onHover: () => void;
  onHoverEnd: () => void;
  isEquipping: boolean;
}

function StashCard({ item, activeNft, onEquip, onHover, onHoverEnd, isEquipping }: StashCardProps) {
  const isEquipped      = item.equippedToTokenId !== null;
  const equippedToActive = activeNft && item.equippedToTokenId === activeNft.tokenId;
  const sameCategory    = activeNft?.equippedTraits.some(et => et.category === item.trait.category);
  const { pill, glow }  = getRarityColor(item.trait.rarity);

  return (
    <div
      className="group relative overflow-hidden transition-all cursor-pointer"
      style={{
        background: 'linear-gradient(160deg,#1c1228,#100b18)',
        border: isEquipped ? '1px solid rgba(255,200,0,0.3)' : '1px solid rgba(157,0,255,0.18)',
        boxShadow: `0 0 0 rgba(157,0,255,0)`,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 16px ${glow}`;
        (e.currentTarget as HTMLDivElement).style.borderColor = isEquipped ? 'rgba(255,200,0,0.5)' : 'rgba(157,0,255,0.5)';
        onHover();
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 rgba(157,0,255,0)';
        (e.currentTarget as HTMLDivElement).style.borderColor = isEquipped ? 'rgba(255,200,0,0.3)' : 'rgba(157,0,255,0.18)';
        onHoverEnd();
      }}
    >
      {/* Equipped ribbon */}
      {isEquipped && (
        <div className="absolute top-0 right-0 z-10 overflow-hidden w-12 h-12">
          <div className="text-[8px] font-bold uppercase tracking-wide py-0.5 text-center w-20 transform rotate-45 absolute top-3 -right-5"
            style={{ background: 'hsl(43 100% 52%)', color: '#000' }}>
            {equippedToActive ? 'On' : 'Used'}
          </div>
        </div>
      )}

      {/* Image */}
      <div className="relative aspect-square overflow-hidden">
        <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 50%,${glow} 0%,transparent 70%)`, opacity: 0.5 }} />
        {item.trait.imageUrl ? (
          <TraitMedia url={item.trait.imageUrl} mediaType={item.trait.mediaType} alt={item.trait.name}
            className={`w-full h-full object-cover transition-transform ${isEquipped ? 'opacity-60 grayscale' : 'group-hover:scale-105'}`}
            showBadge />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl font-black text-muted-foreground/20 uppercase" style={BANGERS}>
            {item.trait.category.slice(0, 3)}
          </div>
        )}

        {/* Rarity pill */}
        <div className="absolute bottom-1 left-1">
          <span className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 border ${pill}`} style={BANGERS}>
            {item.trait.rarity}
          </span>
        </div>

        {/* Qty */}
        <div className="absolute top-1 left-1">
          <span className="text-[10px] font-mono bg-black/70 px-1.5 py-0.5 border border-primary/20">×{item.quantity}</span>
        </div>

        {/* Equip overlay on hover */}
        {!isEquipped && activeNft && (
          <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <button onClick={onEquip} disabled={isEquipping}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase text-white transition-all"
              style={{ ...BANGERS, background: sameCategory ? 'linear-gradient(135deg,hsl(43 100% 45%),hsl(43 100% 35%))' : 'linear-gradient(135deg,hsl(272 100% 50%),hsl(272 100% 38%))', boxShadow: '0 0 14px rgba(0,0,0,0.5)' }}>
              {isEquipping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {isEquipping ? '...' : sameCategory ? 'Swap' : 'Equip'}
            </button>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-2 py-1.5" style={{ borderTop: '1px solid rgba(157,0,255,0.12)' }}>
        <div className="text-[11px] font-bold truncate leading-tight">{item.trait.name}</div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[9px] font-mono text-primary/60 uppercase">{item.trait.category}</span>
          {item.equippedToTokenId && (
            <span className="text-[9px] font-mono text-accent flex items-center gap-0.5">
              <Fingerprint className="w-2 h-2" />#{item.equippedToTokenId}
            </span>
          )}
        </div>
        <div className="text-[9px] text-muted-foreground/40 font-mono mt-0.5">
          {format(new Date(item.purchasedAt), "MMM d")}
        </div>
      </div>
    </div>
  );
}
