import { useState, useCallback } from "react";
import { TraitMedia } from "@/components/TraitMedia";
import { useWallet } from "@/contexts/WalletContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Repeat2,
  Package,
  Plus,
  X,
  CheckCircle2,
  Loader2,
  ArrowLeftRight,
  Search,
  Clock,
  Wallet,
  Sparkles,
} from "lucide-react";

const BANGERS = { fontFamily: "'Bangers', Impact, sans-serif", letterSpacing: "0.08em" };

// ── Types ────────────────────────────────────────────────────────────────────

interface LockerItemMini {
  id: number;
  traitId: number;
  walletAddress: string;
  equippedToTokenId: number | null;
  trait: {
    id: number;
    name: string;
    category: string;
    imageUrl: string | null;
    priceEth: string;
  };
}

interface SwapListingItem {
  id: number;
  listingId: number;
  lockerItemId: number;
  traitId: number;
  traitName: string;
  traitCategory: string;
  traitImageUrl: string | null;
}

interface SwapListing {
  id: number;
  posterWallet: string;
  lookingFor: string;
  status: "open" | "accepted" | "cancelled";
  acceptedByWallet: string | null;
  createdAt: string;
  offeredItems: SwapListingItem[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function shortenWallet(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ── Trait card for selection ──────────────────────────────────────────────────

function TraitSelectCard({
  item,
  selected,
  onToggle,
  disabled,
}: {
  item: LockerItemMini;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`relative text-left w-full border rounded-lg overflow-hidden transition-all ${
        selected
          ? "border-primary bg-primary/10 shadow-[0_0_12px_rgba(124,58,237,0.3)]"
          : "border-border/50 hover:border-primary/50 bg-card"
      } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
    >
      {selected && (
        <div className="absolute top-1.5 right-1.5 z-10 bg-primary rounded-full p-0.5">
          <CheckCircle2 className="w-3 h-3 text-white" />
        </div>
      )}
      <div className="aspect-square w-full bg-secondary/30 overflow-hidden">
        {item.trait.imageUrl ? (
          <TraitMedia
            url={item.trait.imageUrl}
            mediaType={(item.trait as Record<string,unknown>).mediaType as string}
            alt={item.trait.name}
            className="w-full h-full"
            showBadge
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-8 h-8 text-muted-foreground/30" />
          </div>
        )}
      </div>
      <div className="p-2">
        <div className="text-xs font-semibold text-foreground truncate">{item.trait.name}</div>
        <div className="text-[10px] text-muted-foreground">{item.trait.category}</div>
        <div className="text-[10px] text-primary font-mono mt-0.5">{parseFloat(item.trait.priceEth).toFixed(4)} Ξ</div>
        {item.equippedToTokenId !== null && (
          <div className="text-[10px] text-yellow-400/80 mt-0.5">Equipped #{item.equippedToTokenId}</div>
        )}
      </div>
    </button>
  );
}

// ── Swap listing card ─────────────────────────────────────────────────────────

function SwapCard({
  listing,
  myWallet,
  myLockerItems,
  onCancel,
  onAccept,
}: {
  listing: SwapListing;
  myWallet: string | null;
  myLockerItems: LockerItemMini[];
  onCancel: (id: number) => void;
  onAccept: (listing: SwapListing) => void;
}) {
  const isOwn = myWallet?.toLowerCase() === listing.posterWallet.toLowerCase();

  return (
    <Card className="bg-card border-border/50 hover:border-primary/40 transition-colors flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Wallet className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-mono text-muted-foreground truncate">
                {isOwn ? <span className="text-primary">You</span> : shortenWallet(listing.posterWallet)}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 mt-0.5">
                <Clock className="w-2.5 h-2.5" />
                {timeAgo(listing.createdAt)}
              </div>
            </div>
          </div>
          <Badge
            className={`text-[10px] px-1.5 py-0 flex-shrink-0 ${
              listing.status === "open"
                ? "bg-green-400/15 text-green-400 border-green-400/30"
                : listing.status === "accepted"
                  ? "bg-blue-400/15 text-blue-400 border-blue-400/30"
                  : "bg-secondary text-muted-foreground border-border"
            }`}
          >
            {listing.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4">
        {/* Offered traits */}
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-2 font-semibold">
            Offering
          </div>
          <div className="flex flex-wrap gap-1.5">
            {listing.offeredItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-1.5 bg-secondary/50 border border-border/40 rounded px-2 py-1"
              >
                {item.traitImageUrl ? (
                  <img
                    src={item.traitImageUrl}
                    alt={item.traitName}
                    className="w-5 h-5 rounded object-cover flex-shrink-0"
                  />
                ) : (
                  <Package className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                )}
                <div>
                  <div className="text-[11px] font-medium text-foreground leading-none">{item.traitName}</div>
                  <div className="text-[10px] text-muted-foreground leading-none mt-0.5">{item.traitCategory}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Looking for */}
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1.5 font-semibold flex items-center gap-1">
            <Search className="w-2.5 h-2.5" />
            Looking For
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed bg-secondary/20 border border-border/30 rounded p-2.5 italic">
            "{listing.lookingFor}"
          </p>
        </div>

        {/* Actions */}
        {listing.status === "open" && (
          <div className="mt-auto pt-2">
            {isOwn ? (
              <Button
                size="sm"
                variant="ghost"
                className="w-full text-destructive hover:bg-destructive/10 border border-destructive/30"
                onClick={() => onCancel(listing.id)}
              >
                <X className="w-3.5 h-3.5 mr-1.5" />
                Cancel Listing
              </Button>
            ) : myWallet ? (
              <Button
                size="sm"
                className="w-full bg-primary hover:bg-primary/90 text-white gap-2"
                onClick={() => onAccept(listing)}
                disabled={myLockerItems.filter(i => i.equippedToTokenId === null).length === 0}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                Propose Trade
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground text-center">Connect wallet to trade</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Create Listing Modal ──────────────────────────────────────────────────────

function CreateListingModal({
  open,
  onClose,
  myLockerItems,
  walletAddress,
}: {
  open: boolean;
  onClose: () => void;
  myLockerItems: LockerItemMini[];
  walletAddress: string;
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [lookingFor, setLookingFor] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const availableItems = myLockerItems.filter(i => i.equippedToTokenId === null);

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/swap/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posterWallet: walletAddress,
          lookingFor,
          lockerItemIds: selectedIds,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to create listing");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["swap-listings"] });
      queryClient.invalidateQueries({ queryKey: ["swap-my-listings"] });
      toast({ title: "Swap listing posted!" });
      setSelectedIds([]);
      setLookingFor("");
      onClose();
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  function toggle(id: number) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={BANGERS} className="text-2xl text-primary">Post a Swap</DialogTitle>
          <DialogDescription>
            Select traits from your locker to offer, then describe what you're looking for.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Trait selector */}
          <div>
            <div className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              Choose traits to offer
              {selectedIds.length > 0 && (
                <Badge className="bg-primary/20 text-primary border-primary/30 ml-auto">
                  {selectedIds.length} selected
                </Badge>
              )}
            </div>
            {availableItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border/50 rounded-lg">
                No available traits in your locker. Purchase some first!
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-52 overflow-y-auto pr-1">
                {availableItems.map(item => (
                  <TraitSelectCard
                    key={item.id}
                    item={item}
                    selected={selectedIds.includes(item.id)}
                    onToggle={() => toggle(item.id)}
                  />
                ))}
              </div>
            )}
          </div>

          <Separator className="border-border/40" />

          {/* What you want */}
          <div>
            <label className="text-sm font-semibold flex items-center gap-2 mb-2">
              <Search className="w-4 h-4 text-accent" />
              What are you looking for?
            </label>
            <Textarea
              value={lookingFor}
              onChange={e => setLookingFor(e.target.value)}
              placeholder="e.g. Looking for a rare Background trait, any Legendary Eyes, or a Headgear from the Cosmic drop…"
              className="bg-secondary/40 border-border/60 min-h-[80px] resize-none text-sm"
              maxLength={300}
            />
            <div className="text-right text-[10px] text-muted-foreground mt-1">{lookingFor.length}/300</div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-primary hover:bg-primary/90 text-white gap-2"
              disabled={selectedIds.length === 0 || !lookingFor.trim() || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Post Swap
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Accept Trade Modal ────────────────────────────────────────────────────────

function AcceptTradeModal({
  listing,
  onClose,
  myLockerItems,
  walletAddress,
}: {
  listing: SwapListing | null;
  onClose: () => void;
  myLockerItems: LockerItemMini[];
  walletAddress: string;
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const availableItems = myLockerItems.filter(i => i.equippedToTokenId === null);

  const accept = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/swap/listings/${listing!.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, lockerItemIds: selectedIds }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Trade failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["swap-listings"] });
      queryClient.invalidateQueries({ queryKey: ["swap-my-listings"] });
      queryClient.invalidateQueries({ queryKey: ["locker", walletAddress] });
      toast({ title: "Trade complete! Traits have been swapped." });
      setSelectedIds([]);
      onClose();
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  function toggle(id: number) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  if (!listing) return null;

  return (
    <Dialog open={!!listing} onOpenChange={v => { if (!v) { setSelectedIds([]); onClose(); } }}>
      <DialogContent className="max-w-2xl bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={BANGERS} className="text-2xl text-primary">Propose a Trade</DialogTitle>
          <DialogDescription>
            Select traits from your locker to offer in exchange for what {shortenWallet(listing.posterWallet)} is offering.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* What they're offering */}
          <div className="p-4 bg-secondary/30 border border-border/40 rounded-lg">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-2 font-semibold">
              They're offering
            </div>
            <div className="flex flex-wrap gap-2">
              {listing.offeredItems.map(item => (
                <div key={item.id} className="flex items-center gap-2 bg-card border border-border/50 rounded px-2 py-1.5">
                  {item.traitImageUrl ? (
                    <img src={item.traitImageUrl} alt={item.traitName} className="w-6 h-6 rounded object-cover" />
                  ) : (
                    <Package className="w-5 h-5 text-muted-foreground/40" />
                  )}
                  <div>
                    <div className="text-xs font-semibold">{item.traitName}</div>
                    <div className="text-[10px] text-muted-foreground">{item.traitCategory}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2.5 text-xs text-muted-foreground italic bg-secondary/30 rounded p-2">
              "{listing.lookingFor}"
            </div>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground/60">
            <div className="flex-1 h-px bg-border/40" />
            <ArrowLeftRight className="w-4 h-4" />
            <div className="flex-1 h-px bg-border/40" />
          </div>

          {/* What you'll give */}
          <div>
            <div className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-accent" />
              Choose traits to offer in return
              {selectedIds.length > 0 && (
                <Badge className="bg-accent/20 text-accent border-accent/30 ml-auto">
                  {selectedIds.length} selected
                </Badge>
              )}
            </div>
            {availableItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border/50 rounded-lg">
                No available traits in your locker.
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-52 overflow-y-auto pr-1">
                {availableItems.map(item => (
                  <TraitSelectCard
                    key={item.id}
                    item={item}
                    selected={selectedIds.includes(item.id)}
                    onToggle={() => toggle(item.id)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => { setSelectedIds([]); onClose(); }}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-primary hover:bg-primary/90 text-white gap-2"
              disabled={selectedIds.length === 0 || accept.isPending}
              onClick={() => accept.mutate()}
            >
              {accept.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
              Confirm Trade
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Swap Page ────────────────────────────────────────────────────────────

export function Swap() {
  const [tab, setTab] = useState<"browse" | "mine">("browse");
  const [createOpen, setCreateOpen] = useState(false);
  const [acceptTarget, setAcceptTarget] = useState<SwapListing | null>(null);
  const { walletAddress, isConnected, connect } = useWallet();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allListings, isLoading: loadingAll } = useQuery<{ listings: SwapListing[]; total: number }>({
    queryKey: ["swap-listings"],
    queryFn: async () => {
      const res = await fetch("/api/swap/listings?status=open");
      if (!res.ok) throw new Error("Failed to load listings");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: myListings, isLoading: loadingMine } = useQuery<{ listings: SwapListing[]; total: number }>({
    queryKey: ["swap-my-listings", walletAddress],
    enabled: !!walletAddress,
    queryFn: async () => {
      const res = await fetch(`/api/swap/listings?wallet=${walletAddress}&status=all`);
      if (!res.ok) throw new Error("Failed to load your listings");
      return res.json();
    },
  });

  const { data: lockerData } = useQuery({
    queryKey: ["locker", walletAddress],
    enabled: !!walletAddress,
    queryFn: async () => {
      const res = await fetch(`/api/locker/${walletAddress}`);
      if (!res.ok) throw new Error("Failed to load locker");
      return res.json();
    },
  });

  const myLockerItems: LockerItemMini[] = lockerData?.items ?? [];

  const cancelListing = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/swap/listings/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to cancel");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["swap-listings"] });
      queryClient.invalidateQueries({ queryKey: ["swap-my-listings"] });
      toast({ title: "Listing cancelled" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const openListings = (allListings?.listings ?? []).filter(
    l => !walletAddress || l.posterWallet.toLowerCase() !== walletAddress.toLowerCase(),
  );
  const myOpenListings = (myListings?.listings ?? []).filter(l => l.status === "open");
  const myPastListings = (myListings?.listings ?? []).filter(l => l.status !== "open");

  return (
    <div className="space-y-8">
      {/* ── Hero ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1
            className="text-4xl sm:text-5xl"
            style={{ ...BANGERS, color: "hsl(var(--primary))", textShadow: "3px 3px 0 rgba(0,0,0,0.8)" }}
          >
            Trait<span style={{ color: "hsl(var(--accent))" }}>Swap</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Trade traits directly with other collectors — post what you're offering and describe what you want.
          </p>
        </div>

        {isConnected ? (
          <Button
            className="bg-primary hover:bg-primary/90 text-white gap-2 flex-shrink-0"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="w-4 h-4" />
            Post a Swap
          </Button>
        ) : (
          <Button onClick={connect} className="bg-primary text-white gap-2 flex-shrink-0">
            <Wallet className="w-4 h-4" />
            Connect Wallet
          </Button>
        )}
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-1 bg-secondary/50 border border-border/50 rounded-lg p-1 w-fit">
        {[
          { key: "browse", label: "Browse Swaps", icon: Repeat2, count: openListings.length },
          { key: "mine", label: "My Listings", icon: Package, count: myOpenListings.length },
        ].map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setTab(key as typeof tab)}
            className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-all ${
              tab === key
                ? "bg-primary text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {count > 0 && (
              <span className={`text-[10px] rounded-full px-1.5 py-0 min-w-[18px] text-center ${
                tab === key ? "bg-white/20 text-white" : "bg-secondary text-muted-foreground"
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Browse tab ── */}
      {tab === "browse" && (
        <div>
          {loadingAll ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : openListings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground/50">
              <Repeat2 className="w-16 h-16" />
              <div className="text-center">
                <p className="text-base font-semibold text-foreground/60">No open swaps yet</p>
                <p className="text-sm mt-1">Be the first to post a trait swap listing!</p>
              </div>
              {isConnected && (
                <Button
                  variant="outline"
                  className="border-primary/50 text-primary hover:bg-primary/10 gap-2"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="w-4 h-4" />
                  Post a Swap
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {openListings.map(listing => (
                <SwapCard
                  key={listing.id}
                  listing={listing}
                  myWallet={walletAddress}
                  myLockerItems={myLockerItems}
                  onCancel={id => cancelListing.mutate(id)}
                  onAccept={setAcceptTarget}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── My listings tab ── */}
      {tab === "mine" && (
        <div className="space-y-6">
          {!isConnected ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground/50">
              <Wallet className="w-12 h-12" />
              <p className="text-sm">Connect your wallet to see your listings.</p>
              <Button onClick={connect} className="bg-primary text-white">Connect Wallet</Button>
            </div>
          ) : loadingMine ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {myOpenListings.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                    Active Listings
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {myOpenListings.map(listing => (
                      <SwapCard
                        key={listing.id}
                        listing={listing}
                        myWallet={walletAddress}
                        myLockerItems={myLockerItems}
                        onCancel={id => cancelListing.mutate(id)}
                        onAccept={setAcceptTarget}
                      />
                    ))}
                  </div>
                </div>
              )}

              {myPastListings.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                    Past Listings
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
                    {myPastListings.map(listing => (
                      <SwapCard
                        key={listing.id}
                        listing={listing}
                        myWallet={walletAddress}
                        myLockerItems={myLockerItems}
                        onCancel={() => {}}
                        onAccept={() => {}}
                      />
                    ))}
                  </div>
                </div>
              )}

              {myOpenListings.length === 0 && myPastListings.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground/50">
                  <Package className="w-14 h-14" />
                  <div className="text-center">
                    <p className="text-base font-semibold text-foreground/60">No listings yet</p>
                    <p className="text-sm mt-1">Post your first swap offer above.</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {isConnected && walletAddress && (
        <>
          <CreateListingModal
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            myLockerItems={myLockerItems}
            walletAddress={walletAddress}
          />
          <AcceptTradeModal
            listing={acceptTarget}
            onClose={() => setAcceptTarget(null)}
            myLockerItems={myLockerItems}
            walletAddress={walletAddress}
          />
        </>
      )}
    </div>
  );
}
