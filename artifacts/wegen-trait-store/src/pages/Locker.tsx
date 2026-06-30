import { useState, useMemo, useRef } from "react";
import { TraitMedia } from "@/components/TraitMedia";
import { useWallet } from "@/contexts/WalletContext";
import { useCollection } from "@/contexts/CollectionContext";
import { WalletConnectGuard } from "@/components/shared/WalletConnectGuard";
import {
  useApplyTrait,
  useRemoveTrait,
  useConfirmTraits,
  useListVariantCollections,
  useGetVariantsByCollection,
  getGetLockerQueryKey,
  getGetUserNftsQueryKey,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Fingerprint, Lock, Unlock, Gem, Loader2, X, Plus, Eye,
  ChevronDown, SlidersHorizontal, Package, CheckCircle2, Zap, ExternalLink,
  Database, Layers,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
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

/* ─── Demo state types ────────────────────────────────────────────── */

type DemoNft = {
  tokenId: number; name: string; imageUrl: string | null;
  equippedTraits: { category: string; trait: { id: number; name: string; imageUrl?: string | null; mediaType?: string } }[];
};
type DemoItem = {
  id: number; quantity: number; purchasedAt: string; equippedToTokenId: number | null;
  trait: { id: number; name: string; category: string; rarity: string; imageUrl?: string | null; mediaType?: string };
};

/* ─── Main workspace ──────────────────────────────────────────────── */

function LockerContent({ demo = false }: { demo?: boolean }) {
  const { walletAddress } = useWallet();
  const { collection, collectionLabel } = useCollection();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(demo);
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(demo ? 420 : null);
  const [hoverTrait, setHoverTrait] = useState<{ imageUrl: string; name: string; category: string } | null>(null);
  const [filterLayer, setFilterLayer]   = useState("all");
  const [filterRarity, setFilterRarity] = useState("all");
  const [sortBy, setSortBy]             = useState<"rarity-desc" | "rarity-asc" | "name" | "date">("rarity-desc");
  const [confirmOpen, setConfirmOpen]   = useState(false);
  const [confirmedTx, setConfirmedTx]   = useState<string | null>(null);

  const [demoNfts, setDemoNfts]           = useState<DemoNft[]>(() => SAMPLE_NFTS.map(n => ({ ...n, equippedTraits: n.equippedTraits.map(e => ({ ...e })) })));
  const [demoItems, setDemoItems]         = useState<DemoItem[]>(() => DEMO_LOCKER_ITEMS.map(i => ({ ...i })));
  const [demoEquipping, setDemoEquipping] = useState<number | null>(null);

  const [draggingItemId, setDraggingItemId] = useState<number | null>(null);
  const [dragOverPreview, setDragOverPreview] = useState(false);
  const dragEnterCount = useRef(0);
  const [selectedVariantPack, setSelectedVariantPack] = useState<string | null>(null);

  const lockerQueryKey = [...getGetLockerQueryKey(walletAddress || ""), collection];
  const nftsQueryKey   = [...getGetUserNftsQueryKey(walletAddress || ""), collection];

  const { data: lockerData, isLoading: isLoadingLocker } = useQuery({
    queryKey: lockerQueryKey,
    enabled: !!walletAddress && !demo,
    queryFn: async () => {
      const res = await fetch(`/api/locker/${walletAddress}?nftCollection=${encodeURIComponent(collection)}`);
      if (!res.ok) throw new Error("Failed to load locker");
      return res.json();
    },
  });
  const { data: nftsData, isLoading: isLoadingNfts } = useQuery({
    queryKey: nftsQueryKey,
    enabled: !!walletAddress && !demo,
    queryFn: async () => {
      const res = await fetch(`/api/nfts/${walletAddress}?nftCollection=${encodeURIComponent(collection)}`);
      if (!res.ok) throw new Error("Failed to load NFTs");
      return res.json();
    },
  });

  // Variant packs available for this collection (nfts/demo resolved before activeNft)
  const { data: variantColData } = useListVariantCollections(
    { nftCollection: collection },
    { query: { enabled: true } },
  );
  const variantPacks = variantColData?.collections ?? [];

  // Variant image map for the selected pack
  const { data: variantMapData, isLoading: isLoadingVariant } = useGetVariantsByCollection(
    { variantPack: selectedVariantPack ?? "", nftCollection: collection },
    { query: { enabled: !!selectedVariantPack } },
  );
  const variantMap = variantMapData?.variantMap ?? {};

  const applyTrait = useApplyTrait({
    mutation: {
      onSuccess: (_data, variables) => {
        const item = lockerData?.items?.find((i: { id: number }) => i.id === variables.data.lockerItemId);
        const replacing = activeNft?.equippedTraits.some((et: { category: string }) => et.category === item?.trait?.category);
        toast({ title: replacing ? "Trait Swapped!" : "Trait Equipped!", description: replacing ? "Previous trait returned to stash." : "Looking fresh." });
        queryClient.invalidateQueries({ queryKey: nftsQueryKey });
        queryClient.invalidateQueries({ queryKey: lockerQueryKey });
      },
      onError: () => toast({ title: "Error", description: "Failed to equip trait.", variant: "destructive" }),
    },
  });

  const removeTrait = useRemoveTrait({
    mutation: {
      onSuccess: () => {
        toast({ title: "Trait Removed", description: "Returned to your stash." });
        queryClient.invalidateQueries({ queryKey: nftsQueryKey });
        queryClient.invalidateQueries({ queryKey: lockerQueryKey });
      },
      onError: () => toast({ title: "Error", description: "Failed to remove trait.", variant: "destructive" }),
    },
  });

  const confirmTraits = useConfirmTraits({
    mutation: {
      onSuccess: (data) => {
        setConfirmedTx(data.txHash);
        setConfirmOpen(false);
        toast({
          title: "Traits Confirmed On-Chain!",
          description: `Tx: ${data.txHash.slice(0, 10)}…${data.txHash.slice(-6)}`,
        });
      },
      onError: () => toast({ title: "Error", description: "Failed to confirm traits on-chain.", variant: "destructive" }),
    },
  });

  const handleConfirm = () => {
    if (demo) {
      setTimeout(() => {
        const fakeTx = "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
        setConfirmedTx(fakeTx);
        setConfirmOpen(false);
        toast({ title: "Traits Confirmed On-Chain!", description: `Tx: ${fakeTx.slice(0, 10)}…${fakeTx.slice(-6)}` });
      }, 1800);
      return;
    }
    if (!walletAddress || !activeNft) return;
    confirmTraits.mutate({ tokenId: activeNft.tokenId, data: { walletAddress, variantPack: selectedVariantPack ?? undefined } });
  };

  const nfts        = demo ? demoNfts  : (nftsData?.nfts ?? []);
  const lockerItems = demo ? demoItems : (lockerData?.items ?? []);
  const activeNft   = (selectedTokenId != null ? nfts.find(n => n.tokenId === selectedTokenId) : nfts[0]) ?? null;

  const allLayers   = useMemo(() => Array.from(new Set(lockerItems.map(i => i.trait.category))).sort(), [lockerItems]);
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

  // Returns the variant-overridden image URL for a trait (falls back to default)
  const getVariantImageUrl = (traitId: number, defaultUrl?: string | null): string | null => {
    if (selectedVariantPack && !isLoadingVariant) {
      const entry = variantMap[String(traitId)];
      if (entry?.imageUrl) return entry.imageUrl;
    }
    return defaultUrl ?? null;
  };

  const handleEquip = (lockerItemId: number) => {
    if (!activeNft) return;
    if (demo) {
      const item = demoItems.find(i => i.id === lockerItemId);
      if (!item) return;
      const tokenId = activeNft.tokenId;
      const replacing = activeNft.equippedTraits.some(et => et.category === item.trait.category);
      setDemoEquipping(lockerItemId);
      setTimeout(() => {
        setDemoEquipping(null);
        setDemoItems(prev => prev.map(i => {
          if (i.trait.category === item.trait.category && i.equippedToTokenId === tokenId) return { ...i, equippedToTokenId: null };
          if (i.id === lockerItemId) return { ...i, equippedToTokenId: tokenId };
          return i;
        }));
        setDemoNfts(prev => prev.map(n => {
          if (n.tokenId !== tokenId) return n;
          const filtered = n.equippedTraits.filter(et => et.category !== item.trait.category);
          return { ...n, equippedTraits: [...filtered, { category: item.trait.category, trait: { id: item.trait.id, name: item.trait.name, imageUrl: item.trait.imageUrl, mediaType: item.trait.mediaType } }] };
        }));
        toast({ title: replacing ? "Trait Swapped!" : "Trait Equipped!", description: replacing ? "Swapped out the old one." : "Looking fresh." });
      }, 350);
      return;
    }
    if (!walletAddress) return;
    applyTrait.mutate({ tokenId: activeNft.tokenId, data: { lockerItemId, walletAddress } });
  };

  const handleRemove = (category: string) => {
    if (!activeNft) return;
    if (demo) {
      setDemoNfts(prev => prev.map(n =>
        n.tokenId === activeNft.tokenId
          ? { ...n, equippedTraits: n.equippedTraits.filter(et => et.category !== category) }
          : n
      ));
      setDemoItems(prev => prev.map(i =>
        i.trait.category === category && i.equippedToTokenId === activeNft.tokenId
          ? { ...i, equippedToTokenId: null }
          : i
      ));
      toast({ title: "Trait Removed", description: "Returned to your stash." });
      return;
    }
    if (!walletAddress) return;
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
            <span className="text-muted-foreground text-xs font-mono">// no {collectionLabel} found //</span>
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

      {/* ── NFT Preview Panel ── */}
      <div
        className="flex-shrink-0 border-b"
        style={{ background: 'linear-gradient(180deg,rgba(22,14,34,0.98),rgba(16,11,24,0.97))', borderColor: 'rgba(157,0,255,0.18)' }}
      >
        {activeNft ? (
          <div className="flex items-start gap-4 px-4 py-3">

            {/* Composited preview image — drop target */}
            <div
              className="relative flex-shrink-0 overflow-hidden transition-all"
              style={{
                width: 280, height: 280, background: '#0a0612',
                border: dragOverPreview
                  ? '2px solid rgba(157,0,255,0.9)'
                  : '1px solid rgba(157,0,255,0.25)',
                boxShadow: dragOverPreview
                  ? '0 0 24px rgba(157,0,255,0.5), inset 0 0 20px rgba(157,0,255,0.08)'
                  : 'none',
              }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
              onDragEnter={() => { dragEnterCount.current++; setDragOverPreview(true); }}
              onDragLeave={() => { dragEnterCount.current--; if (dragEnterCount.current <= 0) { dragEnterCount.current = 0; setDragOverPreview(false); } }}
              onDrop={(e) => {
                e.preventDefault();
                dragEnterCount.current = 0;
                setDragOverPreview(false);
                setDraggingItemId(null);
                const id = Number(e.dataTransfer.getData("lockerItemId"));
                if (!isNaN(id) && id !== 0) handleEquip(id);
              }}
            >
              {/* Base NFT image */}
              {activeNft.imageUrl && (
                <img src={activeNft.imageUrl} alt={activeNft.name} className="absolute inset-0 w-full h-full object-cover" />
              )}

              {/* Equipped trait layers (skip hovered category) */}
              {activeNft.equippedTraits
                .filter(et => !hoverTrait || et.category !== hoverTrait.category)
                .map(et => {
                  const imgUrl = getVariantImageUrl(et.trait.id, et.trait.imageUrl);
                  return imgUrl ? (
                    <img key={et.category} src={imgUrl} alt={et.trait.name}
                      className="absolute inset-0 w-full h-full object-cover" />
                  ) : null;
                })}

              {/* Hover preview layer */}
              {hoverTrait?.imageUrl && (
                <img src={hoverTrait.imageUrl} alt={hoverTrait.name}
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ outline: '2px solid rgba(157,0,255,0.6)' }} />
              )}

              {/* Empty state */}
              {!activeNft.imageUrl && activeNft.equippedTraits.length === 0 && !hoverTrait && !dragOverPreview && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Gem className="w-14 h-14 text-primary/20 mx-auto mb-2" />
                    <p className="text-[10px] font-mono text-muted-foreground/40 uppercase">// hover or drag a trait to preview //</p>
                  </div>
                </div>
              )}

              {/* Drag-over overlay */}
              {dragOverPreview && (
                <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
                  style={{ background: 'rgba(157,0,255,0.08)' }}>
                  <div className="text-center">
                    <div className="text-3xl mb-2">◈</div>
                    <p className="text-[11px] font-mono uppercase tracking-widest" style={{ color: 'hsl(272 100% 78%)' }}>
                      Drop to equip
                    </p>
                  </div>
                </div>
              )}

              {/* Token label */}
              <div className="absolute top-2 left-2">
                <span className="text-xs font-mono px-1.5 py-0.5" style={{ background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(157,0,255,0.3)', color: 'hsl(272 100% 72%)' }}>
                  #{activeNft.tokenId}
                </span>
              </div>

              {/* Preview badge */}
              {hoverTrait && (
                <div className="absolute bottom-2 left-2 right-2">
                  <div className="px-2 py-1 text-[10px] font-mono text-center truncate"
                    style={{ background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(157,0,255,0.5)', color: 'hsl(272 100% 78%)' }}>
                    ◈ PREVIEW · {hoverTrait.category.toUpperCase()}: {hoverTrait.name}
                  </div>
                </div>
              )}
            </div>

            {/* Right side: NFT info + equipped strip + confirm */}
            <div className="flex-1 min-w-0 flex flex-col gap-2.5 py-1" style={{ minHeight: 280 }}>

              {/* NFT name + equipped count */}
              <div>
                <div className="text-lg font-bold leading-tight" style={BANGERS}>{activeNft.name}</div>
                <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                  {activeNft.equippedTraits.length} trait{activeNft.equippedTraits.length !== 1 ? 's' : ''} equipped
                  {hoverTrait && <span className="ml-1.5 text-primary">· previewing {hoverTrait.category}</span>}
                </div>
              </div>

              {/* Equipped traits strip */}
              <div className="flex-1 flex flex-col gap-1.5 min-h-0">
                <div className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest">Equipped Traits</div>

                {activeNft.equippedTraits.length === 0 ? (
                  <div className="flex items-center gap-2 py-2">
                    <Package className="w-4 h-4 text-muted-foreground/20" />
                    <span className="text-[10px] font-mono text-muted-foreground/35 uppercase">// nothing equipped yet — hover a trait below to preview //</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {activeNft.equippedTraits.map(et => (
                      <div
                        key={et.category}
                        className="group/et flex items-center gap-1.5 px-2 py-1 transition-all"
                        style={{ background: 'rgba(157,0,255,0.08)', border: '1px solid rgba(157,0,255,0.2)' }}
                      >
                        {et.trait.imageUrl ? (
                          <div className="w-6 h-6 flex-shrink-0 overflow-hidden bg-black/40">
                            <TraitMedia url={et.trait.imageUrl} mediaType={(et.trait as Record<string,unknown>).mediaType as string}
                              alt={et.trait.name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-primary"
                            style={{ background: 'rgba(157,0,255,0.2)' }}>
                            {et.category[0]}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold truncate max-w-[100px]">{et.trait.name}</div>
                          <div className="text-[8px] font-mono text-primary/50 uppercase">{et.category}</div>
                        </div>
                        <button
                          onClick={() => handleRemove(et.category)}
                          disabled={removeTrait.isPending}
                          className="ml-0.5 w-4 h-4 flex items-center justify-center transition-all flex-shrink-0 opacity-40 group-hover/et:opacity-100 hover:text-red-400 text-muted-foreground"
                        >
                          {removeTrait.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Controls row: Confirm button + tx badge */}
              <div className="flex items-center gap-2 flex-wrap mt-auto">
                {activeNft.equippedTraits.length > 0 && (
                  <button
                    onClick={() => setConfirmOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase transition-all"
                    style={{
                      ...BANGERS,
                      background: 'linear-gradient(90deg,rgba(255,200,0,0.15),rgba(157,0,255,0.15))',
                      border: '1px solid rgba(255,200,0,0.5)',
                      color: 'hsl(43 100% 65%)',
                      boxShadow: '0 0 10px rgba(255,200,0,0.08)',
                    }}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    CONFIRM ON-CHAIN
                  </button>
                )}

                {confirmedTx && (
                  <a
                    href={`https://etherscan.io/tx/${confirmedTx}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2 py-1.5 text-[10px] font-mono transition-all"
                    style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', color: 'hsl(142 60% 55%)' }}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    {confirmedTx.slice(0, 8)}…
                    <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                  </a>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* No NFT state */
          <div className="flex items-center justify-center py-6 px-4">
            {isLoadingNfts ? (
              <div className="flex gap-3">
                <Skeleton className="w-[280px] h-[280px]" />
                <div className="flex flex-col gap-2 py-1">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-48 mt-2" />
                </div>
              </div>
            ) : (
              <div className="text-center">
                <Gem className="w-12 h-12 text-primary/15 mx-auto mb-2" />
                <p className="text-xs font-mono text-muted-foreground/40 uppercase">// no {collectionLabel} found in your wallet //</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Variant Tabs Band ── */}
      {activeNft && (
        <div
          className="flex-shrink-0 border-b"
          style={{
            background: 'linear-gradient(90deg,rgba(26,16,40,0.99),rgba(16,11,24,0.99))',
            borderColor: 'rgba(157,0,255,0.15)',
          }}
        >
          <div className="flex items-center gap-2 px-4 py-2.5 flex-wrap">

            {/* Section label */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Layers className="w-3 h-3 text-muted-foreground/50" />
              <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest">
                Variant Style
              </span>
            </div>

            {/* BASE tab */}
            <button
              onClick={() => setSelectedVariantPack(null)}
              className="flex-shrink-0 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition-all"
              style={{
                ...BANGERS,
                background: selectedVariantPack === null ? 'rgba(157,0,255,0.2)' : 'rgba(157,0,255,0.05)',
                border: selectedVariantPack === null ? '1px solid rgba(157,0,255,0.7)' : '1px solid rgba(157,0,255,0.2)',
                color: selectedVariantPack === null ? 'hsl(272 100% 78%)' : 'hsl(272 30% 60%)',
                boxShadow: selectedVariantPack === null ? '0 0 10px rgba(157,0,255,0.3)' : 'none',
              }}
            >
              BASE
            </button>

            {/* Variant pack tabs */}
            {variantPacks.map(pack => (
              <button
                key={pack}
                onClick={() => setSelectedVariantPack(selectedVariantPack === pack ? null : pack)}
                className="flex-shrink-0 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition-all"
                style={{
                  ...BANGERS,
                  background: selectedVariantPack === pack ? 'rgba(255,200,0,0.15)' : 'rgba(157,0,255,0.05)',
                  border: selectedVariantPack === pack ? '1px solid rgba(255,200,0,0.6)' : '1px solid rgba(157,0,255,0.2)',
                  color: selectedVariantPack === pack ? 'hsl(43 100% 65%)' : 'hsl(272 30% 60%)',
                  boxShadow: selectedVariantPack === pack ? '0 0 10px rgba(255,200,0,0.15)' : 'none',
                }}
              >
                {pack}
              </button>
            ))}

            {/* Loading spinner while fetching variant images */}
            {isLoadingVariant && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground/40 flex-shrink-0" />
            )}

            {/* Empty state hint when no variant packs exist */}
            {variantPacks.length === 0 && !isLoadingVariant && (
              <span className="text-[10px] font-mono text-muted-foreground/30 italic">
                No variant packs configured
              </span>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* SOC button */}
            {activeNft.equippedTraits.length > 0 && (
              <button
                onClick={() => setConfirmOpen(true)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase transition-all"
                style={{
                  ...BANGERS,
                  background: 'linear-gradient(90deg,rgba(255,200,0,0.18),rgba(157,0,255,0.18))',
                  border: '1px solid rgba(255,200,0,0.55)',
                  color: 'hsl(43 100% 65%)',
                  boxShadow: '0 0 12px rgba(255,200,0,0.1)',
                }}
              >
                <Database className="w-3.5 h-3.5" />
                SOC
                {selectedVariantPack && (
                  <span className="text-[9px] ml-0.5 opacity-70 normal-case" style={{ fontFamily: 'monospace' }}>
                    · {selectedVariantPack}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Variant active hint */}
          {selectedVariantPack && (
            <div className="px-4 pb-2 text-[10px] font-mono" style={{ color: 'hsl(43 100% 55%)' }}>
              ◈ Previewing <span className="font-bold">{selectedVariantPack}</span> variant above — click SOC to save this style on-chain
            </div>
          )}
        </div>
      )}

      {/* ── Traits Grid Section ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Filter/sort bar */}
        <div className="flex-shrink-0 flex flex-wrap items-center gap-2 px-4 py-2 border-b"
          style={{ background: 'rgba(14,9,22,0.98)', borderColor: 'rgba(157,0,255,0.12)' }}>

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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
              {filteredStash.map((item, idx) => (
                <StashCard
                  key={item.id}
                  item={item}
                  index={idx}
                  activeNft={activeNft}
                  onEquip={() => handleEquip(item.id)}
                  onHover={() => item.trait.imageUrl && setHoverTrait({ imageUrl: item.trait.imageUrl, name: item.trait.name, category: item.trait.category })}
                  onHoverEnd={() => setHoverTrait(null)}
                  isEquipping={demo ? demoEquipping === item.id : (applyTrait.isPending && (applyTrait.variables?.data as { lockerItemId?: number })?.lockerItemId === item.id)}
                  isHovered={hoverTrait?.name === item.trait.name && hoverTrait?.category === item.trait.category}
                  onDragStart={(id) => setDraggingItemId(id)}
                  onDragEnd={() => setDraggingItemId(null)}
                  isDragging={draggingItemId === item.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Confirm Trait Swap Dialog ── */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent
          style={{
            background: 'linear-gradient(160deg,rgba(18,10,28,0.99),rgba(12,7,20,0.99))',
            border: '1px solid rgba(255,200,0,0.35)',
            boxShadow: '0 0 40px rgba(157,0,255,0.25), 0 0 80px rgba(255,200,0,0.08)',
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2" style={BANGERS}>
              <Database className="w-5 h-5 text-yellow-400" />
              <span style={{ color: 'hsl(43 100% 65%)' }}>SAVE ON CHAIN (SOC)</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-xs space-y-3 mt-2" asChild>
              <div>
                <p className="text-muted-foreground/80">
                  This will push the current trait loadout for{' '}
                  <span className="text-primary font-bold">{collectionLabel.replace(/s$/, "")} #{activeNft?.tokenId}</span>{' '}
                  to Ethereum mainnet and update its on-chain metadata.
                </p>

                {/* Variant style row */}
                <div className="flex items-center gap-2 px-2.5 py-2 mt-2"
                  style={{ background: 'rgba(255,200,0,0.06)', border: '1px solid rgba(255,200,0,0.2)' }}>
                  <Layers className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'hsl(43 100% 65%)' }} />
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 flex-shrink-0">Variant Style</span>
                  <span className="font-bold text-xs ml-auto" style={{ color: selectedVariantPack ? 'hsl(43 100% 65%)' : 'hsl(272 100% 72%)' }}>
                    {selectedVariantPack ?? "BASE (default)"}
                  </span>
                </div>

                {activeNft && activeNft.equippedTraits.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-2">Traits being applied:</p>
                    {activeNft.equippedTraits.map(et => (
                      <div key={et.category} className="flex items-center gap-2 px-2.5 py-1.5 rounded"
                        style={{ background: 'rgba(157,0,255,0.08)', border: '1px solid rgba(157,0,255,0.2)' }}>
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'hsl(272 100% 65%)' }} />
                        <span className="text-[10px] font-mono text-primary/60 uppercase w-20 flex-shrink-0">{et.category}</span>
                        <span className="text-xs font-bold text-foreground truncate">{et.trait.name}</span>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-[10px] text-yellow-500/60 mt-3">
                  ⚡ A gas fee will be required to complete the transaction in your wallet.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel
              className="font-mono text-xs"
              style={{ background: 'rgba(157,0,255,0.08)', border: '1px solid rgba(157,0,255,0.25)', color: 'hsl(272 50% 70%)' }}
            >
              CANCEL
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleConfirm(); }}
              disabled={confirmTraits.isPending}
              className="flex items-center gap-2 font-bold uppercase"
              style={{
                ...BANGERS,
                background: 'linear-gradient(90deg,rgba(255,200,0,0.2),rgba(157,0,255,0.2))',
                border: '1px solid rgba(255,200,0,0.6)',
                color: 'hsl(43 100% 65%)',
                boxShadow: '0 0 12px rgba(255,200,0,0.15)',
              }}
            >
              {confirmTraits.isPending ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />SIGNING…</>
              ) : (
                <><Zap className="w-3.5 h-3.5" />PUSH TO CHAIN</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  isHovered?: boolean;
  onDragStart: (id: number) => void;
  onDragEnd: () => void;
  isDragging?: boolean;
}

function StashCard({ item, activeNft, onEquip, onHover, onHoverEnd, isEquipping, isHovered, onDragStart, onDragEnd, isDragging }: StashCardProps) {
  const isEquipped       = item.equippedToTokenId !== null;
  const equippedToActive = activeNft && item.equippedToTokenId === activeNft.tokenId;
  const sameCategory     = activeNft?.equippedTraits.some(et => et.category === item.trait.category);
  const { pill, glow }   = getRarityColor(item.trait.rarity);
  const canDrag          = activeNft && !equippedToActive;

  return (
    <div
      className="group relative overflow-hidden transition-all cursor-grab active:cursor-grabbing"
      draggable={!!canDrag}
      onDragStart={(e) => {
        e.dataTransfer.setData("lockerItemId", String(item.id));
        e.dataTransfer.effectAllowed = "move";
        onDragStart(item.id);
      }}
      onDragEnd={() => onDragEnd()}
      style={{
        background: 'linear-gradient(160deg,#1c1228,#100b18)',
        border: isHovered
          ? '1px solid rgba(157,0,255,0.7)'
          : isEquipped ? '1px solid rgba(255,200,0,0.3)' : '1px solid rgba(157,0,255,0.18)',
        boxShadow: isHovered ? `0 0 20px ${glow}` : '0 0 0 rgba(157,0,255,0)',
        opacity: isDragging ? 0.45 : 1,
        transform: isDragging ? 'scale(0.97)' : undefined,
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

      {/* Hover preview badge overlay */}
      {isHovered && (
        <div className="absolute top-0 left-0 right-0 z-10 px-1.5 py-0.5 text-center"
          style={{ background: 'rgba(157,0,255,0.85)' }}>
          <span className="text-[8px] font-bold uppercase tracking-widest text-white">◈ Previewing</span>
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
