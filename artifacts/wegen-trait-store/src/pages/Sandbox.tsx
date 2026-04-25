import { useState, useMemo } from "react";
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
} from "lucide-react";

const BANGERS = { fontFamily: "'Bangers', Impact, sans-serif", letterSpacing: "0.1em" };

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

export function Sandbox() {
  const [activeCategory, setActiveCategory] = useState<string>(CATEGORIES[0]);
  const [selected, setSelected] = useState<Record<string, TraitItem | null>>({});

  // Fetch all traits (including vaulted) for sandbox
  const { data: traitsData, isLoading } = useListTraits({ includeAll: true });

  // Fetch layer order from admin settings
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

  // Group traits by category
  const byCategory = useMemo(() => {
    const map: Record<string, TraitItem[]> = {};
    for (const t of traits) {
      const cat = t.category || "Other";
      if (!map[cat]) map[cat] = [];
      map[cat].push(t);
    }
    return map;
  }, [traits]);

  const activeCategoryTraits = byCategory[activeCategory] ?? [];
  const selectedCount = Object.values(selected).filter(Boolean).length;

  function selectTrait(cat: string, trait: TraitItem | null) {
    setSelected((prev) => ({ ...prev, [cat]: trait }));
  }

  function clearAll() {
    setSelected({});
  }

  function randomize() {
    const next: Record<string, TraitItem | null> = {};
    for (const cat of CATEGORIES) {
      const pool = byCategory[cat] ?? [];
      next[cat] = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;
    }
    setSelected(next);
  }

  // Layers rendered back-to-front: iterate in reverse so index 0 (front) is on top
  // z-index: totalLayers - indexInLayerOrder (so index 0 of layerOrder gets highest z)
  const totalLayers = layerOrder.length;

  return (
    <div className="space-y-6">
      {/* Header */}
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
              ...BANGERS,
              color: "hsl(var(--primary))",
              textShadow:
                "3px 3px 0px rgba(0,0,0,1), 0 0 20px hsl(272 100% 62% / 0.5)",
              WebkitTextStroke: "1.5px rgba(0,0,0,0.8)",
              paintOrder: "stroke fill",
            }}
          >
            TRAIT{" "}
            <span
              style={{
                color: "hsl(var(--accent))",
                textShadow:
                  "3px 3px 0px rgba(0,0,0,1), 0 0 20px hsl(43 100% 52% / 0.5)",
              }}
            >
              SANDBOX
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Mix and match any trait to preview your Wegen before buying.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* ── Left: Composite Display ─────────────────────────────────── */}
          <div className="w-full lg:w-auto flex-shrink-0 flex flex-col items-center gap-4">
            {/* Canvas */}
            <div
              className="relative rounded-2xl overflow-hidden"
              style={{
                width: 380,
                height: 380,
                maxWidth: "100%",
                background:
                  "radial-gradient(ellipse at 30% 30%, hsl(272 40% 12%), hsl(272 25% 6%) 70%)",
                border: "2px solid hsl(272 100% 62% / 0.35)",
                boxShadow:
                  "0 0 40px hsl(272 100% 62% / 0.15), inset 0 0 40px rgba(0,0,0,0.4)",
              }}
            >
              {/* Placeholder when nothing selected */}
              {selectedCount === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
                  <div
                    className="text-6xl opacity-20"
                    style={{ filter: "grayscale(1)" }}
                  >
                    🎭
                  </div>
                  <p
                    className="text-xs text-muted-foreground/40 uppercase tracking-widest"
                    style={BANGERS}
                  >
                    Select traits below
                  </p>
                </div>
              )}

              {/* Layer composite: render back-to-front (last layer order item first in DOM) */}
              {[...layerOrder].reverse().map((cat, reversedIdx) => {
                const layerIdx = totalLayers - 1 - reversedIdx;
                const zIndex = totalLayers - layerIdx; // index 0 = highest zIndex
                const trait = selected[cat];
                if (!trait?.imageUrl) return null;
                return (
                  <div
                    key={cat}
                    className="absolute inset-0"
                    style={{ zIndex }}
                  >
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
                style={{
                  ...BANGERS,
                  background: "rgba(0,0,0,0.5)",
                  color: "hsl(43 100% 52%)",
                }}
              >
                Preview
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 w-full" style={{ maxWidth: 380 }}>
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
                    return (
                      <div
                        key={cat}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs"
                        style={{
                          background: "hsl(272 20% 10%)",
                          border: "1px solid hsl(272 100% 62% / 0.2)",
                        }}
                      >
                        <span className="text-base leading-none">{LAYER_ICONS[cat] ?? "📦"}</span>
                        <span className="text-muted-foreground/60 w-16 flex-shrink-0">{cat}</span>
                        <ChevronRight className="w-3 h-3 text-muted-foreground/30 flex-shrink-0" />
                        <span className="text-foreground font-medium flex-1 truncate">{t.name}</span>
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

          {/* ── Right: Trait Selector ────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            {/* Category tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
              {CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat;
                const sel = selected[cat];
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
                        ? {
                            background:
                              "linear-gradient(135deg, hsl(272 100% 62% / 0.15), hsl(272 100% 62% / 0.05))",
                            boxShadow: "0 0 12px hsl(272 100% 62% / 0.2)",
                          }
                        : {}
                    }
                  >
                    <span className="text-base leading-none">{LAYER_ICONS[cat] ?? "📦"}</span>
                    {cat}
                    {/* Selected dot */}
                    {sel && (
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
              style={{
                background: "hsl(272 20% 7%)",
                border: "1px solid hsl(272 100% 62% / 0.15)",
              }}
            >
              {/* Category header */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">{LAYER_ICONS[activeCategory] ?? "📦"}</span>
                <h3
                  className="text-lg leading-none"
                  style={{ ...BANGERS, color: "hsl(var(--accent))" }}
                >
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
                    return (
                      <button
                        key={trait.id}
                        onClick={() => selectTrait(activeCategory, isSelected ? null : trait)}
                        className={`group flex flex-col items-center gap-2 p-2.5 rounded-xl border transition-all ${
                          isSelected
                            ? "border-primary/70 shadow-[0_0_14px_hsl(272_100%_62%_/_0.35)]"
                            : "border-border/30 bg-secondary/20 hover:border-primary/40 hover:bg-secondary/50"
                        }`}
                        style={
                          isSelected
                            ? {
                                background:
                                  "linear-gradient(135deg, hsl(272 100% 62% / 0.18), hsl(272 100% 62% / 0.06))",
                              }
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
                            <div className="w-full h-full flex items-center justify-center text-2xl">
                              📦
                            </div>
                          )}
                          {/* Vaulted badge */}
                          {!trait.isActive && (
                            <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-secondary/80 text-muted-foreground/60 border border-border/30">
                              Vault
                            </div>
                          )}
                          {/* Selected ring */}
                          {isSelected && (
                            <div
                              className="absolute inset-0 rounded-lg pointer-events-none"
                              style={{
                                border: "2px solid hsl(272 100% 62% / 0.8)",
                                boxShadow: "inset 0 0 8px hsl(272 100% 62% / 0.3)",
                              }}
                            />
                          )}
                        </div>
                        {/* Name */}
                        <div className="w-full text-center">
                          <p
                            className={`text-[11px] font-semibold truncate ${
                              isSelected ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                            } transition-colors`}
                          >
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
    </div>
  );
}
