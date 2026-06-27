import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCollection } from "@/contexts/CollectionContext";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy, Star, Zap, Flame, ShieldCheck, Lock, CheckCircle2, Gift,
  TrendingUp, Award, Crown, Sparkles, Clock,
} from "lucide-react";

const BANGERS = { fontFamily: "'Bungee', Impact, sans-serif", letterSpacing: "0.08em" };

// ── Types ─────────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  walletAddress: string;
  totalPoints: number;
  updatedAt: string;
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
  pendingPoints: number;
  history: PointHistory[];
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
  const { theme } = useCollection();
  const { accent, accent2, accentHsl, glow, glow2, gradient, gradient2 } = theme;
  const { walletAddress, isConnected } = useWallet();
  const { toast } = useToast();
  const qc = useQueryClient();

  // Leaderboard
  const { data: lbData } = useQuery({
    queryKey: ["bounties-leaderboard"],
    queryFn: async () => {
      const r = await fetch("/api/bounties/leaderboard");
      return r.json() as Promise<{ leaderboard: LeaderboardEntry[] }>;
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
      const r = await fetch("/api/bounties/sandbox-complete", { method: "POST" });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error ?? "Failed");
      }
      return r.json();
    },
    onSuccess: (d) => {
      toast({ title: `+${d.pointsAwarded} point earned!`, description: `${d.dailyCompletions}/${d.dailyLimit} daily bounties complete.` });
      qc.invalidateQueries({ queryKey: ["bounties-me"] });
      qc.invalidateQueries({ queryKey: ["bounties-leaderboard"] });
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
      toast({ title: `🎉 ${d.pointsClaimed} points claimed!`, description: "Points have been added to your balance." });
      qc.invalidateQueries({ queryKey: ["bounties-me"] });
      qc.invalidateQueries({ queryKey: ["bounties-leaderboard"] });
    },
    onError: (e: Error) => {
      toast({ title: "Claim failed", description: e.message, variant: "destructive" });
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
      toast({ title: `${d.traitName} redeemed!`, description: `Spent ${d.pointsSpent} points. ${d.remainingPoints} remaining.` });
      qc.invalidateQueries({ queryKey: ["bounties-me"] });
      qc.invalidateQueries({ queryKey: ["bounty-traits"] });
    },
    onError: (e: Error) => {
      toast({ title: "Redemption failed", description: e.message, variant: "destructive" });
    },
  });

  const leaderboard = lbData?.leaderboard ?? [];
  const traits = traitsData?.traits ?? [];
  const myRank = meData?.rank;
  const myPoints = meData?.totalPoints ?? 0;
  const pendingPoints = meData?.pendingPoints ?? 0;
  const dailyLeft = meData ? meData.dailyLimit - meData.dailyCompletions : 5;

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
              Bounties & Rewards
            </h1>
            <p className="text-muted-foreground text-sm mt-1 max-w-xl">
              Earn points by purchasing traits and saving on-chain. Complete daily sandbox bounties.
              Spend points on exclusive rewards only available here.
            </p>
          </div>
          {isConnected && meData && (
            <div className="text-right flex-shrink-0">
              <div className="text-3xl font-bold" style={{ ...BANGERS, color: accent }}>
                {myPoints.toLocaleString()}
              </div>
              <div className="text-[11px] text-muted-foreground">pts</div>
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
            { icon: Zap, label: "Trait Purchase", value: "+25 pts", desc: "per unit bought" },
            { icon: ShieldCheck, label: "Save On Chain", value: "+25 pts", desc: "per confirmation" },
            { icon: Flame, label: "Sandbox Bounty", value: "+1 pt", desc: "up to 5/day" },
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
      {traits.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-widest" style={{ ...BANGERS, color: `hsl(${accentHsl} / 0.7)`, letterSpacing: "0.12em" }}>
              Exclusive Rewards
            </h2>
            <span className="text-[11px] text-muted-foreground">Redeem with points in the Rewards Store</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
            {traits.map((trait) => {
              const canAfford = myPoints >= trait.pointCost;
              const soldOut = trait.remainingSupply !== -1 && trait.remainingSupply <= 0;
              const atLimit = trait.walletPurchaseCount >= 2;
              return (
                <div
                  key={trait.id}
                  className="flex-shrink-0 rounded-xl overflow-hidden w-36"
                  style={{
                    background: "hsl(272 20% 6%)",
                    border: `1px solid hsl(${accentHsl} / ${canAfford && !soldOut && !atLimit ? "0.35" : "0.12"})`,
                    boxShadow: canAfford && !soldOut && !atLimit ? `0 0 12px ${glow}` : "none",
                    opacity: soldOut || atLimit ? 0.5 : 1,
                  }}
                >
                  <div className="w-full aspect-square bg-secondary/20 relative overflow-hidden">
                    {trait.imageUrl ? (
                      <img src={trait.imageUrl} alt={trait.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Gift className="w-8 h-8 opacity-20" />
                      </div>
                    )}
                    {atLimit && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5" style={{ color: accent }} />
                      </div>
                    )}
                    {soldOut && !atLimit && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-red-400">SOLD OUT</span>
                      </div>
                    )}
                  </div>
                  <div className="p-2.5 space-y-1">
                    <div className="text-xs font-semibold truncate">{trait.name}</div>
                    <div
                      className="text-xs font-bold flex items-center gap-1"
                      style={{ color: canAfford && !soldOut && !atLimit ? accent : "hsl(var(--muted-foreground))" }}
                    >
                      <Star className="w-3 h-3 flex-shrink-0" />
                      {trait.pointCost.toLocaleString()} pts
                    </div>
                    {trait.totalSupply !== -1 && (
                      <div className="text-[10px] text-muted-foreground">{trait.remainingSupply}/{trait.totalSupply} left</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
            <Star className="w-4 h-4" /> My Points
          </TabsTrigger>
        </TabsList>

        {/* ── Leaderboard ── */}
        <TabsContent value="leaderboard" className="mt-6 space-y-2">
          {leaderboard.length === 0 ? (
            <EmptyState icon={Trophy} label="No points earned yet — be the first!" accent={accent} glow={glow} />
          ) : (
            leaderboard.map((entry, i) => {
              const isMe = walletAddress?.toLowerCase() === entry.walletAddress.toLowerCase();
              const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
              return (
                <div
                  key={entry.walletAddress}
                  className="flex items-center gap-4 rounded-xl px-4 py-3 transition-all"
                  style={{
                    background: isMe
                      ? `linear-gradient(135deg, hsl(${accentHsl} / 0.15), hsl(${accentHsl} / 0.05))`
                      : "hsl(272 20% 6%)",
                    border: `1px solid ${isMe ? `hsl(${accentHsl} / 0.4)` : "hsl(272 20% 12%)"}`,
                    boxShadow: isMe ? `0 0 12px ${glow}` : "none",
                  }}
                >
                  <div className="w-8 text-center text-sm font-mono font-bold text-muted-foreground">
                    {medal ?? `#${i + 1}`}
                  </div>
                  <div className="flex-1 font-mono text-sm" style={{ color: isMe ? accent : "hsl(var(--foreground))" }}>
                    {truncate(entry.walletAddress)}
                    {isMe && <span className="ml-2 text-[10px] font-bold" style={{ color: accent }}>(you)</span>}
                  </div>
                  <div className="font-bold text-sm" style={{ ...BANGERS, color: i < 3 ? accent : "hsl(var(--foreground))" }}>
                    {entry.totalPoints.toLocaleString()} pts
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>

        {/* ── Rewards Store ── */}
        <TabsContent value="rewards" className="mt-6">
          {traits.length === 0 ? (
            <EmptyState icon={Sparkles} label="No rewards available yet — check back soon!" accent={accent} glow={glow} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {traits.map((trait) => {
                const canAfford = myPoints >= trait.pointCost;
                const atLimit = trait.walletPurchaseCount >= 2;
                const soldOut = trait.remainingSupply !== -1 && trait.remainingSupply <= 0;
                const locked = !isConnected || !canAfford || atLimit || soldOut;

                return (
                  <div
                    key={trait.id}
                    className="rounded-2xl overflow-hidden border"
                    style={{
                      background: "hsl(272 20% 6%)",
                      border: `1px solid hsl(${accentHsl} / 0.2)`,
                    }}
                  >
                    {/* Image */}
                    <div className="aspect-square bg-secondary/20 relative overflow-hidden">
                      {trait.imageUrl ? (
                        <img src={trait.imageUrl} alt={trait.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Gift className="w-12 h-12 opacity-20" />
                        </div>
                      )}
                      {atLimit && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <div className="text-center">
                            <CheckCircle2 className="w-8 h-8 mx-auto mb-1" style={{ color: accent }} />
                            <div className="text-xs font-bold" style={{ color: accent }}>Max Owned</div>
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
                        <h3 className="font-bold text-sm text-foreground">{trait.name}</h3>
                        {trait.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{trait.description}</p>
                        )}
                      </div>

                      {/* Supply + wallet limit */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className="text-[10px]"
                          style={{ color: accent, borderColor: `${accent}40` }}
                        >
                          <Star className="w-2.5 h-2.5 mr-1" />
                          {trait.pointCost.toLocaleString()} pts
                        </Badge>
                        {trait.totalSupply !== -1 && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/40">
                            {trait.remainingSupply}/{trait.totalSupply} left
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/40">
                          <Lock className="w-2.5 h-2.5 mr-1" />
                          {trait.walletPurchaseCount}/2 owned
                        </Badge>
                      </div>

                      <Button
                        className="w-full text-xs font-bold"
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
                          !canAfford ? `Need ${trait.pointCost - myPoints} more pts` :
                          `Redeem for ${trait.pointCost} pts`}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── My Points ── */}
        <TabsContent value="my-points" className="mt-6 space-y-5">
          {!isConnected ? (
            <EmptyState icon={Award} label="Connect your wallet to view your points & history." accent={accent} glow={glow} />
          ) : (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { icon: Star, label: "Total Points", value: myPoints.toLocaleString() },
                  { icon: Crown, label: "Rank", value: myRank ? `#${myRank}` : "—" },
                  { icon: Clock, label: "Daily Bounties Left", value: `${dailyLeft}/5` },
                ].map(({ icon: Icon, label, value }) => (
                  <div
                    key={label}
                    className="rounded-xl p-4 text-center"
                    style={{ background: "hsl(272 20% 6%)", border: `1px solid hsl(${accentHsl} / 0.15)` }}
                  >
                    <Icon className="w-5 h-5 mx-auto mb-2" style={{ color: accent }} />
                    <div className="text-2xl font-bold" style={{ ...BANGERS, color: accent }}>{value}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">{label}</div>
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
                    <div className="font-bold text-sm text-amber-300">Points Ready to Claim!</div>
                    <div className="text-xs text-amber-200/70 mt-0.5">
                      An admin airdropped points to your wallet. Claim them to add to your balance.
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={claimMutation.isPending}
                    onClick={() => claimMutation.mutate()}
                    style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "black", boxShadow: "0 0 16px #f59e0b80", fontWeight: 700 }}
                  >
                    {claimMutation.isPending ? "Claiming…" : `Claim ${pendingPoints.toLocaleString()} pts`}
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
                  <div className="font-bold text-sm">Sandbox Bounty</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Complete a sandbox session to earn 1 point. Max 5/day.
                  </div>
                  <div className="text-xs mt-1" style={{ color: accent }}>
                    {meData?.dailyCompletions ?? 0}/{meData?.dailyLimit ?? 5} completed today
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
                            {isPositive ? "+" : ""}{h.points} pts
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
