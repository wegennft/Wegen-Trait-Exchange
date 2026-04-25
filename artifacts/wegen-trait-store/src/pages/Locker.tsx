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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Package, Fingerprint, Lock, Unlock, Gem, ChevronRight,
  Loader2, X, Plus, Eye,
} from "lucide-react";
import { format } from "date-fns";

const BANGERS = { fontFamily: "'Bungee', Impact, sans-serif", letterSpacing: '0.08em' };

const SAMPLE_LOCKER_ITEMS = [
  {
    id: -1, quantity: 1,
    purchasedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    equippedToTokenId: 42,
    trait: { id: 266, name: "420 Black And Green", category: "Background", rarity: "rare",
      imageUrl: "/api/storage/objects/uploads/86f560bd-abc4-4307-8e2b-960a44c3cee1", mediaType: "image" },
  },
  {
    id: -2, quantity: 2,
    purchasedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    equippedToTokenId: null,
    trait: { id: 369, name: "Gold Body", category: "Body", rarity: "legendary",
      imageUrl: "/api/storage/objects/uploads/4858e6ce-c4f2-48d2-8c4b-e5ef9d39f5b5", mediaType: "image" },
  },
  {
    id: -3, quantity: 1,
    purchasedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
    equippedToTokenId: null,
    trait: { id: 272, name: "Arcade Spot", category: "Background", rarity: "uncommon",
      imageUrl: "/api/storage/objects/uploads/35ac29b2-f60b-4209-86fc-baaabac561a3", mediaType: "image" },
  },
  {
    id: -4, quantity: 1,
    purchasedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
    equippedToTokenId: null,
    trait: { id: 365, name: "Crimson", category: "Body", rarity: "rare",
      imageUrl: "/api/storage/objects/uploads/d7bb5b5b-b090-4de6-a305-9ea96d875308", mediaType: "image" },
  },
  {
    id: -5, quantity: 3,
    purchasedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    equippedToTokenId: null,
    trait: { id: 270, name: "Alchemical Mixdown", category: "Background", rarity: "uncommon",
      imageUrl: "/api/storage/objects/uploads/c1f47943-e8dd-4efc-9ea4-37dc54f17a90", mediaType: "image" },
  },
  {
    id: -6, quantity: 1,
    purchasedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    equippedToTokenId: null,
    trait: { id: 362, name: "Azure", category: "Body", rarity: "common",
      imageUrl: "/api/storage/objects/uploads/34f5dc22-fb4c-4fed-9434-9efdf23da646", mediaType: "image" },
  },
] as const;

const SAMPLE_NFTS = [
  {
    tokenId: 420,
    name: "Wegen #420",
    imageUrl: null as string | null,
    equippedTraits: [
      {
        category: "Background",
        trait: {
          id: 266, name: "420 Black And Green",
          imageUrl: "/api/storage/objects/uploads/86f560bd-abc4-4307-8e2b-960a44c3cee1",
          mediaType: "image",
        },
      },
    ],
  },
  {
    tokenId: 69,
    name: "Wegen #69",
    imageUrl: null as string | null,
    equippedTraits: [
      {
        category: "Body",
        trait: {
          id: 362, name: "Azure",
          imageUrl: "/api/storage/objects/uploads/34f5dc22-fb4c-4fed-9434-9efdf23da646",
          mediaType: "image",
        },
      },
    ],
  },
  {
    tokenId: 7,
    name: "Wegen #7",
    imageUrl: null as string | null,
    equippedTraits: [],
  },
];

const DEMO_LOCKER_ITEMS = [
  {
    id: -1, quantity: 1,
    purchasedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    equippedToTokenId: 420,
    trait: { id: 266, name: "420 Black And Green", category: "Background", rarity: "rare",
      imageUrl: "/api/storage/objects/uploads/86f560bd-abc4-4307-8e2b-960a44c3cee1", mediaType: "image" },
  },
  {
    id: -2, quantity: 2,
    purchasedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    equippedToTokenId: null,
    trait: { id: 369, name: "Gold Body", category: "Body", rarity: "legendary",
      imageUrl: "/api/storage/objects/uploads/4858e6ce-c4f2-48d2-8c4b-e5ef9d39f5b5", mediaType: "image" },
  },
  {
    id: -3, quantity: 1,
    purchasedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
    equippedToTokenId: null,
    trait: { id: 272, name: "Arcade Spot", category: "Background", rarity: "uncommon",
      imageUrl: "/api/storage/objects/uploads/35ac29b2-f60b-4209-86fc-baaabac561a3", mediaType: "image" },
  },
  {
    id: -4, quantity: 1,
    purchasedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
    equippedToTokenId: null,
    trait: { id: 365, name: "Crimson", category: "Body", rarity: "rare",
      imageUrl: "/api/storage/objects/uploads/d7bb5b5b-b090-4de6-a305-9ea96d875308", mediaType: "image" },
  },
  {
    id: -5, quantity: 3,
    purchasedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    equippedToTokenId: null,
    trait: { id: 270, name: "Alchemical Mixdown", category: "Background", rarity: "uncommon",
      imageUrl: "/api/storage/objects/uploads/c1f47943-e8dd-4efc-9ea4-37dc54f17a90", mediaType: "image" },
  },
  {
    id: -6, quantity: 1,
    purchasedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    equippedToTokenId: 69,
    trait: { id: 362, name: "Azure", category: "Body", rarity: "common",
      imageUrl: "/api/storage/objects/uploads/34f5dc22-fb4c-4fed-9434-9efdf23da646", mediaType: "image" },
  },
];

function getRarityColor(rarity: string) {
  switch (rarity) {
    case "legendary": return "text-yellow-400 border-yellow-500/60 bg-yellow-500/10";
    case "rare":      return "text-blue-400 border-blue-500/60 bg-blue-500/10";
    case "uncommon":  return "text-green-400 border-green-500/60 bg-green-500/10";
    default:          return "text-gray-400 border-gray-500/60 bg-gray-500/10";
  }
}

export function Locker() {
  const isDemo = useMemo(() => new URLSearchParams(window.location.search).has("demo"), []);
  if (isDemo) return <LockerContent demo />;
  return (
    <WalletConnectGuard message="Connect your wallet to open your Trait Locker.">
      <LockerContent />
    </WalletConnectGuard>
  );
}

function LockerContent({ demo = false }: { demo?: boolean }) {
  const { walletAddress } = useWallet();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(demo);
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(demo ? 420 : null);
  const [hoverTrait, setHoverTrait] = useState<{ imageUrl: string; name: string; category: string } | null>(null);

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
  const activeNft = selectedTokenId != null ? nfts.find(n => n.tokenId === selectedTokenId) : nfts[0] ?? null;

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
    <div className="space-y-10 animate-in fade-in duration-500">

      {/* ── Demo Banner ── */}
      {demo && (
        <div
          className="flex items-center justify-center gap-3 px-5 py-2.5 text-sm font-mono"
          style={{
            background: 'linear-gradient(90deg, rgba(255,200,0,0.12), rgba(255,200,0,0.06))',
            border: '1px solid rgba(255,200,0,0.35)',
            borderLeft: '3px solid hsl(43 100% 52%)',
          }}
        >
          <Eye className="w-4 h-4 text-accent flex-shrink-0" />
          <span className="text-accent/90 uppercase tracking-widest text-xs">
            DEMO PREVIEW — showing sample locker with 6 traits &amp; 3 Wegens.
            Connect your wallet to use your real data.
          </span>
        </div>
      )}

      {/* ── Hero Header ── */}
      <div className="relative text-center py-6 overflow-hidden">
        <div className="absolute inset-0 brick-bg opacity-30" />
        <div className="relative z-10">
          <div className="text-7xl md:text-8xl text-primary inline-block graffiti-title" style={BANGERS}>TRAIT</div>
          <div className="text-7xl md:text-8xl text-accent inline-block graffiti-title-gold ml-3" style={BANGERS}>LOCKER</div>
          <p className="text-muted-foreground mt-2 font-mono text-sm uppercase tracking-widest">
            // Your stash. Your style. Keep it locked. //
          </p>
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8 items-start">

        {/* ══ Left: Physical Locker ══ */}
        <div className="flex flex-col items-center gap-4">
          <div className="locker-scene w-full max-w-[300px] mx-auto">
            <div className="relative" style={{ height: 460 }}>

              {/* Locker body */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{
                  background: 'linear-gradient(160deg, #1e1428 0%, #150f20 50%, #100b18 100%)',
                  border: '4px solid #3a2a50',
                  boxShadow: 'inset 0 0 30px rgba(0,0,0,0.8), 6px 6px 0 rgba(0,0,0,0.5)',
                }}
              >
                {isOpen && (
                  <div className="absolute inset-0 p-4 flex flex-col gap-2 overflow-hidden">
                    <div className="w-full h-1 bg-purple-900/60 rounded-full mt-16" />
                    <div className="flex flex-col gap-1 mt-3 px-2">
                      <span className="text-primary/50 text-xs" style={{ fontFamily: "'Permanent Marker', cursive", transform: 'rotate(-2deg)', display: 'inline-block' }}>
                        WEGEN 4 LIFE
                      </span>
                      <span className="text-accent/40 text-[10px]" style={{ fontFamily: "'Permanent Marker', cursive", transform: 'rotate(1deg)', display: 'inline-block', marginLeft: 20 }}>
                        NFT GANG ✦
                      </span>
                    </div>
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center">
                      <div className="text-4xl text-accent" style={BANGERS}>{lockerItems.length}</div>
                      <div className="text-muted-foreground text-xs font-mono uppercase tracking-widest">traits stored</div>
                    </div>
                  </div>
                )}
                <div className="absolute top-5 left-6 right-6 flex flex-col gap-1.5">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-full h-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.7)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.9)' }} />
                  ))}
                </div>
              </div>

              {/* Door */}
              <div className="locker-door absolute inset-0" style={{ transform: isOpen ? 'rotateY(-145deg)' : 'rotateY(0deg)' }}>
                <div
                  className="locker-door-back absolute inset-0"
                  style={{
                    background: 'linear-gradient(160deg, #3d2a5a 0%, #2a1d40 40%, #221632 100%)',
                    border: '4px solid #5a3d80',
                    boxShadow: isOpen ? 'none' : '4px 0 18px rgba(0,0,0,0.7), inset -2px 0 8px rgba(0,0,0,0.3)',
                  }}
                >
                  <div className="absolute inset-4" style={{ border: '2px solid rgba(157,0,255,0.3)', boxShadow: 'inset 2px 2px 8px rgba(0,0,0,0.5), 0 0 10px rgba(157,0,255,0.1)' }} />
                  <div className="absolute top-7 left-8 right-8 flex flex-col gap-1.5">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="w-full h-1.5 rounded-full" style={{ background: '#1a1028', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.9), 0 1px 0 rgba(255,255,255,0.04)' }} />
                    ))}
                  </div>
                  <div className="absolute top-24 left-1/2 -translate-x-1/2 px-4 py-1.5 text-center" style={{ background: 'linear-gradient(135deg, #b8860b, #ffd700, #b8860b)', boxShadow: '0 2px 8px rgba(0,0,0,0.6), 0 0 14px rgba(255,200,0,0.4)', minWidth: 80 }}>
                    <span className="text-black font-bold text-lg" style={BANGERS}>{walletAddress ? `#${walletAddress.slice(-4).toUpperCase()}` : '#????'}</span>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center flex-col gap-1 pt-16">
                    <div className="text-primary/60 text-3xl" style={{ fontFamily: "'Permanent Marker', cursive", transform: 'rotate(-3deg)', filter: 'drop-shadow(0 0 8px rgba(157,0,255,0.5))' }}>WGN</div>
                    <div className="text-accent/50 text-lg" style={{ fontFamily: "'Permanent Marker', cursive", transform: 'rotate(2deg)' }}>★ traits ★</div>
                  </div>
                  <div className="absolute bottom-20 left-1/2 -translate-x-1/2">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'radial-gradient(circle at 35% 35%, #4a3068, #1e1430)', border: '3px solid #5a3d80', boxShadow: '0 3px 8px rgba(0,0,0,0.6), inset 0 1px 3px rgba(157,0,255,0.2)' }}>
                      <div className="w-1 h-4 bg-purple-300/60 rounded-full" />
                    </div>
                    <div className="absolute -inset-1 rounded-full border border-purple-500/20" />
                  </div>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <div className="w-3 h-10 rounded-full" style={{ background: 'linear-gradient(to right, #ffd700, #b8860b)', boxShadow: '2px 2px 6px rgba(0,0,0,0.6), 0 0 8px rgba(255,200,0,0.3)' }} />
                  </div>
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
                    {isOpen ? <Unlock className="w-5 h-5 text-accent" style={{ filter: 'drop-shadow(0 0 6px rgba(255,200,0,0.8))' }} /> : <Lock className="w-5 h-5 text-primary" style={{ filter: 'drop-shadow(0 0 6px rgba(157,0,255,0.8))' }} />}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Open/close button */}
          <button
            onClick={() => setIsOpen(o => !o)}
            className={`w-full max-w-[300px] py-3 font-bold uppercase tracking-widest text-lg transition-all ${isOpen ? 'bg-secondary text-accent hover:bg-accent/10' : 'bg-primary text-white hover:bg-primary/90 neon-pulse'}`}
            style={{ ...BANGERS, border: isOpen ? '2px solid rgba(255,200,0,0.6)' : 'none', boxShadow: isOpen ? '0 0 16px rgba(255,200,0,0.25)' : undefined }}
          >
            {isOpen ? <><Lock className="inline w-5 h-5 mr-2 mb-0.5" />LOCK IT UP</> : <><Unlock className="inline w-5 h-5 mr-2 mb-0.5" />CRACK IT OPEN</>}
          </button>
        </div>

        {/* ══ Right Panel ══ */}
        <div className="space-y-8">

          {/* ── Wegen Selector ── */}
          {isLoadingNfts ? (
            <div className="flex gap-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-20 flex-shrink-0" />)}</div>
          ) : nfts.length > 0 ? (
            <div>
              <h2 className="text-xl text-foreground mb-3" style={BANGERS}>
                YOUR WEGENS
                <span className="ml-3 text-base text-muted-foreground" style={{ fontFamily: 'inherit' }}>// select to customize //</span>
              </h2>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {nfts.map(nft => {
                  const isSelected = (selectedTokenId ?? nfts[0]?.tokenId) === nft.tokenId;
                  return (
                    <button
                      key={nft.tokenId}
                      onClick={() => setSelectedTokenId(nft.tokenId)}
                      className="relative flex-shrink-0 w-24 overflow-hidden transition-all group"
                      style={{
                        background: 'linear-gradient(160deg, #1e1428, #100b18)',
                        border: isSelected ? '2px solid rgba(157,0,255,0.8)' : '1px solid rgba(157,0,255,0.2)',
                        boxShadow: isSelected ? '0 0 16px rgba(157,0,255,0.4)' : 'none',
                      }}
                    >
                      <div className="aspect-square relative overflow-hidden bg-secondary/30">
                        {nft.imageUrl
                          ? <img src={nft.imageUrl} alt={nft.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><Gem className="w-8 h-8 text-muted-foreground/30" /></div>
                        }
                        {isSelected && <div className="absolute inset-0 bg-primary/10" />}
                      </div>
                      <div className="p-1.5 text-left">
                        <div className="font-mono text-[9px] text-muted-foreground"><Fingerprint className="inline w-2.5 h-2.5 mr-0.5" />#{nft.tokenId}</div>
                        <div className="text-[10px] font-bold truncate mt-0.5 text-accent">{nft.equippedTraits.length} traits</div>
                      </div>
                      {isSelected && <div className="absolute top-1 left-1"><ChevronRight className="w-3.5 h-3.5 text-primary" /></div>}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* ── NFT Compositor (preview) ── */}
          {activeNft ? (
            <div
              className="rounded-xl overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, hsl(268 40% 5%), hsl(268 30% 3%))',
                border: '1px solid hsl(272 100% 62% / 0.3)',
                boxShadow: '0 0 40px hsl(272 100% 50% / 0.08)',
              }}
            >
              {/* Panel header */}
              <div className="px-5 pt-4 pb-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(157,0,255,0.15)' }}>
                <div>
                  <span className="text-lg text-primary" style={BANGERS}>
                    {activeNft.name}
                  </span>
                  <span className="ml-2 font-mono text-xs text-muted-foreground">#{activeNft.tokenId}</span>
                </div>
                {hoverTrait && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono" style={{ background: 'rgba(157,0,255,0.15)', border: '1px solid rgba(157,0,255,0.3)', color: 'hsl(272 100% 78%)' }}>
                    <Eye className="w-3 h-3" />
                    Previewing: {hoverTrait.name}
                  </div>
                )}
              </div>

              <div className="flex flex-col md:flex-row gap-0">

                {/* Composited NFT image */}
                <div className="relative md:w-72 flex-shrink-0 aspect-square bg-black/40">
                  {/* Base NFT */}
                  {activeNft.imageUrl && (
                    <img
                      src={activeNft.imageUrl}
                      alt={activeNft.name}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}
                  {/* Equipped trait layers */}
                  {activeNft.equippedTraits
                    .filter(et => !hoverTrait || et.category !== hoverTrait.category)
                    .map(et =>
                      et.trait.imageUrl ? (
                        <img
                          key={et.category}
                          src={et.trait.imageUrl}
                          alt={et.trait.name}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : null
                    )}
                  {/* Hover preview layer */}
                  {hoverTrait?.imageUrl && (
                    <img
                      src={hoverTrait.imageUrl}
                      alt={hoverTrait.name}
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ opacity: 0.92, outline: '2px solid hsl(272 100% 62% / 0.6)' }}
                    />
                  )}
                  {/* No image fallback */}
                  {!activeNft.imageUrl && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Gem className="w-20 h-20 text-muted-foreground/20" />
                    </div>
                  )}
                  {/* Hover badge overlay */}
                  {hoverTrait && (
                    <div className="absolute bottom-3 left-3 right-3">
                      <div className="px-3 py-1.5 text-xs font-mono text-center rounded" style={{ background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(157,0,255,0.4)', color: 'hsl(272 100% 78%)' }}>
                        ◈ PREVIEW — {hoverTrait.category.toUpperCase()}: {hoverTrait.name}
                      </div>
                    </div>
                  )}
                </div>

                {/* Equipped traits panel */}
                <div className="flex-1 p-4 min-w-0">
                  <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-3">
                    Equipped Traits ({activeNft.equippedTraits.length})
                  </div>

                  {activeNft.equippedTraits.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-8 text-center">
                      <Package className="w-10 h-10 text-muted-foreground/20 mb-3" />
                      <p className="text-xs font-mono text-muted-foreground/60 uppercase tracking-widest">
                        // No traits equipped yet //<br />
                        hover a trait below to preview it
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activeNft.equippedTraits.map(et => (
                        <div
                          key={et.category}
                          className="flex items-center gap-2.5 p-2 rounded group/et"
                          style={{ background: 'rgba(157,0,255,0.06)', border: '1px solid rgba(157,0,255,0.15)' }}
                        >
                          {et.trait.imageUrl ? (
                            <div className="w-9 h-9 flex-shrink-0 bg-black/40 rounded overflow-hidden">
                              <TraitMedia url={et.trait.imageUrl} mediaType={(et.trait as Record<string, unknown>).mediaType as string} alt={et.trait.name} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center text-xs font-bold text-primary uppercase rounded" style={{ background: 'rgba(157,0,255,0.2)' }}>
                              {et.category[0]}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold truncate">{et.trait.name}</div>
                            <div className="text-[10px] font-mono text-primary/60 uppercase">{et.category}</div>
                          </div>
                          <button
                            onClick={() => handleRemove(et.category)}
                            disabled={removeTrait.isPending}
                            className="opacity-0 group-hover/et:opacity-100 transition-opacity flex items-center justify-center w-6 h-6 rounded hover:bg-red-500/20 text-red-400/70 hover:text-red-400 flex-shrink-0"
                            title="Remove trait"
                          >
                            {removeTrait.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : nfts.length === 0 && !isLoadingNfts ? (
            <div className="py-10 text-center border border-dashed border-primary/20 rounded-xl">
              <Gem className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm font-mono text-muted-foreground/60 uppercase tracking-widest">// No Wegens found in this wallet //</p>
            </div>
          ) : null}

          {/* ── Stash ── */}
          <div>
            <h2 className="text-2xl text-foreground mb-4" style={BANGERS}>
              STASH
              <span className="ml-3 text-accent text-xl" style={BANGERS}>{lockerItems.length} items</span>
            </h2>

            {!isOpen ? (
              <div className="text-center py-16 border-2 border-dashed border-primary/20 bg-card/88 brick-bg">
                <div className="float-bounce inline-block mb-4">
                  <Lock className="w-14 h-14 text-primary/40 mx-auto" style={{ filter: 'drop-shadow(0 0 12px rgba(157,0,255,0.3))' }} />
                </div>
                <p className="font-mono text-muted-foreground text-sm uppercase tracking-widest">
                  // locker is sealed — hit CRACK IT OPEN to reveal your stash //
                </p>
              </div>
            ) : isLoadingLocker ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-52" />)}
              </div>
            ) : lockerItems.length === 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-4 py-3 border border-primary/25 bg-primary/5" style={{ borderLeft: '3px solid hsl(272 100% 60%)' }}>
                  <Package className="w-4 h-4 text-primary/60 flex-shrink-0" />
                  <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                    // sample preview — purchase traits from the store to fill your locker //
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 opacity-[0.62] pointer-events-none select-none">
                  {SAMPLE_LOCKER_ITEMS.map((item, index) => (
                    <StashCard
                      key={item.id}
                      item={item as never}
                      index={index}
                      activeNft={null}
                      onEquip={() => {}}
                      onHover={() => {}}
                      onHoverEnd={() => {}}
                      isEquipping={false}
                      isSample
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {lockerItems.map((item, index) => (
                  <StashCard
                    key={item.id}
                    item={item}
                    index={index}
                    activeNft={activeNft}
                    onEquip={() => handleEquip(item.id)}
                    onHover={() => setHoverTrait({ imageUrl: item.trait.imageUrl || "", name: item.trait.name, category: item.trait.category })}
                    onHoverEnd={() => setHoverTrait(null)}
                    isEquipping={applyTrait.isPending && applyTrait.variables?.data?.lockerItemId === item.id}
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

interface StashCardProps {
  item: {
    id: number;
    quantity: number;
    purchasedAt: string;
    equippedToTokenId: number | null;
    trait: {
      id: number;
      name: string;
      category: string;
      rarity: string;
      imageUrl?: string | null;
      mediaType?: string;
    };
  };
  index: number;
  activeNft: { tokenId: number; equippedTraits: { category: string }[] } | null;
  onEquip: () => void;
  onHover: () => void;
  onHoverEnd: () => void;
  isEquipping: boolean;
  isSample?: boolean;
}

function StashCard({ item, index, activeNft, onEquip, onHover, onHoverEnd, isEquipping, isSample }: StashCardProps) {
  const isEquipped = item.equippedToTokenId !== null;
  const equippedToActive = activeNft && item.equippedToTokenId === activeNft.tokenId;
  const sameCategory = activeNft?.equippedTraits.some(et => et.category === item.trait.category);

  return (
    <div
      className="group relative overflow-hidden transition-all"
      style={{
        background: 'linear-gradient(160deg, #1e1428 0%, #100b18 100%)',
        border: isEquipped ? '1px solid rgba(255,200,0,0.35)' : '1px solid rgba(157,0,255,0.2)',
        boxShadow: '0 0 0 rgba(157,0,255,0)',
        animationDelay: `${index * 40}ms`,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 18px rgba(157,0,255,0.2)';
        if (!isEquipped) onHover();
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 rgba(157,0,255,0)';
        onHoverEnd();
      }}
    >
      {/* Equipped ribbon */}
      {isEquipped && (
        <div className="absolute top-0 right-0 z-10 overflow-hidden w-16 h-16">
          <div className="text-[9px] font-bold uppercase tracking-wider py-0.5 text-center w-24 transform rotate-45 absolute top-4 -right-6" style={{ background: 'hsl(43 100% 52%)', color: '#000' }}>
            {equippedToActive ? 'On This' : 'Equipped'}
          </div>
        </div>
      )}

      {/* Image area */}
      <div className="relative aspect-square bg-secondary/20 flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${
              item.trait.rarity === 'legendary' ? '#f59e0b' :
              item.trait.rarity === 'rare' ? '#3b82f6' :
              item.trait.rarity === 'uncommon' ? '#22c55e' : '#9d00ff'
            } 0%, transparent 70%)`,
          }}
        />
        {item.trait.imageUrl ? (
          <TraitMedia
            url={item.trait.imageUrl}
            mediaType={item.trait.mediaType}
            alt={item.trait.name}
            className={`w-full h-full drop-shadow-2xl transition-all ${isEquipped ? 'opacity-50 grayscale' : 'group-hover:scale-105'}`}
            showBadge
          />
        ) : (
          <div className="text-5xl font-black text-muted-foreground/20 uppercase" style={BANGERS}>
            {item.trait.category.slice(0, 3)}
          </div>
        )}

        {/* Rarity badge */}
        <div className="absolute bottom-2 left-2">
          <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 border ${getRarityColor(item.trait.rarity)}`} style={BANGERS}>
            {item.trait.rarity}
          </span>
        </div>
        {/* Qty */}
        <div className="absolute top-2 left-2">
          <span className="text-xs font-mono bg-black/70 px-2 py-0.5 text-foreground border border-primary/20">x{item.quantity}</span>
        </div>

        {/* Hover equip overlay */}
        {!isEquipped && !isSample && activeNft && (
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <button
              onClick={onEquip}
              disabled={isEquipping}
              className="flex items-center gap-1.5 px-3 py-2 rounded font-bold text-xs uppercase text-white transition-all"
              style={{ ...BANGERS, background: sameCategory ? 'linear-gradient(135deg, hsl(43 100% 48%), hsl(43 100% 38%))' : 'linear-gradient(135deg, hsl(272 100% 52%), hsl(272 100% 42%))', boxShadow: '0 0 14px rgba(0,0,0,0.5)' }}
            >
              {isEquipping
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Plus className="w-3.5 h-3.5" />}
              {isEquipping ? 'Equipping...' : sameCategory ? 'Swap' : 'Equip'}
            </button>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5" style={{ borderTop: '1px solid rgba(157,0,255,0.15)' }}>
        <h3 className="font-bold text-xs leading-tight line-clamp-1">{item.trait.name}</h3>
        <div className="text-[9px] font-mono text-primary/70 uppercase tracking-widest mt-0.5">{item.trait.category}</div>
        <div className="text-[9px] text-muted-foreground font-mono mt-1 flex justify-between">
          <span>{format(new Date(item.purchasedAt), "MMM d")}</span>
          {item.equippedToTokenId && (
            <span className="text-accent flex items-center gap-0.5"><Fingerprint className="w-2.5 h-2.5" />#{item.equippedToTokenId}</span>
          )}
        </div>
      </div>
    </div>
  );
}
