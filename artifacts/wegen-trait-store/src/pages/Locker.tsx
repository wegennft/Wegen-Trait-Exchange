import { useState } from "react";
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

const GRAFFITI = { fontFamily: "'Bangers', Impact, sans-serif", letterSpacing: '0.07em' };

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
      case "rare": return "text-blue-400 border-blue-500/60 bg-blue-500/10";
      case "uncommon": return "text-green-400 border-green-500/60 bg-green-500/10";
      default: return "text-gray-400 border-gray-500/60 bg-gray-500/10";
    }
  };

  const nfts = nftsData?.nfts ?? [];
  const lockerItems = lockerData?.items ?? [];
  const activeNft = selectedTokenId != null ? nfts.find(n => n.tokenId === selectedTokenId) : nfts[0] ?? null;

  return (
    <div className="space-y-10 animate-in fade-in duration-500">

      {/* ── Hero Header ── */}
      <div className="relative text-center py-6 overflow-hidden">
        <div className="absolute inset-0 brick-bg opacity-30 rounded-xl" />
        <div className="relative z-10">
          <div
            className="text-7xl md:text-8xl text-primary graffiti-title inline-block"
            style={GRAFFITI}
          >
            TRAIT
          </div>
          <div
            className="text-7xl md:text-8xl text-accent graffiti-title-lime inline-block ml-3"
            style={GRAFFITI}
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
                className="absolute inset-0 rounded-sm overflow-hidden"
                style={{
                  background: 'linear-gradient(160deg, #2a2f3a 0%, #1c2029 50%, #161a22 100%)',
                  border: '4px solid #3a3f4d',
                  boxShadow: 'inset 0 0 30px rgba(0,0,0,0.8), 6px 6px 0 rgba(0,0,0,0.5)',
                }}
              >
                {/* Inside locker when open */}
                {isOpen && (
                  <div className="absolute inset-0 p-4 flex flex-col gap-2 overflow-hidden">
                    {/* Shelf line */}
                    <div className="w-full h-1 bg-gray-600/60 rounded-full mt-16" />

                    {/* Inside graffiti scrawl */}
                    <div className="flex flex-col gap-1 mt-3 px-2">
                      <span className="text-primary/40 text-xs" style={{ fontFamily: "'Permanent Marker', cursive", transform: 'rotate(-2deg)', display: 'inline-block' }}>
                        WEGEN 4 LIFE
                      </span>
                      <span className="text-accent/30 text-[10px]" style={{ fontFamily: "'Permanent Marker', cursive", transform: 'rotate(1deg)', display: 'inline-block', marginLeft: 20 }}>
                        NFT GANG ✦
                      </span>
                    </div>

                    {/* Trait count sticker inside */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center">
                      <div
                        className="text-4xl text-accent"
                        style={GRAFFITI}
                      >
                        {lockerItems.length}
                      </div>
                      <div className="text-muted-foreground text-xs font-mono uppercase tracking-widest">
                        traits stored
                      </div>
                    </div>
                  </div>
                )}

                {/* Top vents */}
                <div className="absolute top-5 left-6 right-6 flex flex-col gap-1.5">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-full h-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.6)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)' }} />
                  ))}
                </div>
              </div>

              {/* ── Locker DOOR (3D animated) ── */}
              <div className={`locker-door absolute inset-0`} style={{ transform: isOpen ? 'rotateY(-145deg)' : 'rotateY(0deg)' }}>
                <div
                  className="locker-door-back absolute inset-0 rounded-sm"
                  style={{
                    background: 'linear-gradient(160deg, #4a5260 0%, #343b47 40%, #2d3340 100%)',
                    border: '4px solid #555d6e',
                    boxShadow: isOpen
                      ? 'none'
                      : '4px 0 18px rgba(0,0,0,0.7), inset -2px 0 8px rgba(0,0,0,0.3)',
                  }}
                >
                  {/* Door panel inset */}
                  <div
                    className="absolute inset-4 rounded-sm"
                    style={{
                      border: '2px solid #5a6070',
                      boxShadow: 'inset 2px 2px 8px rgba(0,0,0,0.4)',
                    }}
                  />

                  {/* Top vents on door */}
                  <div className="absolute top-7 left-8 right-8 flex flex-col gap-1.5">
                    {[1, 2, 3, 4].map(i => (
                      <div
                        key={i}
                        className="w-full h-1.5 rounded-full"
                        style={{ background: '#252930', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.9), 0 1px 0 rgba(255,255,255,0.06)' }}
                      />
                    ))}
                  </div>

                  {/* Locker number plate */}
                  <div
                    className="absolute top-24 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-sm text-center"
                    style={{
                      background: 'linear-gradient(135deg, #c8a84b, #e8c86a, #c8a84b)',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                      minWidth: 80,
                    }}
                  >
                    <span className="text-black font-bold text-lg tracking-widest" style={GRAFFITI}>
                      {walletAddress ? `#${walletAddress.slice(-4).toUpperCase()}` : '#????'}
                    </span>
                  </div>

                  {/* Center graffiti tag on door */}
                  <div className="absolute inset-0 flex items-center justify-center flex-col gap-1 pt-16">
                    <div
                      className="text-primary/70 text-3xl"
                      style={{ fontFamily: "'Permanent Marker', cursive", transform: 'rotate(-3deg)' }}
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
                        background: 'radial-gradient(circle at 35% 35%, #6a7080, #2a2f38)',
                        border: '3px solid #555d6e',
                        boxShadow: '0 3px 8px rgba(0,0,0,0.6), inset 0 1px 3px rgba(255,255,255,0.1)',
                      }}
                    >
                      <div className="w-1 h-4 bg-gray-300/60 rounded-full" />
                    </div>
                    {/* Dial tick marks */}
                    <div className="absolute -inset-1 rounded-full border border-gray-500/30" />
                  </div>

                  {/* Handle */}
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <div
                      className="w-3 h-10 rounded-full"
                      style={{
                        background: 'linear-gradient(to right, #7a8090, #4a5060)',
                        boxShadow: '2px 2px 6px rgba(0,0,0,0.6)',
                      }}
                    />
                  </div>

                  {/* Lock icon at bottom */}
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
                    {isOpen
                      ? <Unlock className="w-5 h-5 text-accent" style={{ filter: 'drop-shadow(0 0 6px rgba(130,255,0,0.7))' }} />
                      : <Lock className="w-5 h-5 text-primary" style={{ filter: 'drop-shadow(0 0 6px rgba(255,107,0,0.7))' }} />
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Open/Close button */}
          <button
            onClick={() => setIsOpen(o => !o)}
            className={`w-full max-w-[300px] py-3 font-bold uppercase tracking-widest text-lg transition-all rounded-sm ${
              isOpen
                ? 'bg-secondary border-2 border-accent/60 text-accent hover:bg-accent/10 shadow-[0_0_16px_rgba(130,255,0,0.3)]'
                : 'bg-primary text-white hover:bg-primary/90 shadow-[0_0_20px_rgba(255,107,0,0.5)] neon-pulse'
            }`}
            style={GRAFFITI}
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
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-32 rounded-sm flex-shrink-0" />)}
            </div>
          ) : nfts.length > 0 ? (
            <div>
              <h2 className="text-2xl text-foreground mb-4" style={GRAFFITI}>
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
                      className={`relative flex-shrink-0 w-40 rounded-sm overflow-hidden transition-all group ${
                        isSelected
                          ? 'ring-2 ring-primary shadow-[0_0_20px_rgba(255,107,0,0.4)]'
                          : 'ring-1 ring-border/40 hover:ring-primary/40 hover:shadow-[0_0_10px_rgba(255,107,0,0.2)]'
                      }`}
                      style={{ background: 'linear-gradient(160deg, #1c2029, #13171f)' }}
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

                        {/* Equipped trait thumbnails stacked in corner */}
                        {nft.equippedTraits.length > 0 && (
                          <div className="absolute bottom-1 right-1 flex flex-col gap-0.5">
                            {nft.equippedTraits.slice(0, 4).map(et => (
                              et.trait.imageUrl ? (
                                <img
                                  key={et.category}
                                  src={et.trait.imageUrl}
                                  alt={et.trait.name}
                                  className="w-7 h-7 object-contain rounded-sm bg-black/60 border border-white/10"
                                  title={`${et.category}: ${et.trait.name}`}
                                />
                              ) : (
                                <div
                                  key={et.category}
                                  className="w-7 h-7 rounded-sm bg-primary/20 border border-primary/30 flex items-center justify-center text-[8px] font-bold uppercase text-primary"
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
                  className="mt-4 rounded-sm p-4 border border-border/50"
                  style={{ background: 'linear-gradient(135deg, rgba(255,107,0,0.05), rgba(0,0,0,0.3))' }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-lg text-primary" style={GRAFFITI}>
                      {activeNft.name} — EQUIPPED TRAITS
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">#{activeNft.tokenId}</span>
                  </div>
                  {activeNft.equippedTraits.length === 0 ? (
                    <p className="text-muted-foreground font-mono text-sm">// no traits equipped yet — visit My Wegens to customize //</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {activeNft.equippedTraits.map(et => (
                        <div
                          key={et.category}
                          className="flex items-center gap-2 p-2 rounded-sm border border-border/40 bg-secondary/30"
                        >
                          {et.trait.imageUrl ? (
                            <img src={et.trait.imageUrl} alt={et.trait.name} className="w-8 h-8 object-contain rounded-sm bg-black/40" />
                          ) : (
                            <div className="w-8 h-8 rounded-sm bg-primary/20 flex items-center justify-center text-xs font-bold text-primary uppercase">
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
            <h2 className="text-2xl text-foreground mb-4" style={GRAFFITI}>
              STASH
              <span className="ml-3 text-accent text-xl">{lockerItems.length} items</span>
            </h2>

            {!isOpen ? (
              <div
                className="text-center py-16 rounded-sm border-2 border-dashed border-primary/20 bg-card/20 brick-bg"
              >
                <div className="float-bounce inline-block mb-4">
                  <Lock className="w-14 h-14 text-primary/40 mx-auto" style={{ filter: 'drop-shadow(0 0 10px rgba(255,107,0,0.3))' }} />
                </div>
                <p className="font-mono text-muted-foreground text-sm uppercase tracking-widest">
                  // locker is sealed — hit CRACK IT OPEN to reveal your stash //
                </p>
              </div>
            ) : isLoadingLocker ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Skeleton key={i} className="h-52 rounded-sm" />
                ))}
              </div>
            ) : lockerItems.length === 0 ? (
              <div className="text-center py-16 rounded-sm border-2 border-dashed border-border/30 bg-card/20">
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
                    className="group relative rounded-sm overflow-hidden border border-border/40 hover:border-primary/40 transition-all hover:shadow-[0_0_16px_rgba(255,107,0,0.15)]"
                    style={{
                      background: 'linear-gradient(160deg, #1c2029 0%, #13171f 100%)',
                      animationDelay: `${index * 40}ms`,
                    }}
                  >
                    {/* Equipped ribbon */}
                    {item.equippedToTokenId !== null && (
                      <div className="absolute top-0 right-0 z-10 overflow-hidden w-16 h-16">
                        <div
                          className="text-[9px] font-bold uppercase tracking-wider py-0.5 text-center w-24 transform rotate-45 absolute top-4 -right-6"
                          style={{ background: 'hsl(82 100% 52%)', color: '#000' }}
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
                            item.trait.rarity === 'uncommon' ? '#22c55e' : '#6b7280'
                          } 0%, transparent 70%)`,
                        }}
                      />

                      {item.trait.imageUrl ? (
                        <img
                          src={item.trait.imageUrl}
                          alt={item.trait.name}
                          className={`w-full h-full object-contain drop-shadow-2xl transition-all ${
                            item.equippedToTokenId ? 'opacity-50 grayscale' : 'group-hover:scale-105'
                          }`}
                        />
                      ) : (
                        <div
                          className="text-5xl font-black text-muted-foreground/20 uppercase"
                          style={GRAFFITI}
                        >
                          {item.trait.category.slice(0, 3)}
                        </div>
                      )}

                      {/* Rarity badge */}
                      <div className="absolute bottom-2 left-2">
                        <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm border ${getRarityColor(item.trait.rarity)}`} style={GRAFFITI}>
                          {item.trait.rarity}
                        </span>
                      </div>

                      {/* Qty badge */}
                      <div className="absolute top-2 left-2">
                        <span className="text-xs font-mono bg-black/70 px-2 py-0.5 rounded-sm text-foreground">
                          x{item.quantity}
                        </span>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-3 border-t border-border/30">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-bold text-sm leading-tight line-clamp-1">{item.trait.name}</h3>
                      </div>
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
