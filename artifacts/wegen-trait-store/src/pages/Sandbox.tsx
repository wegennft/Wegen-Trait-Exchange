import { useState, useMemo, useEffect, useRef } from "react";
import { useListTraits } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
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
const CATEGORIES = ["Background", "Body", "Clothes", "Eyes", "Headgear", "Mouth"];

type TraitItem = {
  id: number;
  name: string;
  category: string;
  imageUrl?: string | null;
  mediaType?: string | null;
  priceEth: string;
  isActive: boolean;
};

/* ── Daily mini-game utilities ───────────────────────────────────────────── */

function seededRand(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h ^ s.charCodeAt(i), 16777619)) >>> 0;
  return h / 0xFFFFFFFF;
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function playCelebrationJingle() {
  try {
    const AC = (window.AudioContext ?? (window as Record<string, unknown>).webkitAudioContext) as typeof AudioContext;
    const ctx = new AC();
    // Hip-hop celebration riff (C major pentatonic)
    const melody: [number, number, number][] = [
      [523.25, 0.00, 0.14], // C5
      [659.25, 0.15, 0.14], // E5
      [783.99, 0.30, 0.14], // G5
      [1046.50, 0.45, 0.24], // C6
      [783.99, 0.70, 0.10], // G5
      [659.25, 0.82, 0.10], // E5
      [1046.50, 0.94, 0.10], // C6
      [1318.51, 1.06, 0.38], // E6 long finish
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

/* ── Confetti piece data (stable across renders) ─────────────────────────── */
const CONFETTI = Array.from({ length: 48 }, (_, i) => ({
  id: i,
  left: `${(seededRand("conf" + i) * 100).toFixed(1)}%`,
  color: ["#9d00ff", "#c8920a", "#22c55e", "#3b82f6", "#f43f5e", "#f59e0b"][i % 6],
  size: 6 + Math.floor(seededRand("sz" + i) * 10),
  delay: `${(seededRand("del" + i) * 2.4).toFixed(2)}s`,
  duration: `${(1.8 + seededRand("dur" + i) * 2).toFixed(2)}s`,
  shape: i % 3 === 0 ? "50%" : i % 3 === 1 ? "2px" : "0%",
}));

/* ── Celebration GIF (Giphy confetti) ────────────────────────────────────── */
const CELEBRATION_GIF = "https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif";

export function Sandbox() {
  const [activeCategory, setActiveCategory] = useState<string>(CATEGORIES[0]);
  const [selected, setSelected] = useState<Record<string, TraitItem | null>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const todayKey = useMemo(() => getTodayKey(), []);
  const wonLsKey = `wegen-daily-won-${todayKey}`;
  const [alreadyWonToday] = useState<boolean>(() => {
    try { return localStorage.getItem(`wegen-daily-won-${getTodayKey()}`) === "1"; } catch { return false; }
  });
  const winTriggered = useRef(false);

  const { data: traitsData, isLoading } = useListTraits({ includeAll: true, limit: 9999 });
  const { data: layerData } = useQuery({
    queryKey: ["sandbox-layer-order"],
    queryFn: async () => {
      const res = await fetch("/api/admin/layers");
      if (!res.ok) return { layerOrder: DEFAULT_LAYER_ORDER };
      return res.json() as Promise<{ layerOrder: string[] }>;
    },
  });

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

  /* ── Daily picks: deterministic per-date seed ───────────────────────── */
  const dailyTraits = useMemo<Record<string, TraitItem | null>>(() => {
    const picks: Record<string, TraitItem | null> = {};
    for (const cat of CATEGORIES) {
      const pool = (byCategory[cat] ?? []).filter((t) => t.isActive);
      if (pool.length === 0) { picks[cat] = null; continue; }
      const idx = Math.floor(seededRand(todayKey + "|" + cat) * pool.length);
      picks[cat] = pool[Math.min(idx, pool.length - 1)];
    }
    return picks;
  }, [byCategory, todayKey]);

  const dailyCats = useMemo(
    () => CATEGORIES.filter((c) => dailyTraits[c] !== null),
    [dailyTraits],
  );

  const dailyMatchCount = useMemo(
    () => dailyCats.filter((c) => selected[c]?.id === dailyTraits[c]?.id).length,
    [selected, dailyTraits, dailyCats],
  );

  const isDailyWin = dailyCats.length > 0 && dailyMatchCount === dailyCats.length;

  useEffect(() => {
    if (isDailyWin && !alreadyWonToday && !winTriggered.current) {
      winTriggered.current = true;
      playCelebrationJingle();
      setTimeout(() => setShowCelebration(true), 500);
      try { localStorage.setItem(wonLsKey, "1"); } catch {}
    }
  }, [isDailyWin, alreadyWonToday, wonLsKey]);

  const activeCategoryTraits = byCategory[activeCategory] ?? [];
  const selectedCount = Object.values(selected).filter(Boolean).length;

  function selectTrait(cat: string, trait: TraitItem | null) {
    setSelected((prev) => ({ ...prev, [cat]: trait }));
  }

  function clearAll() { setSelected({}); }

  function randomize() {
    const next: Record<string, TraitItem | null> = {};
    for (const cat of CATEGORIES) {
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
        if (!trait?.imageUrl) continue;
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => { ctx.drawImage(img, 0, 0, SIZE, SIZE); resolve(); };
          img.onerror = () => resolve();
          img.src = trait.imageUrl!;
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

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, hsl(272 100% 62% / 0.3), hsl(43 100% 52% / 0.2))",
            border: "1px solid hsl(272 100% 62% / 0.4)",
            boxShadow: "0 0 16px hsl(272 100% 62% / 0.2)",
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
              textShadow: "3px 3px 0px rgba(0,0,0,1), 0 0 28px hsl(272 100% 65% / 0.7), 0 0 60px hsl(272 100% 65% / 0.3)",
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

      {/* ── Daily Wegen Challenge Banner ─────────────────────────────────── */}
      {!isLoading && dailyCats.length > 0 && (
        <div
          className="rounded-xl p-4 space-y-3"
          style={{
            background: alreadyWonToday || isDailyWin
              ? "linear-gradient(135deg, hsl(120 60% 10% / 0.9), hsl(120 40% 8% / 0.9))"
              : "linear-gradient(135deg, hsl(272 30% 10% / 0.95), hsl(272 20% 7% / 0.95))",
            border: `1px solid ${alreadyWonToday || isDailyWin ? "hsl(120 100% 45% / 0.45)" : "hsl(43 100% 52% / 0.35)"}`,
            boxShadow: alreadyWonToday || isDailyWin
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
                DAILY WEGEN
              </span>
              <span className="text-[10px] font-mono text-muted-foreground/40 border border-border/30 px-1.5 py-0.5 rounded">
                {todayKey}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {(alreadyWonToday || isDailyWin) && (
                <span
                  className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg"
                  style={{ background: "hsl(120 100% 45% / 0.15)", color: "hsl(120 100% 60%)", border: "1px solid hsl(120 100% 45% / 0.4)" }}
                >
                  <Trophy className="w-3 h-3" /> COMPLETED
                </span>
              )}
              <span className="text-[10px] font-mono text-muted-foreground/40">
                {dailyMatchCount}/{dailyCats.length} matched
              </span>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground/50 font-mono">
            // assemble today's Wegen — find all 6 highlighted traits across each layer //
          </p>

          {/* Daily target chips */}
          <div className="flex flex-wrap gap-2">
            {dailyCats.map((cat) => {
              const t = dailyTraits[cat];
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
                  {t?.imageUrl ? (
                    <img
                      src={t.imageUrl}
                      alt={t.name}
                      className="w-5 h-5 object-contain rounded flex-shrink-0"
                    />
                  ) : (
                    <span className="text-sm leading-none">{LAYER_ICONS[cat] ?? "📦"}</span>
                  )}
                  <span className="text-muted-foreground/50 font-mono">{cat}:</span>
                  <span
                    className="font-semibold max-w-[90px] truncate"
                    style={{ color: matched ? "hsl(120 100% 65%)" : "hsl(var(--foreground))" }}
                  >
                    {t?.name}
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
                  width: `${dailyCats.length > 0 ? (dailyMatchCount / dailyCats.length) * 100 : 0}%`,
                  background: isDailyWin
                    ? "linear-gradient(90deg, hsl(120 100% 45%), hsl(120 100% 65%))"
                    : "linear-gradient(90deg, hsl(43 100% 45%), hsl(43 100% 62%))",
                  boxShadow: isDailyWin ? "0 0 8px hsl(120 100% 50%)" : undefined,
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
          <div className="w-full lg:w-auto flex-shrink-0 flex flex-col items-center gap-4">
            {/* Canvas */}
            <div
              className="relative rounded-2xl overflow-hidden"
              style={{
                width: 380,
                height: 380,
                maxWidth: "100%",
                background: "radial-gradient(ellipse at 30% 30%, hsl(272 40% 12%), hsl(272 25% 6%) 70%)",
                border: isDailyWin
                  ? "2px solid hsl(120 100% 55% / 0.7)"
                  : "2px solid hsl(272 100% 62% / 0.35)",
                boxShadow: isDailyWin
                  ? "0 0 40px hsl(120 100% 55% / 0.35), inset 0 0 40px rgba(0,0,0,0.4)"
                  : "0 0 40px hsl(272 100% 62% / 0.15), inset 0 0 40px rgba(0,0,0,0.4)",
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
                if (!trait?.imageUrl) return null;
                return (
                  <div key={cat} className="absolute inset-0" style={{ zIndex }}>
                    <TraitMedia
                      url={trait.imageUrl}
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
                {isDailyWin ? "Daily Win!" : "Preview"}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2 w-full" style={{ maxWidth: 380 }}>
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
              <div className="w-full space-y-1.5" style={{ maxWidth: 380 }}>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold">
                  Current Build
                </p>
                <div className="flex flex-col gap-1">
                  {layerOrder.map((cat) => {
                    const t = selected[cat];
                    if (!t) return null;
                    const isMatchedDaily = dailyTraits[cat]?.id === t.id;
                    return (
                      <div
                        key={cat}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all"
                        style={{
                          background: isMatchedDaily ? "hsl(120 60% 8%)" : "hsl(272 20% 10%)",
                          border: isMatchedDaily ? "1px solid hsl(120 100% 45% / 0.4)" : "1px solid hsl(272 100% 62% / 0.2)",
                        }}
                      >
                        <span className="text-base leading-none">{LAYER_ICONS[cat] ?? "📦"}</span>
                        <span className="text-muted-foreground/60 w-16 flex-shrink-0">{cat}</span>
                        <ChevronRight className="w-3 h-3 text-muted-foreground/30 flex-shrink-0" />
                        <span className="text-foreground font-medium flex-1 truncate">{t.name}</span>
                        {isMatchedDaily && <span className="text-green-400 text-sm">✓</span>}
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
              {CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat;
                const sel = selected[cat];
                const hasDailyForCat = dailyTraits[cat] !== null;
                const catMatched = sel?.id === dailyTraits[cat]?.id;
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
                        ? { background: "linear-gradient(135deg, hsl(272 100% 62% / 0.15), hsl(272 100% 62% / 0.05))", boxShadow: "0 0 12px hsl(272 100% 62% / 0.2)" }
                        : {}
                    }
                  >
                    <span className="text-base leading-none">{LAYER_ICONS[cat] ?? "📦"}</span>
                    {cat}
                    {/* Daily game dot (green = matched, gold = pending) */}
                    {hasDailyForCat && (
                      <span
                        className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-background"
                        style={{
                          background: catMatched ? "hsl(120 100% 50%)" : "hsl(43 100% 52%)",
                          boxShadow: catMatched ? "0 0 6px hsl(120 100% 55%)" : "0 0 6px hsl(43 100% 52% / 0.8)",
                          animation: catMatched ? undefined : "dailyBadgePulse 1.4s ease-in-out infinite",
                        }}
                      />
                    )}
                    {/* Selected dot (only when no daily) */}
                    {!hasDailyForCat && sel && (
                      <span
                        className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary border-2 border-background"
                        style={{ boxShadow: "0 0 6px hsl(272 100% 62% / 0.8)" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Trait grid for active category */}
            <div
              className="rounded-xl p-4"
              style={{ background: "hsl(272 20% 7%)", border: "1px solid hsl(272 100% 62% / 0.15)" }}
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
                {dailyTraits[activeCategory] && (
                  <span
                    className="ml-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                    style={{
                      background: "hsl(43 100% 52% / 0.15)",
                      color: "hsl(43 100% 62%)",
                      border: "1px solid hsl(43 100% 52% / 0.4)",
                      animation: "dailyBadgePulse 1.8s ease-in-out infinite",
                    }}
                  >
                    🎮 Daily Pick Active
                  </span>
                )}
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
                    const isDaily = dailyTraits[activeCategory]?.id === trait.id;

                    return (
                      <button
                        key={trait.id}
                        onClick={() => selectTrait(activeCategory, isSelected ? null : trait)}
                        className={`group flex flex-col items-center gap-2 p-2.5 rounded-xl border transition-all ${
                          isSelected && isDaily
                            ? "daily-trait-selected border-green-500/80"
                            : isSelected
                            ? "border-primary/70 shadow-[0_0_14px_hsl(272_100%_62%_/_0.35)]"
                            : isDaily
                            ? "daily-trait-glow border-green-500/60"
                            : "border-border/30 bg-secondary/20 hover:border-primary/40 hover:bg-secondary/50"
                        }`}
                        style={
                          isSelected && isDaily
                            ? { background: "linear-gradient(135deg, hsl(120 80% 12% / 0.6), hsl(120 60% 8% / 0.4))" }
                            : isSelected
                            ? { background: "linear-gradient(135deg, hsl(272 100% 62% / 0.18), hsl(272 100% 62% / 0.06))" }
                            : isDaily
                            ? { background: "linear-gradient(135deg, hsl(120 80% 10% / 0.5), hsl(120 60% 7% / 0.3))" }
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

                          {/* Daily crown badge */}
                          {isDaily && (
                            <div
                              className="absolute top-1 right-1 text-sm leading-none"
                              style={{ animation: "dailyBadgePulse 1.4s ease-in-out infinite", filter: "drop-shadow(0 0 4px hsl(120 100% 55%))" }}
                              title="Today's Daily Pick!"
                            >
                              {isSelected ? "✅" : "🎮"}
                            </div>
                          )}

                          {/* Selected ring */}
                          {(isSelected || isDaily) && (
                            <div
                              className="absolute inset-0 rounded-lg pointer-events-none"
                              style={{
                                border: isSelected && isDaily
                                  ? "2px solid hsl(120 100% 60%)"
                                  : isSelected
                                  ? "2px solid hsl(272 100% 62% / 0.8)"
                                  : "2px solid hsl(120 100% 45% / 0.5)",
                                boxShadow: isSelected && isDaily
                                  ? "inset 0 0 10px hsl(120 100% 55% / 0.3)"
                                  : isSelected
                                  ? "inset 0 0 8px hsl(272 100% 62% / 0.3)"
                                  : "inset 0 0 6px hsl(120 100% 45% / 0.15)",
                              }}
                            />
                          )}
                        </div>

                        {/* Name */}
                        <div className="w-full text-center">
                          <p className={`text-[11px] font-semibold truncate ${
                            isSelected && isDaily ? "text-green-400"
                            : isSelected ? "text-primary"
                            : isDaily ? "text-green-500"
                            : "text-muted-foreground group-hover:text-foreground"
                          } transition-colors`}>
                            {trait.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground/40 font-mono">
                            {trait.priceEth} ETH
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
                DAILY WEGEN
              </h2>
              <h3
                className="text-2xl leading-none"
                style={{
                  ...BANGERS,
                  color: "hsl(43 100% 55%)",
                  textShadow: "2px 2px 0 #000, 0 0 20px hsl(43 100% 52% / 0.7)",
                }}
              >
                ACHIEVED!
              </h3>
            </div>

            {/* GIF */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "2px solid hsl(120 100% 45% / 0.3)", maxWidth: 260, width: "100%" }}
            >
              <img
                src={CELEBRATION_GIF}
                alt="Celebration!"
                className="w-full"
                style={{ display: "block" }}
              />
            </div>

            {/* Matched traits recap */}
            <div className="w-full space-y-1.5">
              <p className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest text-center">
                Today's winning combo
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {dailyCats.map((cat) => {
                  const t = dailyTraits[cat];
                  return (
                    <div
                      key={cat}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs"
                      style={{ background: "hsl(120 60% 8%)", border: "1px solid hsl(120 100% 45% / 0.3)" }}
                    >
                      <span className="text-sm leading-none">{LAYER_ICONS[cat] ?? "📦"}</span>
                      <span className="text-muted-foreground/50 flex-shrink-0">{cat}:</span>
                      <span className="font-semibold text-green-300 truncate">{t?.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CTA */}
            <Button
              className="w-full gap-2 font-bold text-black"
              onClick={() => setShowCelebration(false)}
              style={{
                background: "linear-gradient(135deg, hsl(120 100% 45%), hsl(120 100% 60%))",
                boxShadow: "0 0 20px hsl(120 100% 45% / 0.5)",
                border: "none",
              }}
            >
              <Trophy className="w-4 h-4" />
              EPIC — CLOSE
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
