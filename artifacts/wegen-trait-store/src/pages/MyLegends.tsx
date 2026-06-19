import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Crown, Wallet, RefreshCw, ExternalLink, Hash, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@/contexts/WalletContext";
import { useCollection } from "@/contexts/CollectionContext";
import { useGetMyLegends } from "@workspace/api-client-react";

const BANGERS = { fontFamily: "'Bungee', Impact, sans-serif", letterSpacing: '0.08em' };

export function MyLegends() {
  const { walletAddress, isConnected, connect } = useWallet();
  const { collection, collectionLabel, theme } = useCollection();
  const { accent, accentHsl, glow, glow2, gradient, gradient2 } = theme;

  const [selectedPack, setSelectedPack] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useGetMyLegends(
    { walletAddress: walletAddress ?? "", nftCollection: collection },
    { enabled: !!walletAddress }
  );
  const legends = data?.legends ?? [];

  // Fetch available variant pack names for this collection
  const { data: variantCollData } = useQuery({
    queryKey: ["legend-variant-collections", collection],
    queryFn: async () => {
      const res = await fetch(`/api/legends/variant-collections?nftCollection=${encodeURIComponent(collection)}`);
      if (!res.ok) return { collections: [] as string[] };
      return res.json() as Promise<{ collections: string[] }>;
    },
  });
  const variantPacks = variantCollData?.collections ?? [];

  // Fetch the variant map for the selected pack
  const { data: variantMapData } = useQuery({
    queryKey: ["legend-variant-map", collection, selectedPack],
    queryFn: async () => {
      if (!selectedPack) return { variantMap: {} as Record<number, { imageUrl: string | null; mediaType: string }> };
      const res = await fetch(
        `/api/legends/variants/by-collection?nftCollection=${encodeURIComponent(collection)}&name=${encodeURIComponent(selectedPack)}`
      );
      if (!res.ok) return { variantMap: {} as Record<number, { imageUrl: string | null; mediaType: string }> };
      return res.json() as Promise<{ variantMap: Record<number, { imageUrl: string | null; mediaType: string }> }>;
    },
    enabled: !!selectedPack,
  });
  const variantMap = variantMapData?.variantMap ?? {};

  return (
    <div className="space-y-10">

      {/* ── Page Header ── */}
      <div
        className="relative rounded-2xl overflow-hidden border p-8"
        style={{
          background: `linear-gradient(135deg, hsl(${accentHsl} / 0.08) 0%, hsl(43 100% 40% / 0.06) 50%, transparent 100%)`,
          borderColor: `hsl(43 100% 52% / 0.35)`,
          boxShadow: `0 0 60px hsl(43 100% 52% / 0.1), inset 0 0 40px hsl(${accentHsl} / 0.04)`,
        }}
      >
        {/* Gold top edge */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{
            background: `linear-gradient(90deg, transparent 0%, hsl(43 100% 52%) 20%, hsl(${accentHsl}) 50%, hsl(43 100% 52%) 80%, transparent 100%)`,
            boxShadow: `0 0 12px hsl(43 100% 52% / 0.8)`,
          }}
        />

        <div className="flex items-start gap-5">
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, hsl(43 100% 52% / 0.25) 0%, hsl(${accentHsl} / 0.15) 100%)`,
              border: `2px solid hsl(43 100% 52% / 0.5)`,
              boxShadow: `0 0 20px hsl(43 100% 52% / 0.3)`,
            }}
          >
            <Crown className="w-8 h-8" style={{ color: 'hsl(43 100% 56%)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1
              className="text-4xl sm:text-5xl leading-none mb-2"
              style={{
                ...BANGERS,
                color: 'hsl(43 100% 56%)',
                textShadow: `3px 3px 0 #000, 0 0 30px hsl(43 100% 52% / 0.7), 0 0 60px hsl(${accentHsl} / 0.3)`,
                WebkitTextStroke: '1px rgba(0,0,0,0.8)',
                paintOrder: 'stroke fill',
              }}
            >
              MY <span style={{ color: accent }}>LEGENDS</span>
            </h1>
            <p className="text-muted-foreground text-sm max-w-md">
              1-of-1 legendary Wegen NFTs recognized by token ID on the Ethereum blockchain.
              Connect your wallet to reveal your legends.
            </p>
          </div>
          {isConnected && (
            <Button
              variant="outline"
              size="sm"
              className="flex-shrink-0 gap-2"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* ── Not connected ── */}
      {!isConnected && (
        <div
          className="rounded-2xl border border-dashed p-16 flex flex-col items-center gap-5"
          style={{ borderColor: `hsl(43 100% 52% / 0.25)` }}
        >
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{
              background: `radial-gradient(ellipse, hsl(43 100% 52% / 0.15) 0%, transparent 70%)`,
              border: `2px dashed hsl(43 100% 52% / 0.3)`,
            }}
          >
            <Wallet className="w-9 h-9" style={{ color: 'hsl(43 100% 52% / 0.5)' }} />
          </div>
          <div className="text-center">
            <p style={{ ...BANGERS, fontSize: '1.15rem', color: 'hsl(43 100% 52% / 0.8)' }}>
              CONNECT YOUR WALLET
            </p>
            <p className="text-muted-foreground text-sm mt-1">
              to check if you hold any legendary {collectionLabel}
            </p>
          </div>
          <Button
            onClick={connect}
            className="gap-2 text-white font-bold uppercase"
            style={{
              ...BANGERS,
              fontSize: '0.85rem',
              background: gradient,
              border: `2px solid hsl(43 100% 52% / 0.6)`,
              boxShadow: `0 0 16px hsl(43 100% 52% / 0.3)`,
            }}
          >
            <Wallet className="w-4 h-4" />
            Connect Wallet
          </Button>
        </div>
      )}

      {/* ── Loading ── */}
      {isConnected && isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl border animate-pulse overflow-hidden"
              style={{ borderColor: `hsl(43 100% 52% / 0.15)` }}
            >
              <div className="aspect-square bg-secondary/30" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-2/3 bg-secondary/40 rounded" />
                <div className="h-3 w-full bg-secondary/20 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── No legends ── */}
      {isConnected && !isLoading && legends.length === 0 && (
        <div
          className="rounded-2xl border border-dashed p-16 flex flex-col items-center gap-4"
          style={{ borderColor: `hsl(${accentHsl} / 0.2)` }}
        >
          <Crown
            className="w-16 h-16"
            style={{ color: `hsl(${accentHsl} / 0.2)` }}
          />
          <div className="text-center">
            <p style={{ ...BANGERS, fontSize: '1.1rem', color: `hsl(${accentHsl} / 0.6)` }}>
              NO LEGENDS DETECTED
            </p>
            <p className="text-muted-foreground text-sm mt-1 max-w-xs">
              Your wallet doesn't hold any legendary {collectionLabel} token IDs registered on this platform.
            </p>
          </div>
        </div>
      )}

      {/* ── Legends Grid ── */}
      {isConnected && !isLoading && legends.length > 0 && (
        <>
          <div className="flex items-center gap-3">
            <Crown className="w-5 h-5" style={{ color: 'hsl(43 100% 52%)' }} />
            <span style={{ ...BANGERS, fontSize: '1rem', color: 'hsl(43 100% 52%)' }}>
              {legends.length} LEGEND{legends.length !== 1 ? 'S' : ''} IN YOUR WALLET
            </span>
            <div
              className="flex-1 h-px"
              style={{ background: `linear-gradient(to right, hsl(43 100% 52% / 0.4), transparent)` }}
            />
          </div>

          {/* ── Variant Pack Selector ── */}
          {variantPacks.length > 0 && (
            <div
              className="rounded-xl px-4 py-3 flex flex-wrap items-center gap-2"
              style={{
                background: "hsl(272 20% 7%)",
                border: `1px solid hsl(43 100% 52% / 0.15)`,
              }}
            >
              <span
                className="text-[9px] font-mono uppercase tracking-widest mr-1"
                style={{ color: `hsl(43 100% 52% / 0.5)` }}
              >
                SKIN
              </span>

              {/* Original (no variant) */}
              <button
                onClick={() => setSelectedPack(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
                style={
                  !selectedPack
                    ? {
                        background: "linear-gradient(135deg, hsl(43 100% 52% / 0.25), hsl(43 100% 40% / 0.1))",
                        border: `1px solid hsl(43 100% 52% / 0.7)`,
                        boxShadow: `0 0 10px hsl(43 100% 52% / 0.35)`,
                        color: "hsl(43 100% 60%)",
                      }
                    : { border: "1px solid rgba(255,255,255,0.12)", color: "hsl(var(--muted-foreground))" }
                }
              >
                ◈ Original
              </button>

              {/* Pack buttons */}
              {variantPacks.map((pack) => (
                <button
                  key={pack}
                  onClick={() => setSelectedPack(pack)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
                  style={
                    selectedPack === pack
                      ? {
                          background: gradient2,
                          border: `1px solid ${accent}80`,
                          boxShadow: `0 0 10px ${glow2}`,
                          color: accent,
                        }
                      : { border: "1px solid rgba(255,255,255,0.12)", color: "hsl(var(--muted-foreground))" }
                  }
                >
                  {pack}
                </button>
              ))}

              {/* Active pack badge */}
              {selectedPack && (
                <span
                  className="ml-auto text-[10px] font-mono uppercase tracking-widest"
                  style={{ color: `${accent}80` }}
                >
                  Viewing: {selectedPack}
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {legends.map((legend) => {
              const variantEntry = selectedPack ? variantMap[legend.id] : undefined;
              const variantImageUrl = variantEntry?.imageUrl ?? null;
              return (
                <LegendCard
                  key={legend.id}
                  legend={legend}
                  accentHsl={accentHsl}
                  accent={accent}
                  glow={glow}
                  selectedPack={selectedPack}
                  variantImageUrl={variantImageUrl}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Individual Legend Card ─────────────────────────────────────────────────────

function LegendCard({
  legend, accentHsl, accent, glow, selectedPack, variantImageUrl,
}: {
  legend: { id: number; name: string; tokenId?: number | null; imageUrl?: string | null; description?: string | null; nftCollection: string };
  accentHsl: string; accent: string; glow: string;
  selectedPack: string | null;
  variantImageUrl: string | null;
}) {
  const displayImage = variantImageUrl ?? legend.imageUrl;
  const isVariant = !!(selectedPack && variantImageUrl);

  return (
    <div
      className="group relative rounded-2xl overflow-hidden border transition-all duration-300 hover:-translate-y-1"
      style={{
        borderColor: isVariant ? `${accent}60` : `hsl(43 100% 52% / 0.4)`,
        background: isVariant
          ? `linear-gradient(160deg, ${accent}10 0%, hsl(${accentHsl} / 0.06) 100%)`
          : `linear-gradient(160deg, hsl(43 100% 52% / 0.06) 0%, hsl(${accentHsl} / 0.04) 100%)`,
        boxShadow: isVariant
          ? `0 0 30px ${accent}22, inset 0 0 20px ${accent}08`
          : `0 0 30px hsl(43 100% 52% / 0.1), inset 0 0 20px hsl(43 100% 52% / 0.03)`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = isVariant
          ? `0 0 50px ${accent}40, 0 0 100px ${accent}18, inset 0 0 20px ${accent}10`
          : `0 0 50px hsl(43 100% 52% / 0.25), 0 0 100px hsl(${accentHsl} / 0.1), inset 0 0 20px hsl(43 100% 52% / 0.05)`;
        (e.currentTarget as HTMLDivElement).style.borderColor = isVariant
          ? `${accent}90`
          : `hsl(43 100% 52% / 0.7)`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = isVariant
          ? `0 0 30px ${accent}22, inset 0 0 20px ${accent}08`
          : `0 0 30px hsl(43 100% 52% / 0.1), inset 0 0 20px hsl(43 100% 52% / 0.03)`;
        (e.currentTarget as HTMLDivElement).style.borderColor = isVariant ? `${accent}60` : `hsl(43 100% 52% / 0.4)`;
      }}
    >
      {/* Top edge glow — gold for original, accent for variant */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] z-10"
        style={{
          background: isVariant
            ? `linear-gradient(90deg, transparent 0%, ${accent} 30%, hsl(43 100% 52%) 50%, ${accent} 70%, transparent 100%)`
            : `linear-gradient(90deg, transparent 0%, hsl(43 100% 52%) 30%, hsl(${accentHsl}) 50%, hsl(43 100% 52%) 70%, transparent 100%)`,
          boxShadow: isVariant
            ? `0 0 10px ${glow}`
            : `0 0 10px hsl(43 100% 52% / 0.6)`,
        }}
      />

      {/* Token ID badge */}
      {legend.tokenId != null && (
        <div
          className="absolute top-3 left-3 z-10 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold"
          style={{
            ...BANGERS,
            background: `linear-gradient(135deg, hsl(268 40% 8% / 0.95), hsl(268 40% 12% / 0.95))`,
            border: `1px solid hsl(43 100% 52% / 0.5)`,
            color: 'hsl(43 100% 60%)',
            boxShadow: `0 0 8px hsl(43 100% 52% / 0.3)`,
            fontSize: '0.65rem',
          }}
        >
          <Hash className="w-2.5 h-2.5" />
          {legend.tokenId}
        </div>
      )}

      {/* LEGEND badge + variant indicator */}
      <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1">
        <Badge
          className="text-[10px] font-bold gap-1"
          style={{
            ...BANGERS,
            background: `linear-gradient(135deg, hsl(43 100% 40% / 0.9), hsl(38 100% 32% / 0.9))`,
            border: `1px solid hsl(43 100% 52% / 0.6)`,
            color: 'hsl(43 100% 80%)',
            boxShadow: `0 0 10px hsl(43 100% 52% / 0.4)`,
            fontSize: '0.6rem',
            letterSpacing: '0.12em',
          }}
        >
          <Crown className="w-2.5 h-2.5" />
          LEGEND
        </Badge>
        {isVariant && (
          <Badge
            className="text-[9px] font-bold"
            style={{
              ...BANGERS,
              background: `${accent}30`,
              border: `1px solid ${accent}60`,
              color: accent,
              boxShadow: `0 0 8px ${accent}40`,
              fontSize: '0.55rem',
              letterSpacing: '0.1em',
            }}
          >
            {selectedPack}
          </Badge>
        )}
      </div>

      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-secondary/20">
        {displayImage ? (
          <img
            src={displayImage}
            alt={legend.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background: `radial-gradient(ellipse at center, hsl(43 100% 52% / 0.12) 0%, transparent 70%)`,
            }}
          >
            <Crown
              className="w-20 h-20"
              style={{ color: 'hsl(43 100% 52% / 0.3)' }}
            />
          </div>
        )}
        {/* Scan-line overlay */}
        <div className="absolute inset-0 scanlines opacity-10 pointer-events-none" />
        {/* Bottom fade */}
        <div
          className="absolute bottom-0 left-0 right-0 h-1/3 pointer-events-none"
          style={{ background: `linear-gradient(to bottom, transparent, hsl(268 40% 4% / 0.7))` }}
        />
        {/* Variant shimmer overlay */}
        {isVariant && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(135deg, ${accent}08 0%, transparent 60%, ${accent}06 100%)`,
            }}
          />
        )}
      </div>

      {/* Info */}
      <div className="p-4 space-y-3">
        <div>
          <h3
            className="text-lg leading-tight"
            style={{
              ...BANGERS,
              color: isVariant ? accent : 'hsl(43 100% 70%)',
              textShadow: isVariant
                ? `0 0 12px ${glow}`
                : `0 0 12px hsl(43 100% 52% / 0.5)`,
            }}
          >
            {legend.name}
          </h3>
          {legend.description && (
            <p className="text-muted-foreground text-xs mt-1 leading-relaxed line-clamp-2">
              {legend.description}
            </p>
          )}
        </div>

        {/* Collection + chain info */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-[10px] capitalize border-border/40 text-muted-foreground">
            <Layers className="w-2.5 h-2.5 mr-1" />
            {legend.nftCollection}
          </Badge>
          <Badge
            variant="outline"
            className="text-[10px] border-border/40"
            style={{ color: `hsl(${accentHsl} / 0.7)`, borderColor: `hsl(${accentHsl} / 0.25)` }}
          >
            Ethereum
          </Badge>
        </div>

        {/* OpenSea link (if tokenId available) */}
        {legend.tokenId != null && (
          <a
            href={`https://opensea.io/assets/ethereum/${legend.tokenId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] transition-colors hover:opacity-80"
            style={{ color: `hsl(${accentHsl} / 0.6)` }}
          >
            <ExternalLink className="w-3 h-3" />
            View on OpenSea
          </a>
        )}
      </div>
    </div>
  );
}
