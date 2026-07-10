import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCollection } from "@/contexts/CollectionContext";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SmackzCoin } from "@/components/SmackzCoin";
import {
  Trophy, Star, Zap, Flame, ShieldCheck, Lock, CheckCircle2, Gift,
  TrendingUp, Award, Crown, Sparkles, Clock, Coins, Package, X,
} from "lucide-react";

const BANGERS = { fontFamily: "'Bungee', Impact, sans-serif", letterSpacing: "0.08em" };

// ── Types ─────────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  walletAddress: string;
  totalPoints: number;
  updatedAt: string;
}

interface EarnedEntry {
  walletAddress: string;
  totalEarned: number;
}

interface PointHistory {
  id: number;
  type: "purchase" | "confirm_traits" | "sandbox_bounty" | "redeem" | "admin_airdrop";
  points: number;
  description: string | null;
  claimedAt: string | null;
  createdAt: string;
}

interface MyStats {
  totalPoints: number;
  rank: number;
  dailyCompletions: number;
  dailyLimit: number;
  dailyLimitPerCollection: number;
  wegensCompletions: number;
  wegenettesCompletions: number;
  pendingPoints: number;
  history: PointHistory[];
}

interface BountyBundleItem {
  quantity: number;
  trait: BountyTrait;
}

interface BountyBundle {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  pointCost: number;
  totalSupply: number;
  remainingSupply: number;
  isActive: number;
  items: BountyBundleItem[];
}

interface IncludedTrait {
  id: number;
  name: string;
  imageUrl: string | null;
  category: string;
}

interface BountyTrait {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  pointCost: number;
  totalSupply: number;
  remainingSupply: number;
  isActive: number;
  walletPurchaseCount: number;
  includedTraits: IncludedTrait[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TX_LABELS: Record<string, string> = {
  purchase: "Trait Purchase",
  confirm_traits: "Save On Chain",
  sandbox_bounty: "Sandbox Bounty",
  redeem: "Redeemed Reward",
  admin_airdrop: "Point Airdrop",
};

const TX_ICON: Record<string, typeof Zap> = {
  purchase: Zap,
  confirm_traits: ShieldCheck,
  sandbox_bounty: Flame,
  redeem: Gift,
};

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function Bounties() {
  const { theme, collection } = useCollection();
  const { accent, accent2, accentHsl, glow, glow2, gradient, gradient2 } = theme;
  const { walletAddress, isConnected } = useWallet();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [lbView, setLbView] = useState<"current" | "earned">("current");
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationPoints, setCelebrationPoints] = useState(0);

  // Game settings (celebration media)
  const { data: gameSettings } = useQuery({
    queryKey: ["game-settings"],
    queryFn: async () => {
      const r = await fetch("/api/admin/game-settings");
      if (!r.ok) return null;
      return r.json() as Promise<{ celebrationGifUrl: string | null; celebrationMediaType: string | null }>;
    },
    staleTime: 5 * 60_000,
  });

  const celebrationUrl = gameSettings?.celebrationGifUrl ?? null;
  const celebrationMediaType = gameSettings?.celebrationMediaType ?? null;

  // Auto-dismiss gif celebrations (videos self-dismiss via onEnded)
  useEffect(() => {
    if (!showCelebration || celebrationMediaType === "video") return;
    const t = setTimeout(() => setShowCelebration(false), 6000);
    return () => clearTimeout(t);
  }, [showCelebration, celebrationMediaType]);

  // Leaderboard
  const { data: lbData } = useQuery({
    queryKey: ["bounties-leaderboard"],
    queryFn: async () => {
      const r = await fetch("/api/bounties/leaderboard");
      return r.json() as Promise<{ leaderboard: LeaderboardEntry[]; earnedLeaderboard: EarnedEntry[] }>;
    },
    refetchInterval: 30_000,
  });

  // My stats (only when signed in)
  const { data: meData } = useQuery({
    queryKey: ["bounties-me"],
    queryFn: async () => {
      const r = await fetch("/api/bounties/me");
      if (!r.ok) return null;
      return r.json() as Promise<MyStats>;
    },
    enabled: isConnected,
  });

  // Bounty traits (rewards store)
  const { data: traitsData } = useQuery({
    queryKey: ["bounty-traits"],
    queryFn: async () => {
      const r = await fetch("/api/bounties/traits");
      return r.json() as Promise<{ traits: BountyTrait[] }>;
    },
  });

  // Sandbox complete mutation
  const sandboxMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/bounties/sandbox-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nftCollection: collection }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error ?? "Failed");
      }
      return r.json();
    },
    onSuccess: (d) => {
      const colLabel = d.nftCollection === "wegenettes" ? "Wegenettes" : "Wegens";
      toast({ title: `+${d.pointsAwarded} We Smackz earned!`, description: `${colLabel}: ${d.dailyCompletions}/${d.dailyLimit} bounties today.` });
      qc.invalidateQueries({ queryKey: ["bounties-me"] });
      qc.invalidateQueries({ queryKey: ["bounties-leaderboard"] });
      if (celebrationUrl) { setCelebrationPoints(d.pointsAwarded ?? 5); setShowCelebration(true); }
    },
    onError: (e: Error) => {
      toast({ title: "Bounty failed", description: e.message, variant: "destructive" });
    },
  });

  // Claim pending points mutation
  const claimMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/bounties/claim-points", { method: "POST" });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error ?? "Failed");
      }
      return r.json() as Promise<{ pointsClaimed: number }>;
    },
    onSuccess: (d) => {
      toast({ title: `🎉 ${d.pointsClaimed} We Smackz claimed!`, description: "We Smackz have been added to your balance." });
      qc.invalidateQueries({ queryKey: ["bounties-me"] });
      qc.invalidateQueries({ queryKey: ["bounties-leaderboard"] });
    },
    onError: (e: Error) => {
      toast({ title: "Claim failed", description: e.message, variant: "destructive" });
    },
  });

  // Bundles query
  const { data: bundlesData } = useQuery({
    queryKey: ["bounty-bundles"],
    queryFn: async () => {
      const r = await fetch("/api/bounties/bundles");
      return r.json() as Promise<{ bundles: BountyBundle[] }>;
    },
  });
  const bundles = bundlesData?.bundles ?? [];

  // Redeem bundle mutation
  const redeemBundleMutation = useMutation({
    mutationFn: async (bundleId: number) => {
      const r = await fetch(`/api/bounties/bundles/${bundleId}/redeem`, { method: "POST" });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error ?? "Failed");
      }
      return r.json() as Promise<{ bundleName: string; pointsSpent: number; remainingPoints: number; deliveredTraits: string[] }>;
    },
    onSuccess: (d) => {
      toast({
        title: `${d.bundleName} redeemed!`,
        description: `Received: ${d.deliveredTraits.join(", ")}. ${d.remainingPoints} We Smackz remaining.`,
      });
      qc.invalidateQueries({ queryKey: ["bounties-me"] });
      qc.invalidateQueries({ queryKey: ["bounty-traits"] });
      qc.invalidateQueries({ queryKey: ["bounty-bundles"] });
    },
    onError: (e: Error) => {
      toast({ title: "Redeem failed", description: e.message, variant: "destructive" });
    },
  });

  // Redeem trait mutation
  const redeemMutation = useMutation({
    mutationFn: async (traitId: number) => {
      const r = await fetch(`/api/bounties/traits/${traitId}/redeem`, { method: "POST" });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error ?? "Failed");
      }
      return r.json();
    },
    onSuccess: (d) => {
      toast({ title: `${d.traitName} redeemed!`, description: `Spent ${d.pointsSpent} We Smackz. ${d.remainingPoints} remaining.` });
      qc.invalidateQueries({ queryKey: ["bounties-me"] });
      qc.invalidateQueries({ queryKey: ["bounty-traits"] });
    },
    onError: (e: Error) => {
      toast({ title: "Redemption failed", description: e.message, variant: "destructive" });
    },
  });

  const leaderboard = lbData?.leaderboard ?? [];
  const earnedLeaderboard = lbData?.earnedLeaderboard ?? [];

  // Normalised data for whichever view is active
  const activeLb: { walletAddress: string; score: number }[] =
    lbView === "current"
      ? leaderboard.map((e) => ({ walletAddress: e.walletAddress, score: e.totalPoints }))
      : earnedLeaderboard.map((e) => ({ walletAddress: e.walletAddress, score: e.totalEarned }));

  const myEarnedRank =
    walletAddress
      ? (earnedLeaderboard.findIndex(
          (e) => e.walletAddress.toLowerCase() === walletAddress.toLowerCase(),
        ) + 1) || null
      : null;

  const traits = traitsData?.traits ?? [];
  const myRank = meData?.rank;
  const myPoints = meData?.totalPoints ?? 0;
  const pendingPoints = meData?.pendingPoints ?? 0;
  const limit = meData?.dailyLimitPerCollection ?? 5;
  const wegensLeft = meData ? limit - (meData.wegensCompletions ?? 0) : limit;
  const wegenettesLeft = meData ? limit - (meData.wegenettesCompletions ?? 0) : limit;
  const currentColLeft = collection === "wegenettes" ? wegenettesLeft : wegensLeft;
  const dailyLeft = currentColLeft;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

      {/* ── Header ── */}
      <div
        className="relative rounded-2xl overflow-hidden p-6"
        style={{
          background: `linear-gradient(135deg, hsl(${accentHsl} / 0.12), hsl(${accentHsl} / 0.04))`,
          border: `1px solid hsl(${accentHsl} / 0.25)`,
          boxShadow: `0 0 40px ${glow}`,
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: gradient, boxShadow: `0 0 20px ${glow}` }}
          >
            <Trophy className="w-7 h-7 text-black" />
          </div>
          <div className="flex-1">
            <h1 className="text-4xl" style={{ ...BANGERS, color: accent, textShadow: `0 0 20px ${glow}` }}>
              Bounties & We Smackz Rewards
            </h1>
            <div className="mt-3 max-w-2xl space-y-3">
              <p className="text-lg font-bold" style={{ color: accent2 || "#e8d8ff", textShadow: `0 0 12px ${glow}` }}>
                We Smackz is the Wegen reward currency — earn it by being an active holder and spend it on exclusive traits you can't buy anywhere else.
              </p>
              <ul className="text-base space-y-2" style={{ color: "#f0e8ff" }}>
                <li className="flex items-center gap-3">
                  <Zap className="w-4 h-4 flex-shrink-0" style={{ color: accent }} />
                  <span><span className="font-extrabold" style={{ color: accent }}>+150 We Smackz</span> every time you buy a trait from the Store</span>
                </li>
                <li className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 flex-shrink-0" style={{ color: accent }} />
                  <span><span className="font-extrabold" style={{ color: accent }}>+250 We Smackz</span> each time you Save On Chain (commit your NFT's look to the blockchain)</span>
                </li>
                <li className="flex items-center gap-3">
                  <Flame className="w-4 h-4 flex-shrink-0" style={{ color: accent }} />
                  <span><span className="font-extrabold" style={{ color: accent }}>+5 We Smackz</span> per daily Sandbox Bounty completed — up to 5/day per collection (Wegens &amp; Wegenettes tracked separately)</span>
                </li>
                <li className="flex items-center gap-3">
                  <Coins className="w-4 h-4 flex-shrink-0" style={{ color: accent }} />
                  <span><span className="font-extrabold" style={{ color: accent }}>Purchase We Smackz</span> directly in We Smackz Packs on the <a href="/bundles-points" className="underline underline-offset-2" style={{ color: accent }}>Packs &amp; We Smackz</a> page</span>
                </li>
                <li className="flex items-center gap-3">
                  <Star className="w-4 h-4 flex-shrink-0" style={{ color: accent }} />
                  <span><span className="font-extrabold" style={{ color: accent }}>Bonus We Smackz</span> via team airdrops — keep an eye on announcements</span>
                </li>
                <li className="flex items-center gap-3">
                  <Gift className="w-4 h-4 flex-shrink-0" style={{ color: accent }} />
                  <span><span className="font-extrabold" style={{ color: accent }}>Spend We Smackz</span> on exclusive reward traits in the Rewards Store tab below — limited supply, holders only</span>
                </li>
              </ul>
            </div>
          </div>
          {isConnected && meData && (
            <div className="text-right flex-shrink-0">
              <div className="flex items-center justify-end gap-2">
                <SmackzCoin size={26} />
                <div className="text-3xl font-bold" style={{ ...BANGERS, color: accent }}>
                  {myPoints.toLocaleString()}
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground">We Smackz</div>
              {myRank && (
                <div className="text-xs mt-1" style={{ color: `${accent}80` }}>
                  Rank #{myRank}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Point rules strip */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: Zap, label: "Trait Purchase", value: "+150 We Smackz", desc: "per unit bought" },
            { icon: ShieldCheck, label: "Save On Chain", value: "+250 We Smackz", desc: "per confirmation" },
            { icon: Flame, label: "Sandbox Bounty", value: "+5 We Smackz", desc: "5/day per collection" },
          ].map(({ icon: Icon, label, value, desc }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5"
              style={{
                background: "hsl(272 20% 6%)",
                border: `1px solid hsl(${accentHsl} / 0.12)`,
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `hsl(${accentHsl} / 0.15)` }}
              >
                <Icon className="w-4 h-4" style={{ color: accent }} />
              </div>
              <div>
                <div className="text-xs font-semibold text-foreground">{label}</div>
                <div className="text-[11px]" style={{ color: accent }}>{value} <span className="text-muted-foreground">{desc}</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Exclusive Rewards Preview ── */}
      {(traits.length > 0 || bundles.length > 0) && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold uppercase tracking-widest" style={{ ...BANGERS, color: `hsl(${accentHsl} / 0.85)`, letterSpacing: "0.12em" }}>
              Exclusive Rewards
            </h2>
            <span className="text-sm font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>Redeem with We Smackz in the Rewards Store</span>
          </div>

          {/* Bundles row */}
          {bundles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" style={{ color: "#a855f7" }} />
                <span className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: "#a855f7" }}>Reward Bundles</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {bundles.map((bundle) => {
                  const canAfford = myPoints >= bundle.pointCost;
                  const soldOut = bundle.remainingSupply !== -1 && bundle.remainingSupply <= 0;
                  const itemCount = bundle.items.length;
                  return (
                    <div
                      key={bundle.id}
                      className="rounded-xl overflow-hidden"
                      style={{ background: "hsl(272 20% 6%)", border: "1px solid #a855f740", opacity: soldOut ? 0.6 : 1 }}
                    >
                      {/* Trait thumbnails */}
                      {itemCount > 0 && (
                        <div className="flex flex-wrap gap-1.5 p-3">
                          {bundle.items.map((item) => (
                            <div key={item.trait.id} className="rounded-lg overflow-hidden bg-secondary/20 relative w-[110px] h-[110px] flex-shrink-0">
                              {item.trait.imageUrl ? (
                                <img src={item.trait.imageUrl} alt={item.trait.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Package className="w-5 h-5 opacity-20" />
                                </div>
                              )}
                              <span
                                className="absolute bottom-0 left-0 right-0 px-1 py-0.5 text-[9px] font-medium truncate text-white"
                                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent)" }}
                                title={item.trait.name}
                              >
                                {item.trait.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Bundle info */}
                      <div className="flex items-center justify-between gap-3 p-3 pt-1">
                        <div className="min-w-0 space-y-1">
                          <div className="text-sm font-semibold truncate text-foreground">{bundle.name}</div>
                          <div className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                            {itemCount} trait{itemCount !== 1 ? "s" : ""} included
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right space-y-1">
                          <div
                            className="text-sm font-bold flex items-center gap-1 justify-end"
                            style={{ color: canAfford && !soldOut ? "#a855f7" : "hsl(var(--muted-foreground))" }}
                          >
                            <SmackzCoin size={14} />
                            {bundle.pointCost.toLocaleString()} We Smackz
                          </div>
                          {soldOut && <span className="text-[10px] font-bold text-red-400">SOLD OUT</span>}
                          {bundle.totalSupply !== -1 && !soldOut && (
                            <div className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>{bundle.remainingSupply}/{bundle.totalSupply} left</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Individual traits row */}
          {traits.length > 0 && (
            <div className="space-y-2">
              {bundles.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Gift className="w-3.5 h-3.5" style={{ color: accent }} />
                  <span className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: accent }}>Individual Traits</span>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {traits.map((trait) => {
                  const canAfford = myPoints >= trait.pointCost;
                  const soldOut = trait.remainingSupply !== -1 && trait.remainingSupply <= 0;
                  const atLimit = trait.walletPurchaseCount >= 2;
                  return (
                    <div
                      key={trait.id}
                      className="item-glow-gold rounded-xl overflow-hidden"
                      style={{
                        background: "hsl(272 20% 6%)",
                        opacity: soldOut || atLimit ? 0.5 : 1,
                      }}
                    >
                      <div className="w-full aspect-square bg-secondary/20 relative overflow-hidden">
                        {trait.imageUrl ? (
                          <img src={trait.imageUrl} alt={trait.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Gift className="w-10 h-10 opacity-20" />
                          </div>
                        )}
                        {atLimit && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6" style={{ color: accent }} />
                          </div>
                        )}
                        {soldOut && !atLimit && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <span className="text-xs font-bold text-red-400">SOLD OUT</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3 space-y-1.5">
                        <div className="text-sm font-semibold truncate text-foreground">{trait.name}</div>
                        <div
                          className="text-sm font-bold flex items-center gap-1"
                          style={{ color: canAfford && !soldOut && !atLimit ? accent : "hsl(var(--muted-foreground))" }}
                        >
                          <SmackzCoin size={16} />
                          {trait.pointCost.toLocaleString()} We Smackz
                        </div>
                        {trait.totalSupply !== -1 && (
                          <div className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{trait.remainingSupply}/{trait.totalSupply} left</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tabs ── */}
      <Tabs defaultValue="leaderboard">
        <TabsList className="w-full" style={{ background: "hsl(272 20% 6%)", border: `1px solid hsl(${accentHsl} / 0.15)` }}>
          <TabsTrigger value="leaderboard" className="flex-1 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Leaderboard
          </TabsTrigger>
          <TabsTrigger value="rewards" className="flex-1 flex items-center gap-2">
            <Gift className="w-4 h-4" /> Rewards Store
          </TabsTrigger>
          <TabsTrigger value="my-points" className="flex-1 flex items-center gap-2">
            <SmackzCoin size={16} /> My We Smackz
          </TabsTrigger>
        </TabsList>

        {/* ── Leaderboard ── */}
        <TabsContent value="leaderboard" className="mt-6">

          {/* ── View toggle ── */}
          <div
            className="flex items-center gap-1 p-1 rounded-xl mb-6"
            style={{ background: "hsl(272 20% 5%)", border: `1px solid hsl(${accentHsl} / 0.12)` }}
          >
            {(["current", "earned"] as const).map((v) => {
              const active = lbView === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setLbView(v)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all"
                  style={
                    active
                      ? { background: gradient, color: "black", boxShadow: `0 0 14px ${glow}` }
                      : { color: "hsl(var(--muted-foreground))" }
                  }
                >
                  {v === "current" ? (
                    <><SmackzCoin size={16} /> Current Balance</>
                  ) : (
                    <><TrendingUp className="w-4 h-4" /> Total Earned</>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Description ── */}
          <p className="text-xs text-center mb-5" style={{ color: "hsl(var(--muted-foreground))" }}>
            {lbView === "current"
              ? "Current spendable We Smackz balance — decreases when rewards are redeemed."
              : "Lifetime We Smackz earned from trait purchases, saving on-chain, sandbox bounties, and airdrops — never decremented."}
          </p>

          {activeLb.length === 0 ? (
            <EmptyState icon={Trophy} label="No We Smackz earned yet — be the first!" accent={accent} glow={glow} />
          ) : (
            <div className="space-y-6">

              {/* ── Podium: Top 3 ── */}
              {activeLb.length >= 1 && (
                <div className="marquee-lights-gold marquee-lights rounded-2xl" style={{ background: `radial-gradient(ellipse 80% 100% at 50% 0%, hsl(${accentHsl} / 0.08), transparent 70%)` }}>
                <div className="flex items-end justify-center gap-3 pt-4 pb-2">
                  {/* 2nd place */}
                  {activeLb[1] && (() => {
                    const entry = activeLb[1];
                    const isMe = walletAddress?.toLowerCase() === entry.walletAddress.toLowerCase();
                    return (
                      <div className="flex flex-col items-center gap-2 flex-1 max-w-[170px]">
                        <div className="text-3xl">🥈</div>
                        <div
                          className="w-full rounded-t-2xl pt-5 pb-4 px-3 text-center"
                          style={{
                            background: isMe
                              ? `linear-gradient(180deg, hsl(${accentHsl} / 0.2), hsl(${accentHsl} / 0.08))`
                              : "linear-gradient(180deg, hsl(220 15% 16%), hsl(220 15% 10%))",
                            border: `1px solid ${isMe ? `hsl(${accentHsl} / 0.5)` : "hsl(220 15% 22%)"}`,
                            borderBottom: "none",
                            height: 118,
                          }}
                        >
                          <div className="text-4xl font-black" style={{ ...BANGERS, color: "#cbd5e1" }}>
                            {entry.score.toLocaleString()}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5 font-bold">We Smackz</div>
                          <div className="font-mono text-xs mt-2 truncate font-bold" style={{ color: isMe ? accent : "#cbd5e1" }}>
                            {truncate(entry.walletAddress)}
                            {isMe && <span className="ml-1 font-bold">(you)</span>}
                          </div>
                        </div>
                        <div
                          className="w-full text-center text-sm font-bold py-1.5 rounded-b-sm"
                          style={{ background: "#475569", color: "white" }}
                        >
                          #2
                        </div>
                      </div>
                    );
                  })()}

                  {/* 1st place */}
                  {(() => {
                    const entry = activeLb[0];
                    const isMe = walletAddress?.toLowerCase() === entry.walletAddress.toLowerCase();
                    return (
                      <div className="flex flex-col items-center gap-2 flex-1 max-w-[210px]">
                        <div className="text-4xl animate-bounce">👑</div>
                        <div
                          className="marquee-lights-gold marquee-lights w-full rounded-t-2xl pt-6 pb-4 px-3 text-center relative overflow-hidden"
                          style={{
                            background: isMe
                              ? `linear-gradient(180deg, hsl(${accentHsl} / 0.35), hsl(${accentHsl} / 0.12))`
                              : "linear-gradient(180deg, hsl(45 80% 18%), hsl(45 60% 8%))",
                            border: `2px solid ${isMe ? `hsl(${accentHsl} / 0.7)` : "#c8920a"}`,
                            borderBottom: "none",
                            boxShadow: isMe ? `0 0 32px ${glow}` : "0 0 32px #c8920a60",
                            height: 160,
                          }}
                        >
                          <div className="absolute inset-0 pointer-events-none" style={{
                            background: "linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.04) 50%, transparent 60%)",
                          }} />
                          <div className="text-5xl font-black" style={{ ...BANGERS, color: isMe ? accent : "#f59e0b", textShadow: `0 0 24px ${isMe ? glow : "#f59e0b80"}` }}>
                            {entry.score.toLocaleString()}
                          </div>
                          <div className="text-sm mt-0.5 font-bold" style={{ color: isMe ? accent : "#d97706" }}>We Smackz</div>
                          <div className="font-mono text-sm mt-2 truncate font-bold" style={{ color: isMe ? accent : "#fbbf24" }}>
                            {truncate(entry.walletAddress)}
                            {isMe && <span className="ml-1">(you)</span>}
                          </div>
                        </div>
                        <div
                          className="w-full text-center text-base font-bold py-2 rounded-b-sm"
                          style={{ background: "linear-gradient(90deg, #b45309, #d97706)", color: "white" }}
                        >
                          🏆 #1
                        </div>
                      </div>
                    );
                  })()}

                  {/* 3rd place */}
                  {activeLb[2] && (() => {
                    const entry = activeLb[2];
                    const isMe = walletAddress?.toLowerCase() === entry.walletAddress.toLowerCase();
                    return (
                      <div className="flex flex-col items-center gap-2 flex-1 max-w-[170px]">
                        <div className="text-3xl">🥉</div>
                        <div
                          className="w-full rounded-t-2xl pt-5 pb-4 px-3 text-center"
                          style={{
                            background: isMe
                              ? `linear-gradient(180deg, hsl(${accentHsl} / 0.2), hsl(${accentHsl} / 0.08))`
                              : "linear-gradient(180deg, hsl(25 40% 14%), hsl(25 30% 8%))",
                            border: `1px solid ${isMe ? `hsl(${accentHsl} / 0.5)` : "hsl(25 40% 22%)"}`,
                            borderBottom: "none",
                            height: 96,
                          }}
                        >
                          <div className="text-4xl font-black" style={{ ...BANGERS, color: "#cd7f32" }}>
                            {entry.score.toLocaleString()}
                          </div>
                          <div className="text-xs text-orange-800 mt-0.5 font-bold">We Smackz</div>
                          <div className="font-mono text-xs mt-2 truncate font-bold" style={{ color: isMe ? accent : "#cd7f32" }}>
                            {truncate(entry.walletAddress)}
                            {isMe && <span className="ml-1 font-bold">(you)</span>}
                          </div>
                        </div>
                        <div
                          className="w-full text-center text-sm font-bold py-1.5 rounded-b-sm"
                          style={{ background: "#78350f", color: "#fde68a" }}
                        >
                          #3
                        </div>
                      </div>
                    );
                  })()}
                </div>
                </div>
              )}

              {/* ── Rest of leaderboard ── */}
              {activeLb.length > 3 && (
                <div className="marquee-lights rounded-2xl overflow-hidden" style={{ border: `1px solid hsl(${accentHsl} / 0.12)` }}>
                  <div
                    className="grid grid-cols-[60px_1fr_auto] px-4 py-3 text-xs font-bold uppercase tracking-widest"
                    style={{ background: "hsl(272 20% 6%)", color: "hsl(var(--muted-foreground))" }}
                  >
                    <span>Rank</span>
                    <span>Wallet</span>
                    <span>{lbView === "current" ? "We Smackz" : "Earned"}</span>
                  </div>
                  {activeLb.slice(3).map((entry, idx) => {
                    const i = idx + 3;
                    const isMe = walletAddress?.toLowerCase() === entry.walletAddress.toLowerCase();
                    return (
                      <div
                        key={entry.walletAddress}
                        className="grid grid-cols-[60px_1fr_auto] items-center px-4 py-4 transition-colors"
                        style={{
                          background: isMe
                            ? `linear-gradient(90deg, hsl(${accentHsl} / 0.1), transparent)`
                            : i % 2 === 0 ? "hsl(272 20% 5%)" : "hsl(272 20% 7%)",
                          borderTop: `1px solid hsl(${accentHsl} / 0.07)`,
                          boxShadow: isMe ? `inset 3px 0 0 hsl(${accentHsl})` : "none",
                        }}
                      >
                        <span className="font-mono text-base font-bold" style={{ color: isMe ? accent : "hsl(var(--muted-foreground))" }}>
                          #{i + 1}
                        </span>
                        <span className="font-mono text-base truncate pr-4" style={{ color: isMe ? accent : "hsl(var(--foreground))" }}>
                          {truncate(entry.walletAddress)}
                          {isMe && (
                            <span
                              className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full animate-pulse"
                              style={{ background: `hsl(${accentHsl} / 0.2)`, color: accent }}
                            >
                              you
                            </span>
                          )}
                        </span>
                        <span className="font-bold text-xl tabular-nums" style={{ ...BANGERS, color: isMe ? accent : "hsl(var(--foreground))", textShadow: isMe ? `0 0 12px ${glow}` : "none" }}>
                          {entry.score.toLocaleString()}
                          <span className="text-xs font-normal text-muted-foreground ml-1">We Smackz</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── My rank callout (if not in top 50) ── */}
              {lbView === "current" && isConnected && myRank && myRank > leaderboard.length && (
                <div
                  className="marquee-lights rounded-xl px-4 py-4 flex items-center gap-4"
                  style={{
                    background: `linear-gradient(135deg, hsl(${accentHsl} / 0.12), hsl(${accentHsl} / 0.04))`,
                    border: `1px solid hsl(${accentHsl} / 0.3)`,
                    boxShadow: `0 0 24px ${glow}`,
                  }}
                >
                  <div className="font-mono text-sm text-muted-foreground font-bold">Your rank</div>
                  <div className="font-black text-4xl" style={{ ...BANGERS, color: accent, textShadow: `0 0 16px ${glow}` }}>#{myRank}</div>
                  <div className="flex-1" />
                  <div className="font-bold text-2xl" style={{ ...BANGERS, color: accent, textShadow: `0 0 16px ${glow}` }}>{myPoints.toLocaleString()} We Smackz</div>
                </div>
              )}
              {lbView === "earned" && isConnected && myEarnedRank && myEarnedRank > earnedLeaderboard.length && (
                <div
                  className="marquee-lights rounded-xl px-4 py-4 flex items-center gap-4"
                  style={{
                    background: `linear-gradient(135deg, hsl(${accentHsl} / 0.12), hsl(${accentHsl} / 0.04))`,
                    border: `1px solid hsl(${accentHsl} / 0.3)`,
                    boxShadow: `0 0 24px ${glow}`,
                  }}
                >
                  <div className="font-mono text-sm text-muted-foreground font-bold">Your earned rank</div>
                  <div className="font-black text-4xl" style={{ ...BANGERS, color: accent, textShadow: `0 0 16px ${glow}` }}>#{myEarnedRank}</div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── Rewards Store ── */}
        <TabsContent value="rewards" className="mt-6">
          {traits.length === 0 && bundles.length === 0 ? (
            <EmptyState icon={Sparkles} label="No rewards available yet — check back soon!" accent={accent} glow={glow} />
          ) : (
            <div className="space-y-8">

              {/* ── Bundles ── */}
              {bundles.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5" style={{ color: "#a855f7" }} />
                    <h2 className="text-lg font-bold" style={{ color: "#a855f7" }}>Reward Bundles</h2>
                    <Badge variant="outline" className="text-[10px] border-purple-500/40 text-purple-400">Bundle Deal</Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {bundles.map((bundle) => {
                      const canAfford = myPoints >= bundle.pointCost;
                      const soldOut = bundle.remainingSupply !== -1 && bundle.remainingSupply <= 0;
                      const locked = !isConnected || !canAfford || soldOut;

                      return (
                        <div
                          key={bundle.id}
                          className="rounded-2xl overflow-hidden"
                          style={{ background: "hsl(270 25% 6%)", border: "1px solid #a855f740" }}
                        >
                          {/* Bundle image */}
                          <div className="aspect-square bg-secondary/20 relative overflow-hidden">
                            {bundle.imageUrl ? (
                              <img src={bundle.imageUrl} alt={bundle.name} className="w-full h-full object-contain" />
                            ) : bundle.items.length > 0 ? (
                              <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-0.5">
                                {bundle.items.slice(0, 4).map((item) => (
                                  <div key={item.trait.id} className="bg-secondary/30 overflow-hidden aspect-square">
                                    {item.trait.imageUrl ? (
                                      <img src={item.trait.imageUrl} alt={item.trait.name} className="w-full h-full object-contain" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <Package className="w-6 h-6 opacity-20" style={{ color: "#a855f7" }} />
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-16 h-16 opacity-20" style={{ color: "#a855f7" }} />
                              </div>
                            )}
                            {soldOut && (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                <Badge variant="destructive">Sold Out</Badge>
                              </div>
                            )}
                          </div>

                          {/* Bundle info */}
                          <div className="p-4 space-y-3">
                            <div>
                              <h3 className="font-bold text-base text-foreground">{bundle.name}</h3>
                              {bundle.description && (
                                <p className="text-sm mt-1 line-clamp-2" style={{ color: "hsl(var(--muted-foreground))" }}>
                                  {bundle.description}
                                </p>
                              )}
                            </div>

                            {/* Included traits list */}
                            <div className="space-y-1">
                              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Includes</p>
                              <div className="flex flex-wrap gap-1">
                                {bundle.items.map((item) => (
                                  <Badge
                                    key={item.trait.id}
                                    variant="outline"
                                    className="text-[10px]"
                                    style={{ borderColor: "#a855f740", color: "#c084fc" }}
                                  >
                                    {item.trait.name}{item.quantity > 1 ? ` ×${item.quantity}` : ""}
                                  </Badge>
                                ))}
                              </div>
                            </div>

                            {/* Price + supply */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge
                                variant="outline"
                                className="text-xs font-semibold"
                                style={{ color: "#a855f7", borderColor: "#a855f740" }}
                              >
                                <SmackzCoin size={14} />
                                {bundle.pointCost.toLocaleString()} We Smackz
                              </Badge>
                              {bundle.totalSupply !== -1 && (
                                <Badge variant="outline" className="text-xs border-border/40" style={{ color: "hsl(var(--muted-foreground))" }}>
                                  {bundle.remainingSupply}/{bundle.totalSupply} left
                                </Badge>
                              )}
                            </div>

                            <Button
                              className="w-full text-sm font-bold"
                              disabled={locked || redeemBundleMutation.isPending}
                              onClick={() => redeemBundleMutation.mutate(bundle.id)}
                              style={
                                !locked
                                  ? { background: "linear-gradient(135deg, #9333ea, #7c3aed)", color: "white", boxShadow: "0 0 14px #9333ea60" }
                                  : {}
                              }
                            >
                              {!isConnected
                                ? "Connect Wallet"
                                : soldOut
                                ? "Sold Out"
                                : !canAfford
                                ? `Need ${bundle.pointCost - myPoints} more We Smackz`
                                : `Redeem Bundle for ${bundle.pointCost} We Smackz`}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Individual Traits ── */}
              {traits.length > 0 && (
                <div className="space-y-4">
                  {bundles.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Gift className="w-5 h-5" style={{ color: accent }} />
                      <h2 className="text-lg font-bold" style={{ color: accent }}>Individual Rewards</h2>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {traits.map((trait) => {
                const canAfford = myPoints >= trait.pointCost;
                const atLimit = trait.walletPurchaseCount >= 2;
                const soldOut = trait.remainingSupply !== -1 && trait.remainingSupply <= 0;
                const locked = !isConnected || !canAfford || atLimit || soldOut;

                return (
                  <div
                    key={trait.id}
                    className="item-glow-gold rounded-2xl overflow-hidden"
                    style={{ background: "hsl(272 20% 6%)" }}
                  >
                    {/* Image */}
                    <div className="aspect-square bg-secondary/20 relative overflow-hidden">
                      {trait.imageUrl ? (
                        <img src={trait.imageUrl} alt={trait.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Gift className="w-14 h-14 opacity-20" />
                        </div>
                      )}
                      {atLimit && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <div className="text-center">
                            <CheckCircle2 className="w-9 h-9 mx-auto mb-1" style={{ color: accent }} />
                            <div className="text-sm font-bold" style={{ color: accent }}>Max Owned</div>
                          </div>
                        </div>
                      )}
                      {soldOut && !atLimit && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <Badge variant="destructive">Sold Out</Badge>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-4 space-y-3">
                      <div>
                        <h3 className="font-bold text-base text-foreground">{trait.name}</h3>
                        {trait.description && (
                          <p className="text-sm mt-1 line-clamp-2" style={{ color: "hsl(var(--muted-foreground))" }}>{trait.description}</p>
                        )}
                      </div>

                      {/* Included store traits */}
                      {trait.includedTraits && trait.includedTraits.length > 0 && (
                        <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(157,0,255,0.08)", border: "1px solid rgba(157,0,255,0.18)" }}>
                          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>
                            Includes {trait.includedTraits.length} trait{trait.includedTraits.length !== 1 ? "s" : ""}
                          </p>
                          <div className="space-y-1.5">
                            {trait.includedTraits.map((st) => (
                              <div key={st.id} className="flex items-center gap-2">
                                {st.imageUrl ? (
                                  <img src={st.imageUrl} alt={st.name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0 ring-1 ring-white/10" />
                                ) : (
                                  <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: "rgba(157,0,255,0.15)" }}>
                                    <Gift className="w-4 h-4 opacity-40" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold truncate text-foreground">{st.name}</p>
                                  <p className="text-[10px] truncate" style={{ color: "hsl(var(--muted-foreground))" }}>{st.category}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Supply + wallet limit */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className="text-xs font-semibold"
                          style={{ color: accent, borderColor: `${accent}40` }}
                        >
                          <SmackzCoin size={14} />
                          {trait.pointCost.toLocaleString()} We Smackz
                        </Badge>
                        {trait.totalSupply !== -1 && (
                          <Badge variant="outline" className="text-xs border-border/40" style={{ color: "hsl(var(--muted-foreground))" }}>
                            {trait.remainingSupply}/{trait.totalSupply} left
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs border-border/40" style={{ color: "hsl(var(--muted-foreground))" }}>
                          <Lock className="w-3 h-3 mr-1" />
                          {trait.walletPurchaseCount}/2 owned
                        </Badge>
                      </div>

                      <Button
                        className="w-full text-sm font-bold"
                        disabled={locked || redeemMutation.isPending}
                        onClick={() => redeemMutation.mutate(trait.id)}
                        style={
                          !locked
                            ? { background: gradient2, color: "black", boxShadow: `0 0 12px ${glow2}` }
                            : {}
                        }
                      >
                        {!isConnected ? "Connect Wallet" :
                          atLimit ? "Limit Reached" :
                          soldOut ? "Sold Out" :
                          !canAfford ? `Need ${trait.pointCost - myPoints} more We Smackz` :
                          `Redeem for ${trait.pointCost} We Smackz`}
                      </Button>
                    </div>
                  </div>
                );
              })}
                  </div>
                </div>
              )}

            </div>
          )}
        </TabsContent>

        {/* ── My We Smackz ── */}
        <TabsContent value="my-points" className="mt-6 space-y-5">
          {!isConnected ? (
            <EmptyState icon={Award} label="Connect your wallet to view your We Smackz & history." accent={accent} glow={glow} />
          ) : (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { icon: Star, label: "Total We Smackz", value: myPoints.toLocaleString() },
                  { icon: Crown, label: "Rank", value: myRank ? `#${myRank}` : "—" },
                  { icon: Clock, label: `Daily Left (${collection === "wegenettes" ? "Wegenettes" : "Wegens"})`, value: `${dailyLeft}/5` },
                ].map(({ icon: Icon, label, value }) => (
                  <div
                    key={label}
                    className="rounded-xl p-4 text-center"
                    style={{ background: "hsl(272 20% 6%)", border: `1px solid hsl(${accentHsl} / 0.15)` }}
                  >
                    <Icon className="w-6 h-6 mx-auto mb-2" style={{ color: accent }} />
                    <div className="text-3xl font-bold" style={{ ...BANGERS, color: accent }}>{value}</div>
                    <div className="text-xs mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Pending points claim banner */}
              {pendingPoints > 0 && (
                <div
                  className="rounded-xl p-4 flex items-center gap-4"
                  style={{
                    background: "linear-gradient(135deg, hsl(45 100% 12%), hsl(45 100% 7%))",
                    border: "1px solid hsl(45 100% 40% / 0.5)",
                    boxShadow: "0 0 24px hsl(45 100% 50% / 0.2)",
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: "0 0 16px #f59e0b80" }}
                  >
                    <Gift className="w-6 h-6 text-black" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-sm text-amber-300">We Smackz Ready to Claim!</div>
                    <div className="text-xs text-amber-200/70 mt-0.5">
                      An admin airdropped We Smackz to your wallet. Claim them to add to your balance.
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={claimMutation.isPending}
                    onClick={() => claimMutation.mutate()}
                    style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "black", boxShadow: "0 0 16px #f59e0b80", fontWeight: 700 }}
                  >
                    {claimMutation.isPending ? "Claiming…" : `Claim ${pendingPoints.toLocaleString()} We Smackz`}
                  </Button>
                </div>
              )}

              {/* Sandbox bounty claim */}
              <div
                className="rounded-xl p-4 flex items-center gap-4"
                style={{ background: "hsl(272 20% 6%)", border: `1px solid hsl(${accentHsl} / 0.15)` }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: gradient }}
                >
                  <Flame className="w-6 h-6 text-black" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm">Sandbox Bounty — {collection === "wegenettes" ? "Wegenettes" : "Wegens"}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Complete a sandbox session to earn 5 We Smackz. Max 5/day per collection.
                  </div>
                  <div className="text-xs mt-1 flex gap-3" style={{ color: accent }}>
                    <span>Wegens: {meData?.wegensCompletions ?? 0}/5</span>
                    <span>Wegenettes: {meData?.wegenettesCompletions ?? 0}/5</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={dailyLeft <= 0 || sandboxMutation.isPending}
                  onClick={() => sandboxMutation.mutate()}
                  style={
                    dailyLeft > 0
                      ? { background: gradient, color: "black", boxShadow: `0 0 12px ${glow}` }
                      : {}
                  }
                >
                  {dailyLeft <= 0 ? "Limit Reached" : sandboxMutation.isPending ? "Claiming…" : "Claim Bounty"}
                </Button>
              </div>

              {/* History */}
              <div>
                <h3 className="text-sm font-bold mb-3" style={{ ...BANGERS, color: "hsl(var(--muted-foreground))", letterSpacing: "0.1em" }}>
                  RECENT ACTIVITY
                </h3>
                <div className="space-y-2">
                  {(meData?.history ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No activity yet.</p>
                  ) : (
                    (meData?.history ?? []).map((h) => {
                      const Icon = TX_ICON[h.type] ?? Star;
                      const isPositive = h.points > 0;
                      return (
                        <div
                          key={h.id}
                          className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                          style={{ background: "hsl(272 20% 6%)", border: "1px solid hsl(272 20% 12%)" }}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" style={{ color: isPositive ? accent : "#ef4444" }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">{TX_LABELS[h.type] ?? h.type}</div>
                            {h.description && (
                              <div className="text-[10px] text-muted-foreground truncate">{h.description}</div>
                            )}
                          </div>
                          <div
                            className="font-bold text-sm flex-shrink-0"
                            style={{ color: isPositive ? accent : "#ef4444" }}
                          >
                            {isPositive ? "+" : ""}{h.points} We Smackz
                          </div>
                          <div className="text-[10px] text-muted-foreground flex-shrink-0">
                            {new Date(h.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Celebration overlay */}
      {showCelebration && celebrationUrl && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowCelebration(false)}
        >
          <div className="relative flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
            {celebrationMediaType === "video" ? (
              <video
                src={celebrationUrl}
                autoPlay
                playsInline
                className="max-w-[90vw] max-h-[75vh] rounded-2xl shadow-2xl"
                style={{ boxShadow: `0 0 60px ${glow}` }}
                onEnded={() => setShowCelebration(false)}
              />
            ) : (
              <img
                src={celebrationUrl}
                alt="Bounty Celebration"
                className="max-w-[90vw] max-h-[75vh] rounded-2xl shadow-2xl"
                style={{ boxShadow: `0 0 60px ${glow}` }}
              />
            )}
            <div
              className="text-base font-black uppercase tracking-widest"
              style={{ ...BANGERS, color: accent, textShadow: `0 0 20px ${glow}` }}
            >
              +{celebrationPoints} We Smackz Earned!
            </div>
            <button
              className="absolute -top-4 -right-4 rounded-full p-1.5 transition-colors"
              style={{ background: "rgba(255,255,255,0.1)" }}
              onClick={() => setShowCelebration(false)}
            >
              <X className="w-5 h-5 text-white/70" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Empty state helper ────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, label, accent, glow }: {
  icon: typeof Trophy; label: string; accent: string; glow: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: `${accent}15`, boxShadow: `0 0 20px ${glow}` }}
      >
        <Icon className="w-8 h-8" style={{ color: accent }} />
      </div>
      <p className="text-muted-foreground text-sm max-w-xs">{label}</p>
    </div>
  );
}
