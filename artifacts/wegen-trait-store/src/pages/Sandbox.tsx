import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useListTraits } from "@workspace/api-client-react";
import { useCollection } from "@/contexts/CollectionContext";
import { useQuery } from "@tanstack/react-query";
import { useEthPrice, formatUsd } from "@/hooks/useEthPrice";
import { TraitMedia } from "@/components/TraitMedia";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Shuffle,
  Trash2,
  FlaskConical,
  ChevronRight,
  XCircle,
  Download,
  Trophy,
  Gamepad2,
  X,
  SkipForward,
  Zap,
} from "lucide-react";

const BANGERS = { fontFamily: "'Bungee', Impact, sans-serif", letterSpacing: "0.08em" };
const DISPLAY = { fontFamily: "'Bungee Shade', 'Bungee', Impact, sans-serif", letterSpacing: "0.02em" };

const LAYER_ICONS: Record<string, string> = {
  Background: "🖼️",
  Body: "🧍",
  Clothes: "👕",
  Mouth: "👄",
  Eyes: "👁️",
  Headgear: "🎩",
};

const DEFAULT_LAYER_ORDER = ["Headgear", "Eyes", "Mouth", "Clothes", "Body", "Background"];

type TraitItem = {
  id: number;
  name: string;
  category: string;
  imageUrl?: string | null;
  mediaType?: string | null;
  priceEth: string;
  isActive: boolean;
};

/* ── FNV-1a deterministic RNG ────────────────────────────────────────────── */
function seededRand(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h ^ s.charCodeAt(i), 16777619)) >>> 0;
  return h / 0xFFFFFFFF;
}

function newBountyKey(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function playCelebrationJingle() {
  try {
    const AC = (window.AudioContext ?? (window as Record<string, unknown>).webkitAudioContext) as typeof AudioContext;
    const ctx = new AC();
    const melody: [number, number, number][] = [
      [523.25, 0.00, 0.14],
      [659.25, 0.15, 0.14],
      [783.99, 0.30, 0.14],
      [1046.50, 0.45, 0.24],
      [783.99, 0.70, 0.10],
      [659.25, 0.82, 0.10],
      [1046.50, 0.94, 0.10],
      [1318.51, 1.06, 0.38],
    ];
    melody.forEach(([freq, t, dur]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.14, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + dur);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + dur + 0.02);
    });
  } catch { /* audio not supported */ }
}

/* ── Confetti pieces ─────────────────────────────────────────────────────── */
const CONFETTI = Array.from({ length: 48 }, (_, i) => ({
  id: i,
  left: `${(seededRand("conf" + i) * 100).toFixed(1)}%`,
  color: ["#9d00ff", "#c8920a", "#22c55e", "#3b82f6", "#f43f5e", "#f59e0b"][i % 6],
  size: 6 + Math.floor(seededRand("sz" + i) * 10),
  delay: `${(seededRand("del" + i) * 2.4).toFixed(2)}s`,
  duration: `${(1.8 + seededRand("dur" + i) * 2).toFixed(2)}s`,
  shape: i % 3 === 0 ? "50%" : i % 3 === 1 ? "2px" : "0%",
}));

const DEFAULT_CELEBRATION_GIF = "https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif";

type GameSettings = {
  dailyGameEnabled: boolean;
  dailyGameOverrides: Record<string, Record<string, number | null>>;
  celebrationGifUrl: string | null;
};

export function Sandbox() {
  const { collection, theme } = useCollection();
  const { accent, glow, glow2, gradient, gradient2 } = theme;
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [selected, setSelected] = useState<Record<string, TraitItem | null>>({});
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [bountyKey, setBountyKey] = useState<string>(newBountyKey);
  const [bountyCount, setBountyCount] = useState(0);
  const winTriggered = useRef(false);

  const { data: traitsData, isLoading } = useListTraits({ includeAll: true, limit: 9999, nftCollection: collection });
  const { data: layerData } = useQuery({
    queryKey: ["sandbox-layer-order", collection],
    queryFn: async () => {
      const res = await fetch(`/api/admin/layers?nftCollection=${encodeURIComponent(collection)}`);
      if (!res.ok) return { layerOrder: DEFAULT_LAYER_ORDER };
      return res.json() as Promise<{ layerOrder: string[] }>;
    },
  });
  const { data: gameSettings } = useQuery<GameSettings>({
    queryKey: ["game-settings", collection],
    queryFn: async () => {
      const res = await fetch(`/api/admin/game-settings?nftCollection=${encodeURIComponent(collection)}`);
      if (!res.ok) return { dailyGameEnabled: true, dailyGameOverrides: {}, celebrationGifUrl: null };
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const { ethUsd } = useEthPrice();

  const layerOrder: string[] = layerData?.layerOrder ?? DEFAULT_LAYER_ORDER;
  const traits = (traitsData?.traits ?? []) as TraitItem[];

  const byCategory = useMemo(() => {
    const map: Record<string, TraitItem[]> = {};
    for (const t of traits) {
      const cat = t.category || "Other";
      if (!map[cat]) map[cat] = [];
      map[cat].push(t);
    }
    return map;
  }, [traits]);

  /* ── Dynamic category list: layerOrder first, then any extras ─────────── */
  const displayCategories = useMemo(() => {
    const ordered = layerOrder.filter((c) => byCategory[c]);
    const extras = Object.keys(byCategory).filter((c) => !layerOrder.includes(c));
    return [...ordered, ...extras];
  }, [layerOrder, byCategory]);

  /* ── Reset activeCategory when collection/categories change ──────────── */
  useEffect(() => {
    if (displayCategories.length > 0 && !displayCategories.includes(activeCategory)) {
      setActiveCategory(displayCategories[0]);
    }
  }, [displayCategories, activeCategory]);

  /* ── Bounty target: pick one trait per category using seeded key ──────── */
  const bountyTraits = useMemo<Record<string, TraitItem | null>>(() => {
    const picks: Record<string, TraitItem | null> = {};
    for (const cat of displayCategories) {
      const pool = byCategory[cat] ?? [];
      if (pool.length === 0) { picks[cat] = null; continue; }
      const idx = Math.floor(seededRand(bountyKey + "|" + cat) * pool.length);
      picks[cat] = pool[Math.min(idx, pool.length - 1)];
    }
    return picks;
  }, [byCategory, bountyKey, displayCategories]);

  const bountyCats = useMemo(
    () => displayCategories.filter((c) => bountyTraits[c] !== null),
    [bountyTraits, displayCategories],
  );

  const bountyMatchCount = useMemo(
    () => bountyCats.filter((c) => selected[c]?.id === bountyTraits[c]?.id).length,
    [selected, bountyTraits, bountyCats],
  );

  const isBountyDone = bountyCats.length > 0 && bountyMatchCount === bountyCats.length;

  /* ── Advance to next bounty ───────────────────────────────────────────── */
  const advanceBounty = useCallback(() => {
    winTriggered.current = false;
    setBountyKey(newBountyKey());
    setBountyCount((n) => n + 1);
    setSelected({});
    setShowCelebration(false);
  }, []);

  useEffect(() => {
    if (isBountyDone && !winTriggered.current) {
      winTriggered.current = true;
      playCelebrationJingle();
      setTimeout(() => setShowCelebration(true), 500);
    }
  }, [isBountyDone]);

  /* ── Reset winTriggered when bountyKey changes ────────────────────────── */
  useEffect(() => {
    winTriggered.current = false;
  }, [bountyKey]);

  const activeCategoryTraits = byCategory[activeCategory] ?? [];
  const selectedCount = Object.values(selected).filter(Boolean).length;
  const activeCatSelectedTrait = selected[activeCategory] ?? null;

  /* ── Variant pack names available for this nft collection ────────────── */
  const { data: collectionsData } = useQuery({
    queryKey: ["variant-collections", collection],
    queryFn: async () => {
      const res = await fetch(`/api/traits/variant-collections?nftCollection=${encodeURIComponent(collection)}`);
      if (!res.ok) return { collections: [] as string[] };
      return res.json() as Promise<{ collections: string[] }>;
    },
    staleTime: 1000 * 60 * 5,
  });
  const variantCollections = collectionsData?.collections ?? [];

  /* ── Variant image map for the active pack ────────────────────────────── */
  const { data: variantMapData } = useQuery({
    queryKey: ["variants-by-collection", collection, selectedCollection],
    queryFn: async () => {
      if (!selectedCollection) return { variantMap: {} as Record<number, { imageUrl: string | null; mediaType: string }> };
      const res = await fetch(`/api/traits/variants/by-collection?nftCollection=${encodeURIComponent(collection)}&name=${encodeURIComponent(selectedCollection)}`);
      if (!res.ok) return { variantMap: {} as Record<number, { imageUrl: string | null; mediaType: string }> };
      return res.json() as Promise<{ variantMap: Record<number, { imageUrl: string | null; mediaType: string }> }>;
    },
    enabled: true,
    staleTime: 1000 * 60 * 5,
  });
  const variantMap = variantMapData?.variantMap ?? {};

  function selectTrait(cat: string, trait: TraitItem | null) {
    setSelected((prev) => ({ ...prev, [cat]: trait }));
  }

  function clearAll() { setSelected({}); }

  function randomize() {
    const next: Record<string, TraitItem | null> = {};
    for (const cat of displayCategories) {
      const pool = byCategory[cat] ?? [];
      next[cat] = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;
    }
    setSelected(next);
  }

  async function saveImage() {
    if (selectedCount === 0) return;
    setIsSaving(true);
    try {
      const SIZE = 1024;
      const offscreen = document.createElement("canvas");
      offscreen.width = SIZE;
      offscreen.height = SIZE;
      const ctx = offscreen.getContext("2d");
      if (!ctx) return;
      const layersBackToFront = [...layerOrder].reverse();
      for (const cat of layersBackToFront) {
        const trait = selected[cat];
        if (!trait) continue;
        const variantEntry = selectedCollection ? variantMap[trait.id] : undefined;
        const imageUrl = variantEntry?.imageUrl ?? trait.imageUrl;
        if (!imageUrl) continue;
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => { ctx.drawImage(img, 0, 0, SIZE, SIZE); resolve(); };
          img.onerror = () => resolve();
          img.src = imageUrl;
        });
      }
      offscreen.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `wegen-sandbox-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    } finally { setIsSaving(false); }
  }

  const totalLayers = layerOrder.length;
  const gameEnabled = gameSettings?.dailyGameEnabled ?? true;
  const celebGif = gameSettings?.celebrationGifUrl ?? DEFAULT_CELEBRATION_GIF;

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: gradient2,
            border: `1px solid ${accent}66`,
            boxShadow: `0 0 16px ${glow2}`,
          }}
        >
          <FlaskConical className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1
            className="text-4xl leading-none"
            style={{
              ...DISPLAY,
              color: "hsl(var(--primary))",
              textShadow: `3px 3px 0px rgba(0,0,0,1), 0 0 28px ${glow}, 0 0 60px ${glow2}`,
              WebkitTextStroke: "1.5px rgba(0,0,0,0.9)",
              paintOrder: "stroke fill",
            }}
          >
            TRAIT{" "}
            <span style={{ color: "hsl(var(--accent))", textShadow: "3px 3px 0px rgba(0,0,0,1), 0 0 28px hsl(43 100% 56% / 0.9), 0 0 60px hsl(43 100% 40% / 0.35)" }}>
              SANDBOX
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Mix and match any trait to preview your Wegen before buying.
          </p>
        </div>
      </div>

      {/* ── Bounty Challenge Banner ───────────────────────────────────────── */}
      {!isLoading && bountyCats.length > 0 && gameEnabled && (
        <div
          className="rounded-xl p-4 space-y-3"
          style={{
            background: isBountyDone
              ? "linear-gradient(135deg, hsl(120 60% 10% / 0.9), hsl(120 40% 8% / 0.9))"
              : "linear-gradient(135deg, hsl(272 30% 10% / 0.95), hsl(272 20% 7% / 0.95))",
            border: `1px solid ${isBountyDone ? "hsl(120 100% 45% / 0.45)" : "hsl(43 100% 52% / 0.35)"}`,
            boxShadow: isBountyDone
              ? "0 0 24px hsl(120 100% 45% / 0.15)"
              : "0 0 16px hsl(43 100% 52% / 0.1)",
          }}
        >
          {/* Title row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Gamepad2 className="w-4 h-4" style={{ color: "hsl(43 100% 52%)" }} />
              <span
                className="text-lg leading-none"
                style={{ ...BANGERS, color: "hsl(43 100% 55%)", textShadow: "0 0 12px hsl(43 100% 52% / 0.5)" }}
              >
                WEGEN BOUNTY
              </span>
              {bountyCount > 0 && (
                <span
                  className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: `${accent}33`, color: accent, border: `1px solid ${accent}59` }}
                >
                  <Zap className="w-2.5 h-2.5" />
                  #{bountyCount + 1}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isBountyDone && (
                <span
                  className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg"
                  style={{ background: "hsl(120 100% 45% / 0.15)", color: "hsl(120 100% 60%)", border: "1px solid hsl(120 100% 45% / 0.4)" }}
                >
                  <Trophy className="w-3 h-3" /> BUILT!
                </span>
              )}
              <span className="text-[10px] font-mono text-muted-foreground/40">
                {bountyMatchCount}/{bountyCats.length} matched
              </span>
              <button
                onClick={advanceBounty}
                className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border transition-all hover:opacity-100 opacity-60"
                style={{
                  background: "hsl(272 20% 10%)",
                  border: `1px solid ${accent}40`,
                  color: accent,
                }}
                title="Skip to next bounty"
              >
                <SkipForward className="w-3 h-3" />
                Skip
              </button>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground/50 font-mono">
            // hunt through each layer — find and select the right trait to unlock it //
          </p>

          {/* Bounty target chips — hidden until matched */}
          <div className="flex flex-wrap gap-2">
            {bountyCats.map((cat) => {
              const t = bountyTraits[cat];
              const matched = selected[cat]?.id === t?.id;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-all hover:opacity-100"
                  style={{
                    background: matched ? "hsl(120 100% 45% / 0.12)" : "hsl(272 20% 8%)",
                    border: matched ? "1px solid hsl(120 100% 45% / 0.6)" : "1px solid hsl(272 100% 62% / 0.2)",
                    boxShadow: matched ? "0 0 10px hsl(120 100% 45% / 0.2)" : undefined,
                  }}
                >
                  {matched ? (
                    t?.imageUrl ? (
                      <img
                        src={t.imageUrl}
                        alt={t.name}
                        className="w-5 h-5 object-contain rounded flex-shrink-0"
                      />
                    ) : (
                      <span className="text-sm leading-none">{LAYER_ICONS[cat] ?? "📦"}</span>
                    )
                  ) : (
                    <span className="text-sm leading-none opacity-40">{LAYER_ICONS[cat] ?? "📦"}</span>
                  )}
                  <span className="text-muted-foreground/50 font-mono">{cat}:</span>
                  <span
                    className="font-semibold max-w-[90px] truncate"
                    style={{ color: matched ? "hsl(120 100% 65%)" : "hsl(var(--muted-foreground))", opacity: matched ? 1 : 0.35 }}
                  >
                    {matched ? t?.name : "???"}
                  </span>
                  {matched && (
                    <span className="text-green-400 text-sm leading-none flex-shrink-0">✓</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(272 20% 12%)" }}>
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                style={{
                  width: `${bountyCats.length > 0 ? (bountyMatchCount / bountyCats.length) * 100 : 0}%`,
                  background: isBountyDone
                    ? "linear-gradient(90deg, hsl(120 100% 45%), hsl(120 100% 65%))"
                    : "linear-gradient(90deg, hsl(43 100% 45%), hsl(43 100% 62%))",
                  boxShadow: isBountyDone ? "0 0 8px hsl(120 100% 50%)" : undefined,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* ── Left: Composite Display ────────────────────────────────── */}
          <div className="w-full lg:w-auto flex-shrink-0 flex flex-col items-center gap-4 lg:sticky lg:top-[90px]">
            {/* Canvas */}
            <div
              className="relative rounded-2xl overflow-hidden"
              style={{
                width: 500,
                height: 500,
                maxWidth: "100%",
                background: "radial-gradient(ellipse at 30% 30%, hsl(272 40% 12%), hsl(272 25% 6%) 70%)",
                border: isBountyDone
                  ? "2px solid hsl(120 100% 55% / 0.7)"
                  : `2px solid ${accent}59`,
                boxShadow: isBountyDone
                  ? "0 0 40px hsl(120 100% 55% / 0.35), inset 0 0 40px rgba(0,0,0,0.4)"
                  : `0 0 40px ${glow2}, inset 0 0 40px rgba(0,0,0,0.4)`,
                transition: "border-color 0.5s, box-shadow 0.5s",
              }}
            >
              {selectedCount === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
                  <div className="text-6xl opacity-20" style={{ filter: "grayscale(1)" }}>🎭</div>
                  <p className="text-xs text-muted-foreground/40 uppercase tracking-widest" style={BANGERS}>
                    Select traits below
                  </p>
                </div>
              )}
              {[...layerOrder].reverse().map((cat, reversedIdx) => {
                const layerIdx = totalLayers - 1 - reversedIdx;
                const zIndex = totalLayers - layerIdx;
                const trait = selected[cat];
                if (!trait) return null;
                const variantEntry = selectedCollection ? variantMap[trait.id] : undefined;
                const effectiveUrl = variantEntry?.imageUrl ?? trait.imageUrl;
                if (!effectiveUrl) return null;
                return (
                  <div key={cat} className="absolute inset-0" style={{ zIndex }}>
                    <TraitMedia
                      url={effectiveUrl}
                      mediaType={trait.mediaType ?? undefined}
                      alt={trait.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                );
              })}
              {/* Corner label */}
              <div
                className="absolute bottom-2 right-2 z-50 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest opacity-40"
                style={{ ...BANGERS, background: "rgba(0,0,0,0.5)", color: "hsl(43 100% 52%)" }}
              >
                {isBountyDone ? "Bounty Built!" : "Preview"}
              </div>
            </div>

            {/* ── Variant Pack Tabs — always visible ────────────────────── */}
            <div className="w-full" style={{ maxWidth: 500 }}>
              <div className="flex flex-wrap items-center gap-2 py-3 border-t border-b" style={{ borderColor: `${accent}18` }}>
                <span className="text-[9px] font-mono uppercase tracking-widest mr-1" style={{ color: `${accent}60` }}>SKIN</span>
                <button
                  onClick={() => setSelectedCollection(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
                  style={
                    !selectedCollection
                      ? { background: gradient2, border: `1px solid ${accent}80`, boxShadow: `0 0 10px ${glow2}`, color: accent }
                      : { border: "1px solid rgba(255,255,255,0.12)", color: "hsl(var(--muted-foreground))" }
                  }
                >
                  ◈ Original
                </button>
                {variantCollections.map((col) => (
                  <button
                    key={col}
                    onClick={() => setSelectedCollection(col)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
                    style={
                      selectedCollection === col
                        ? { background: gradient2, border: `1px solid ${accent}80`, boxShadow: `0 0 10px ${glow2}`, color: accent }
                        : { border: "1px solid rgba(255,255,255,0.12)", color: "hsl(var(--muted-foreground))" }
                    }
                  >
                    {col}
                  </button>
                ))}
                {variantCollections.length === 0 && (
                  <span className="text-[10px] font-mono text-muted-foreground/30 italic">
                    add variant packs in Admin → Edit Trait
                  </span>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2 w-full" style={{ maxWidth: 500 }}>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2 border-primary/40 hover:bg-primary/10 hover:border-primary text-sm"
                  onClick={randomize}
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  Randomize
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 gap-2 border-border/40 hover:bg-destructive/10 hover:border-destructive/60 hover:text-destructive text-sm"
                  onClick={clearAll}
                  disabled={selectedCount === 0}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear All
                </Button>
              </div>
              <Button
                className="w-full gap-2 text-sm font-semibold"
                onClick={saveImage}
                disabled={selectedCount === 0 || isSaving}
                style={{
                  background: selectedCount === 0 ? undefined : "linear-gradient(135deg, hsl(43 100% 52%), hsl(35 100% 50%))",
                  color: selectedCount === 0 ? undefined : "#000",
                  border: "none",
                  boxShadow: selectedCount > 0 ? "0 0 18px hsl(43 100% 52% / 0.35)" : undefined,
                }}
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                {isSaving ? "Saving…" : "Save Image"}
              </Button>
            </div>

            {/* Selected summary chips */}
            {selectedCount > 0 && (
              <div className="w-full space-y-1.5" style={{ maxWidth: 500 }}>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold">
                  Current Build
                </p>
                <div className="flex flex-col gap-1">
                  {layerOrder.map((cat) => {
                    const t = selected[cat];
                    if (!t) return null;
                    const isMatchedBounty = bountyTraits[cat]?.id === t.id;
                    return (
                      <div
                        key={cat}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all"
                        style={{
                          background: isMatchedBounty ? "hsl(120 60% 8%)" : "hsl(272 20% 10%)",
                          border: isMatchedBounty ? "1px solid hsl(120 100% 45% / 0.4)" : `1px solid ${accent}33`,
                        }}
                      >
                        <span className="text-base leading-none">{LAYER_ICONS[cat] ?? "📦"}</span>
                        <span className="text-muted-foreground/60 w-16 flex-shrink-0">{cat}</span>
                        <ChevronRight className="w-3 h-3 text-muted-foreground/30 flex-shrink-0" />
                        <span className="text-foreground font-medium flex-1 truncate">{t.name}</span>
                        {isMatchedBounty && <span className="text-green-400 text-sm">✓</span>}
                        <button
                          onClick={() => selectTrait(cat, null)}
                          className="text-muted-foreground/40 hover:text-destructive transition-colors flex-shrink-0"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Right: Trait Selector ─────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            {/* Category tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
              {displayCategories.map((cat) => {
                const isActive = activeCategory === cat;
                const sel = selected[cat];
                const hasBountyForCat = bountyTraits[cat] !== null;
                const catMatched = sel?.id === bountyTraits[cat]?.id;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all ${
                      isActive
                        ? "border-primary/70 text-primary"
                        : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground bg-secondary/30"
                    }`}
                    style={
                      isActive
                        ? { background: gradient2, boxShadow: `0 0 12px ${glow2}` }
                        : {}
                    }
                  >
                    <span className="text-base leading-none">{LAYER_ICONS[cat] ?? "📦"}</span>
                    {cat}
                    {/* Bounty dot: green = matched, gold = pending */}
                    {hasBountyForCat && gameEnabled && (
                      <span
                        className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-background"
                        style={{
                          background: catMatched ? "hsl(120 100% 50%)" : "hsl(43 100% 52%)",
                          boxShadow: catMatched ? "0 0 6px hsl(120 100% 55%)" : "0 0 6px hsl(43 100% 52% / 0.8)",
                          animation: catMatched ? undefined : "dailyBadgePulse 1.4s ease-in-out infinite",
                        }}
                      />
                    )}
                    {/* Selected dot (only when no bounty) */}
                    {(!hasBountyForCat || !gameEnabled) && sel && (
                      <span
                        className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary border-2 border-background"
                        style={{ boxShadow: "0 0 6px hsl(272 100% 62% / 0.8)" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Trait grid */}
            <div
              className="rounded-xl p-4"
              style={{ background: "hsl(272 20% 7%)", border: `1px solid ${accent}26` }}
            >
              {/* Category header */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">{LAYER_ICONS[activeCategory] ?? "📦"}</span>
                <h3 className="text-lg leading-none" style={{ ...BANGERS, color: "hsl(var(--accent))" }}>
                  {activeCategory}
                </h3>
                <span className="text-xs text-muted-foreground/50 ml-1">
                  {activeCategoryTraits.length} available
                </span>
                {selected[activeCategory] && (
                  <button
                    onClick={() => selectTrait(activeCategory, null)}
                    className="ml-auto flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-destructive transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Clear
                  </button>
                )}
              </div>

              {activeCategoryTraits.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground/40 text-sm">
                  No {activeCategory.toLowerCase()} traits uploaded yet.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                  {/* None option */}
                  <button
                    onClick={() => selectTrait(activeCategory, null)}
                    className={`group flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                      !selected[activeCategory]
                        ? "border-primary/60 bg-primary/10 shadow-[0_0_12px_hsl(272_100%_62%_/_0.2)]"
                        : "border-border/30 bg-secondary/20 hover:border-border hover:bg-secondary/40"
                    }`}
                  >
                    <div className="w-full aspect-square rounded-lg flex items-center justify-center text-2xl bg-secondary/50">
                      ✕
                    </div>
                    <span className="text-[11px] font-semibold text-muted-foreground/60 group-hover:text-foreground transition-colors">
                      None
                    </span>
                  </button>

                  {activeCategoryTraits.map((trait) => {
                    const isSelected = selected[activeCategory]?.id === trait.id;
                    const isBountyMatch = gameEnabled && bountyTraits[activeCategory]?.id === trait.id && isSelected;

                    return (
                      <button
                        key={trait.id}
                        onClick={() => selectTrait(activeCategory, isSelected ? null : trait)}
                        className={`group flex flex-col items-center gap-2 p-2.5 rounded-xl border transition-all ${
                          isBountyMatch
                            ? "daily-trait-selected border-green-500/80"
                            : isSelected
                            ? "border-primary/70 shadow-[0_0_14px_hsl(272_100%_62%_/_0.35)]"
                            : "border-border/30 bg-secondary/20 hover:border-primary/40 hover:bg-secondary/50"
                        }`}
                        style={
                          isBountyMatch
                            ? { background: "linear-gradient(135deg, hsl(120 80% 12% / 0.6), hsl(120 60% 8% / 0.4))" }
                            : isSelected
                            ? { background: gradient2 }
                            : {}
                        }
                      >
                        {/* Thumbnail */}
                        <div className="w-full aspect-square rounded-lg overflow-hidden bg-secondary/50 relative">
                          {trait.imageUrl ? (
                            <TraitMedia
                              url={trait.imageUrl}
                              mediaType={trait.mediaType ?? undefined}
                              alt={trait.name}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>
                          )}

                          {/* Vaulted badge */}
                          {!trait.isActive && (
                            <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-secondary/80 text-muted-foreground/60 border border-border/30">
                              Vault
                            </div>
                          )}

                          {/* Bounty match badge — only shows when user hits the right one */}
                          {isBountyMatch && (
                            <div
                              className="absolute top-1 right-1 text-sm leading-none"
                              style={{ filter: "drop-shadow(0 0 4px hsl(120 100% 55%))" }}
                            >
                              ✅
                            </div>
                          )}

                          {/* Selected ring */}
                          {isSelected && (
                            <div
                              className="absolute inset-0 rounded-lg pointer-events-none"
                              style={{
                                border: isBountyMatch
                                  ? "2px solid hsl(120 100% 60%)"
                                  : `2px solid ${accent}cc`,
                                boxShadow: isBountyMatch
                                  ? "inset 0 0 10px hsl(120 100% 55% / 0.3)"
                                  : `inset 0 0 8px ${accent}4d`,
                              }}
                            />
                          )}
                        </div>

                        {/* Name */}
                        <div className="w-full text-center">
                          <p className={`text-[11px] font-semibold truncate ${
                            isBountyMatch ? "text-green-400"
                            : isSelected ? "text-primary"
                            : "text-muted-foreground group-hover:text-foreground"
                          } transition-colors`}>
                            {trait.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground/40 font-mono">
                            {trait.priceEth} ETH
                            {formatUsd(trait.priceEth, ethUsd) && (
                              <span className="text-muted-foreground/30">
                                {" · "}{formatUsd(trait.priceEth, ethUsd)}
                              </span>
                            )}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ── Celebration Overlay ──────────────────────────────────────────── */}
      {showCelebration && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-6 overflow-hidden"
          style={{ background: "rgba(0,0,0,0.92)" }}
          onClick={() => setShowCelebration(false)}
        >
          {/* Confetti */}
          {CONFETTI.map((c) => (
            <div
              key={c.id}
              className="absolute pointer-events-none"
              style={{
                left: c.left,
                top: "-20px",
                width: c.size,
                height: c.size,
                background: c.color,
                borderRadius: c.shape,
                animation: `confettiFall ${c.duration} ${c.delay} ease-in forwards`,
              }}
            />
          ))}

          {/* Card */}
          <div
            className="relative flex flex-col items-center gap-5 p-8 rounded-2xl max-w-md w-full"
            style={{
              background: "linear-gradient(160deg, #1a0d2e 0%, #0d0714 100%)",
              border: "2px solid hsl(120 100% 45% / 0.6)",
              boxShadow: "0 0 60px hsl(120 100% 45% / 0.3), 0 0 120px hsl(120 100% 45% / 0.12)",
              animation: "celebrationPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => setShowCelebration(false)}
              className="absolute top-3 right-3 text-muted-foreground/40 hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Headline */}
            <div className="text-center space-y-1">
              <p className="text-3xl">🏆</p>
              <h2
                className="text-3xl leading-none"
                style={{
                  ...DISPLAY,
                  color: "hsl(120 100% 60%)",
                  animation: "celebrationGlow 1.2s ease-in-out infinite",
                  WebkitTextStroke: "1px rgba(0,0,0,0.8)",
                  paintOrder: "stroke fill",
                }}
              >
                BOUNTY
              </h2>
              <h3
                className="text-2xl leading-none"
                style={{
                  ...BANGERS,
                  color: "hsl(43 100% 55%)",
                  textShadow: "2px 2px 0 rgba(0,0,0,1), 0 0 20px hsl(43 100% 52% / 0.6)",
                }}
              >
                COMPLETE!
              </h3>
            </div>

            <p className="text-center text-sm text-muted-foreground/70 font-mono leading-relaxed">
              You nailed the Wegen build.<br />
              A new bounty is ready — keep going!
            </p>

            {/* GIF */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "2px solid hsl(120 100% 45% / 0.3)", maxWidth: 260, width: "100%" }}
            >
              <img
                src={celebGif}
                alt="Celebration!"
                className="w-full"
                style={{ display: "block" }}
              />
            </div>

            {/* Bounty counter */}
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-xl"
              style={{ background: "hsl(272 40% 10%)", border: `1px solid ${accent}4d` }}
            >
              <Zap className="w-4 h-4" style={{ color: accent }} />
              <span className="text-sm font-semibold" style={{ color: accent, ...BANGERS }}>
                {bountyCount + 1} BUILT
              </span>
            </div>

            {/* Next button */}
            <Button
              className="w-full gap-2 font-bold text-base"
              onClick={advanceBounty}
              style={{
                background: "linear-gradient(135deg, hsl(43 100% 52%), hsl(35 100% 50%))",
                color: "#000",
                border: "none",
                boxShadow: "0 0 20px hsl(43 100% 52% / 0.4)",
              }}
            >
              <Gamepad2 className="w-4 h-4" />
              Next Bounty
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
