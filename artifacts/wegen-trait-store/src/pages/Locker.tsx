import { useState } from "react";
import { TraitMedia } from "@/components/TraitMedia";
import { useWallet } from "@/contexts/WalletContext";
import { WalletConnectGuard } from "@/components/shared/WalletConnectGuard";
import {
  useGetLocker,
  useGetUserNfts,
  getGetLockerQueryKey,
  getGetUserNftsQueryKey,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Fingerprint, Lock, Unlock, Gem, ChevronRight } from "lucide-react";
import { format } from "date-fns";

const BANGERS = { fontFamily: "'Bangers', Impact, sans-serif", letterSpacing: '0.07em' };

/* Purple: rgba(157,0,255,...)  Gold: rgba(255,200,0,...) */

export function Locker() {
  return (
    <WalletConnectGuard message="Connect your wallet to open your Trait Locker.">
      <LockerContent />
    </WalletConnectGuard>
  );
}

function LockerContent() {
  const { walletAddress } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(null);

  const { data: lockerData, isLoading: isLoadingLocker } = useGetLocker(walletAddress || "", {
    query: {
      enabled: !!walletAddress,
      queryKey: getGetLockerQueryKey(walletAddress || ""),
    },
  });

  const { data: nftsData, isLoading: isLoadingNfts } = useGetUserNfts(walletAddress || "", {
    query: {
      enabled: !!walletAddress,
      queryKey: getGetUserNftsQueryKey(walletAddress || ""),
    },
  });

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "legendary": return "text-yellow-400 border-yellow-500/60 bg-yellow-500/10";
      case "rare":      return "text-blue-400 border-blue-500/60 bg-blue-500/10";
      case "uncommon":  return "text-green-400 border-green-500/60 bg-green-500/10";
      default:          return "text-gray-400 border-gray-500/60 bg-gray-500/10";
    }
  };

  const nfts = nftsData?.nfts ?? [];
  const lockerItems = lockerData?.items ?? [];
  const activeNft = selectedTokenId != null
    ? nfts.find(n => n.tokenId === selectedTokenId)
    : nfts[0] ?? null;

  return (
    <div className="space-y-10 animate-in fade-in duration-500">

      {/* ── Hero Header ── */}
      <div className="relative text-center py-6 overflow-hidden">
        <div className="absolute inset-0 brick-bg opacity-30" />
        <div className="relative z-10">
          <div
            className="text-7xl md:text-8xl text-primary inline-block graffiti-title"
            style={BANGERS}
          >
            TRAIT
          </div>
          <div
            className="text-7xl md:text-8xl text-accent inline-block graffiti-title-gold ml-3"
            style={BANGERS}
          >
            LOCKER
          </div>
          <p className="text-muted-foreground mt-2 font-mono text-sm uppercase tracking-widest">
            // Your stash. Your style. Keep it locked. //
          </p>
        </div>
      </div>

      {/* ── Main Layout: Locker + NFT Preview ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-8 items-start">

        {/* ══ Physical Locker ══ */}
        <div className="flex flex-col items-center gap-4">
          <div className="locker-scene w-full max-w-[300px] mx-auto">
            <div className="relative" style={{ height: 460 }}>

              {/* Locker body (back wall) */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{
                  background: 'linear-gradient(160deg, #1e1428 0%, #150f20 50%, #100b18 100%)',
                  border: '4px solid #3a2a50',
                  boxShadow: 'inset 0 0 30px rgba(0,0,0,0.8), 6px 6px 0 rgba(0,0,0,0.5)',
                }}
              >
                {/* Inside locker when open */}
                {isOpen && (
                  <div className="absolute inset-0 p-4 flex flex-col gap-2 overflow-hidden">
                    <div className="w-full h-1 bg-purple-900/60 rounded-full mt-16" />

                    {/* Inside graffiti scrawl */}
                    <div className="flex flex-col gap-1 mt-3 px-2">
                      <span
                        className="text-primary/50 text-xs"
                        style={{ fontFamily: "'Permanent Marker', cursive", transform: 'rotate(-2deg)', display: 'inline-block' }}
                      >
                        WEGEN 4 LIFE
                      </span>
                      <span
                        className="text-accent/40 text-[10px]"
                        style={{ fontFamily: "'Permanent Marker', cursive", transform: 'rotate(1deg)', display: 'inline-block', marginLeft: 20 }}
                      >
                        NFT GANG ✦
                      </span>
                    </div>

                    {/* Item count */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center">
                      <div className="text-4xl text-accent" style={BANGERS}>{lockerItems.length}</div>
                      <div className="text-muted-foreground text-xs font-mono uppercase tracking-widest">traits stored</div>
                    </div>
                  </div>
                )}

                {/* Top vents */}
                <div className="absolute top-5 left-6 right-6 flex flex-col gap-1.5">
                  {[1, 2, 3].map(i => (
                    <div
                      key={i}
                      className="w-full h-1.5 rounded-full"
                      style={{ background: 'rgba(0,0,0,0.7)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.9)' }}
                    />
                  ))}
                </div>
              </div>

              {/* ── Locker DOOR (3D animated) ── */}
              <div
                className="locker-door absolute inset-0"
                style={{ transform: isOpen ? 'rotateY(-145deg)' : 'rotateY(0deg)' }}
              >
                <div
                  className="locker-door-back absolute inset-0"
                  style={{
                    background: 'linear-gradient(160deg, #3d2a5a 0%, #2a1d40 40%, #221632 100%)',
                    border: '4px solid #5a3d80',
                    boxShadow: isOpen
                      ? 'none'
                      : '4px 0 18px rgba(0,0,0,0.7), inset -2px 0 8px rgba(0,0,0,0.3)',
                  }}
                >
                  {/* Door panel inset */}
                  <div
                    className="absolute inset-4"
                    style={{
                      border: '2px solid rgba(157,0,255,0.3)',
                      boxShadow: 'inset 2px 2px 8px rgba(0,0,0,0.5), 0 0 10px rgba(157,0,255,0.1)',
                    }}
                  />

                  {/* Top vents on door */}
                  <div className="absolute top-7 left-8 right-8 flex flex-col gap-1.5">
                    {[1, 2, 3, 4].map(i => (
                      <div
                        key={i}
                        className="w-full h-1.5 rounded-full"
                        style={{
                          background: '#1a1028',
                          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.9), 0 1px 0 rgba(255,255,255,0.04)',
                        }}
                      />
                    ))}
                  </div>

                  {/* Gold number plate */}
                  <div
                    className="absolute top-24 left-1/2 -translate-x-1/2 px-4 py-1.5 text-center"
                    style={{
                      background: 'linear-gradient(135deg, #b8860b, #ffd700, #b8860b)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.6), 0 0 14px rgba(255,200,0,0.4)',
                      minWidth: 80,
                    }}
                  >
                    <span className="text-black font-bold text-lg" style={BANGERS}>
                      {walletAddress ? `#${walletAddress.slice(-4).toUpperCase()}` : '#????'}
                    </span>
                  </div>

                  {/* Center graffiti tag on door */}
                  <div className="absolute inset-0 flex items-center justify-center flex-col gap-1 pt-16">
                    <div
                      className="text-primary/60 text-3xl"
                      style={{ fontFamily: "'Permanent Marker', cursive", transform: 'rotate(-3deg)', filter: 'drop-shadow(0 0 8px rgba(157,0,255,0.5))' }}
                    >
                      WGN
                    </div>
                    <div
                      className="text-accent/50 text-lg"
                      style={{ fontFamily: "'Permanent Marker', cursive", transform: 'rotate(2deg)' }}
                    >
                      ★ traits ★
                    </div>
                  </div>

                  {/* Combination dial */}
                  <div className="absolute bottom-20 left-1/2 -translate-x-1/2">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{
                        background: 'radial-gradient(circle at 35% 35%, #4a3068, #1e1430)',
                        border: '3px solid #5a3d80',
                        boxShadow: '0 3px 8px rgba(0,0,0,0.6), inset 0 1px 3px rgba(157,0,255,0.2)',
                      }}
                    >
                      <div className="w-1 h-4 bg-purple-300/60 rounded-full" />
                    </div>
                    <div className="absolute -inset-1 rounded-full border border-purple-500/20" />
                  </div>

                  {/* Handle */}
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <div
                      className="w-3 h-10 rounded-full"
                      style={{
                        background: 'linear-gradient(to right, #ffd700, #b8860b)',
                        boxShadow: '2px 2px 6px rgba(0,0,0,0.6), 0 0 8px rgba(255,200,0,0.3)',
                      }}
                    />
                  </div>

                  {/* Lock icon */}
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
                    {isOpen
                      ? <Unlock className="w-5 h-5 text-accent" style={{ filter: 'drop-shadow(0 0 6px rgba(255,200,0,0.8))' }} />
                      : <Lock className="w-5 h-5 text-primary" style={{ filter: 'drop-shadow(0 0 6px rgba(157,0,255,0.8))' }} />
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Open/Close button */}
          <button
            onClick={() => setIsOpen(o => !o)}
            className={`w-full max-w-[300px] py-3 font-bold uppercase tracking-widest text-lg transition-all ${
              isOpen
                ? 'bg-secondary text-accent hover:bg-accent/10'
                : 'bg-primary text-white hover:bg-primary/90 neon-pulse'
            }`}
            style={{
              ...BANGERS,
              border: isOpen ? '2px solid rgba(255,200,0,0.6)' : 'none',
              boxShadow: isOpen ? '0 0 16px rgba(255,200,0,0.25)' : undefined,
            }}
          >
            {isOpen ? (
              <><Lock className="inline w-5 h-5 mr-2 mb-0.5" />LOCK IT UP</>
            ) : (
              <><Unlock className="inline w-5 h-5 mr-2 mb-0.5" />CRACK IT OPEN</>
            )}
          </button>
        </div>

        {/* ══ Right Panel: NFT Preview + Trait Cards ══ */}
        <div className="space-y-8">

          {/* ── NFT Preview Strip ── */}
          {isLoadingNfts ? (
            <div className="flex gap-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-32 flex-shrink-0" />)}
            </div>
          ) : nfts.length > 0 ? (
            <div>
              <h2 className="text-2xl text-foreground mb-4" style={BANGERS}>
                YOUR WEGENS
                <span className="ml-3 text-lg text-muted-foreground" style={{ fontFamily: 'inherit' }}>// tap to preview traits //</span>
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {nfts.map(nft => {
                  const isSelected = (selectedTokenId ?? nfts[0]?.tokenId) === nft.tokenId;
                  return (
                    <button
                      key={nft.tokenId}
                      onClick={() => setSelectedTokenId(nft.tokenId)}
                      className="relative flex-shrink-0 w-40 overflow-hidden transition-all group"
                      style={{
                        background: 'linear-gradient(160deg, #1e1428, #100b18)',
                        border: isSelected
                          ? '2px solid rgba(157,0,255,0.8)'
                          : '1px solid rgba(157,0,255,0.2)',
                        boxShadow: isSelected
                          ? '0 0 20px rgba(157,0,255,0.4)'
                          : '0 0 0 rgba(157,0,255,0)',
                      }}
                    >
                      {/* NFT image / silhouette */}
                      <div className="aspect-square relative overflow-hidden bg-secondary/30">
                        {nft.imageUrl ? (
                          <img src={nft.imageUrl} alt={nft.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Gem className="w-12 h-12 text-muted-foreground/30" />
                          </div>
                        )}

                        {/* Equipped trait thumbnails */}
                        {nft.equippedTraits.length > 0 && (
                          <div className="absolute bottom-1 right-1 flex flex-col gap-0.5">
                            {nft.equippedTraits.slice(0, 4).map(et => (
                              et.trait.imageUrl ? (
                                <div
                                  key={et.category}
                                  className="w-7 h-7 bg-black/60"
                                  style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                                  title={`${et.category}: ${et.trait.name}`}
                                >
                                  <TraitMedia url={et.trait.imageUrl} mediaType={(et.trait as Record<string,unknown>).mediaType as string} alt={et.trait.name} className="w-full h-full" />
                                </div>
                              ) : (
                                <div
                                  key={et.category}
                                  className="w-7 h-7 flex items-center justify-center text-[8px] font-bold uppercase text-primary"
                                  style={{ background: 'rgba(157,0,255,0.2)', border: '1px solid rgba(157,0,255,0.3)' }}
                                >
                                  {et.category[0]}
                                </div>
                              )
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="p-2 text-left">
                        <div className="font-mono text-xs text-muted-foreground">
                          <Fingerprint className="inline w-3 h-3 mr-1" />#{nft.tokenId}
                        </div>
                        <div className="text-xs font-bold truncate mt-0.5">{nft.name}</div>
                        <div className="text-[10px] text-accent font-mono mt-1">
                          {nft.equippedTraits.length} trait{nft.equippedTraits.length !== 1 ? 's' : ''} equipped
                        </div>
                      </div>

                      {isSelected && (
                        <div className="absolute top-1 left-1">
                          <ChevronRight className="w-4 h-4 text-primary" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Active NFT Detail */}
              {activeNft && (
                <div
                  className="mt-4 p-4"
                  style={{
                    background: 'linear-gradient(135deg, rgba(157,0,255,0.06), rgba(0,0,0,0.3))',
                    border: '1px solid rgba(157,0,255,0.2)',
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-lg text-primary" style={BANGERS}>
                      {activeNft.name} — EQUIPPED TRAITS
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">#{activeNft.tokenId}</span>
                  </div>
                  {activeNft.equippedTraits.length === 0 ? (
                    <p className="text-muted-foreground font-mono text-sm">// no traits equipped — visit My Wegens to customize //</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {activeNft.equippedTraits.map(et => (
                        <div
                          key={et.category}
                          className="flex items-center gap-2 p-2 bg-secondary/30"
                          style={{ border: '1px solid rgba(157,0,255,0.15)' }}
                        >
                          {et.trait.imageUrl ? (
                            <div className="w-8 h-8 bg-black/40 flex-shrink-0"><TraitMedia url={et.trait.imageUrl} mediaType={(et.trait as Record<string,unknown>).mediaType as string} alt={et.trait.name} className="w-full h-full" /></div>
                          ) : (
                            <div
                              className="w-8 h-8 flex items-center justify-center text-xs font-bold text-primary uppercase"
                              style={{ background: 'rgba(157,0,255,0.2)' }}
                            >
                              {et.category[0]}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">{et.trait.name}</div>
                            <div className="text-[10px] font-mono text-muted-foreground uppercase">{et.category}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}

          {/* ── Locker Contents ── */}
          <div>
            <h2 className="text-2xl text-foreground mb-4" style={BANGERS}>
              STASH
              <span className="ml-3 text-accent text-xl" style={BANGERS}>{lockerItems.length} items</span>
            </h2>

            {!isOpen ? (
              <div
                className="text-center py-16 border-2 border-dashed border-primary/20 bg-card/20 brick-bg"
              >
                <div className="float-bounce inline-block mb-4">
                  <Lock
                    className="w-14 h-14 text-primary/40 mx-auto"
                    style={{ filter: 'drop-shadow(0 0 12px rgba(157,0,255,0.3))' }}
                  />
                </div>
                <p className="font-mono text-muted-foreground text-sm uppercase tracking-widest">
                  // locker is sealed — hit CRACK IT OPEN to reveal your stash //
                </p>
              </div>
            ) : isLoadingLocker ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-52" />)}
              </div>
            ) : lockerItems.length === 0 ? (
              <div
                className="text-center py-16 border-2 border-dashed border-primary/20 bg-card/20"
              >
                <Package className="w-14 h-14 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground font-mono text-sm uppercase tracking-widest">
                  // locker empty — hit the store to cop some traits //
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {lockerItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="group relative overflow-hidden transition-all"
                    style={{
                      background: 'linear-gradient(160deg, #1e1428 0%, #100b18 100%)',
                      border: '1px solid rgba(157,0,255,0.2)',
                      animationDelay: `${index * 40}ms`,
                      boxShadow: '0 0 0 rgba(157,0,255,0)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 18px rgba(157,0,255,0.18)')}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 0 0 rgba(157,0,255,0)')}
                  >
                    {/* Equipped ribbon */}
                    {item.equippedToTokenId !== null && (
                      <div className="absolute top-0 right-0 z-10 overflow-hidden w-16 h-16">
                        <div
                          className="text-[9px] font-bold uppercase tracking-wider py-0.5 text-center w-24 transform rotate-45 absolute top-4 -right-6"
                          style={{ background: 'hsl(43 100% 52%)', color: '#000' }}
                        >
                          Equipped
                        </div>
                      </div>
                    )}

                    {/* Image area */}
                    <div className="relative aspect-square bg-secondary/20 flex items-center justify-center p-6 overflow-hidden">
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
                          mediaType={(item.trait as Record<string,unknown>).mediaType as string}
                          alt={item.trait.name}
                          className={`w-full h-full drop-shadow-2xl transition-all ${
                            item.equippedToTokenId ? 'opacity-50 grayscale' : 'group-hover:scale-105'
                          }`}
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

                      {/* Qty badge */}
                      <div className="absolute top-2 left-2">
                        <span className="text-xs font-mono bg-black/70 px-2 py-0.5 text-foreground border border-primary/20">
                          x{item.quantity}
                        </span>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-3" style={{ borderTop: '1px solid rgba(157,0,255,0.15)' }}>
                      <h3 className="font-bold text-sm leading-tight line-clamp-1">{item.trait.name}</h3>
                      <div className="text-[10px] font-mono text-primary/70 uppercase tracking-widest mt-0.5 mb-2">
                        {item.trait.category}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono flex justify-between items-center">
                        <span>Acquired {format(new Date(item.purchasedAt), "MMM d, yy")}</span>
                        {item.equippedToTokenId && (
                          <span className="text-accent flex items-center gap-1">
                            <Fingerprint className="w-3 h-3" />#{item.equippedToTokenId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getRarityColor(rarity: string) {
  switch (rarity) {
    case "legendary": return "text-yellow-400 border-yellow-500/60 bg-yellow-500/10";
    case "rare":      return "text-blue-400 border-blue-500/60 bg-blue-500/10";
    case "uncommon":  return "text-green-400 border-green-500/60 bg-green-500/10";
    default:          return "text-gray-400 border-gray-500/60 bg-gray-500/10";
  }
}
