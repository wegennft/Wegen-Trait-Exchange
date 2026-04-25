import { useState, useRef, useEffect, useMemo } from "react";
import {
  useGetAdminStats,
  useListTraits,
  useCreateTrait,
  useUpdateTrait,
  useDeleteTrait,
  getListTraitsQueryKey,
  getGetAdminStatsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { TraitMedia } from "@/components/TraitMedia";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Package,
  DollarSign,
  Activity,
  Loader2,
  Plus,
  Edit,
  Trash2,
  Wallet,
  X,
  AlertCircle,
  CheckCircle2,
  Upload,
  ImageIcon,
  Paintbrush,
  RotateCcw,
  Percent,
  ShoppingCart,
  Tag,
  Save,
  ArrowDownToLine,
  ArrowUpFromLine,
  Repeat2,
  ExternalLink,
  Clock,
  Filter,
  Music,
  Layers,
  GripVertical,
  RotateCw,
  ChevronUp,
  ChevronDown,
  Search,
  Gem,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Trait } from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { useSiteSettings, DEFAULT_COLORS } from "@/contexts/SiteSettingsContext";

const CATEGORIES = ["Background", "Body", "Clothes", "Eyes", "Headgear", "Mouth"];
const RARITIES = ["common", "uncommon", "rare", "legendary"] as const;
type Rarity = (typeof RARITIES)[number];

const payoutSplitSchema = z.object({
  walletAddress: z.string().min(1, "Wallet address required"),
  percentage: z.coerce
    .number()
    .min(0.01, "Must be > 0")
    .max(100, "Max 100"),
});

const MEDIA_TYPES = ["image", "gif", "video", "audio"] as const;
type MediaType = typeof MEDIA_TYPES[number];

const traitSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  theme: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  mediaType: z.enum(MEDIA_TYPES).default("image"),
  priceEth: z.string().regex(/^\d+(\.\d+)?$/, "Must be a valid number e.g. 0.05"),
  totalSupply: z.coerce.number().min(1, "Supply must be at least 1"),
  rarity: z.enum(RARITIES).default("common"),
  isActive: z.boolean().default(true),
  payoutSplits: z.array(payoutSplitSchema).default([]),
}).superRefine((data, ctx) => {
  if (data.payoutSplits.length > 0) {
    const total = data.payoutSplits.reduce((sum, s) => sum + Number(s.percentage), 0);
    if (Math.abs(total - 100) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Percentages must sum to 100% (currently ${total.toFixed(2)}%)`,
        path: ["payoutSplits"],
      });
    }
  }
});

type TraitFormValues = z.infer<typeof traitSchema>;

// ── Layer Order Settings ──────────────────────────────────────────────────────

const DEFAULT_LAYERS = ["Headgear", "Eyes", "Mouth", "Clothes", "Body", "Background"];

const LAYER_ICONS: Record<string, string> = {
  Background: "🖼️",
  Body: "🧍",
  Clothes: "👕",
  Mouth: "👄",
  Eyes: "👁️",
  Headgear: "🎩",
};

function LayerOrderSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [layers, setLayers] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const { isLoading, data: layersData } = useQuery({
    queryKey: ["admin-layers"],
    queryFn: async () => {
      const res = await fetch("/api/admin/layers");
      if (!res.ok) throw new Error("Failed to load layers");
      return res.json() as Promise<{ layerOrder: string[] }>;
    },
  });

  useEffect(() => {
    if (layersData?.layerOrder) {
      setLayers(layersData.layerOrder);
      setDirty(false);
    }
  }, [layersData]);

  const saveLayers = useMutation({
    mutationFn: async (newOrder: string[]) => {
      const res = await fetch("/api/admin/layers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layerOrder: newOrder }),
      });
      if (!res.ok) throw new Error("Failed to save layers");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-layers"] });
      setDirty(false);
      toast({ title: "Layer order saved!" });
    },
    onError: () => toast({ title: "Failed to save layer order", variant: "destructive" }),
  });

  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragEnter(index: number) {
    if (dragIndex === null || dragIndex === index) return;
    const next = [...layers];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(index, 0, moved);
    setLayers(next);
    setDragIndex(index);
    setDirty(true);
  }

  function handleDragEnd() {
    setDragIndex(null);
  }

  function moveLayer(index: number, direction: "up" | "down") {
    const next = [...layers];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setLayers(next);
    setDirty(true);
  }

  function resetToDefault() {
    setLayers([...DEFAULT_LAYERS]);
    setDirty(true);
  }

  const totalLayers = layers.length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold mb-1">NFT Layer Order</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Define the stacking order of trait layers when building NFT previews.
            Drag to reorder — <span className="text-primary font-semibold">top items render in front</span>.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-border/50"
            onClick={resetToDefault}
          >
            <RotateCw className="w-3.5 h-3.5" />
            Reset
          </Button>
          <Button
            size="sm"
            className="gap-1.5 bg-primary text-white hover:bg-primary/90"
            disabled={!dirty || saveLayers.isPending}
            onClick={() => saveLayers.mutate(layers)}
          >
            {saveLayers.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Order
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-2 max-w-lg">
          {/* Top label */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground/60 uppercase tracking-widest font-semibold px-3 pb-1">
            <span className="flex-1">← Renders in Front</span>
            <span className="text-[10px]">Layer</span>
          </div>

          {layers.map((layer, index) => {
            const isFront = index === 0;
            const isBack = index === totalLayers - 1;
            const zPercent = 1 - index / Math.max(totalLayers - 1, 1);
            // Gradient: gold at front, dark at back
            const r = Math.round(250 * zPercent + 60 * (1 - zPercent));
            const g = Math.round(180 * zPercent + 60 * (1 - zPercent));
            const b = Math.round(20 * zPercent + 80 * (1 - zPercent));
            const accentColor = `rgb(${r},${g},${b})`;

            return (
              <div
                key={layer}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragEnter={() => handleDragEnter(index)}
                onDragEnd={handleDragEnd}
                onDragOver={e => e.preventDefault()}
                className={`group flex items-center gap-3 px-4 py-3 rounded-xl border cursor-grab active:cursor-grabbing transition-all select-none ${
                  dragIndex === index
                    ? "opacity-50 scale-95 border-primary/60 bg-primary/10"
                    : "border-border/50 bg-card hover:border-border hover:bg-secondary/40"
                }`}
              >
                {/* Grip */}
                <GripVertical className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground flex-shrink-0" />

                {/* Color bar */}
                <div
                  className="w-1 h-8 rounded-full flex-shrink-0"
                  style={{ backgroundColor: accentColor, boxShadow: `0 0 6px ${accentColor}60` }}
                />

                {/* Emoji + name */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xl leading-none">{LAYER_ICONS[layer] ?? "📦"}</span>
                  <div>
                    <div className="font-semibold text-sm text-foreground">{layer}</div>
                    <div className="text-[10px] text-muted-foreground/60">
                      {isFront ? "Renders in front" : isBack ? "Renders behind all" : `Layer ${totalLayers - index} of ${totalLayers}`}
                    </div>
                  </div>
                </div>

                {/* Z position badge */}
                <div
                  className="flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                  style={{ backgroundColor: `${accentColor}20`, color: accentColor, border: `1px solid ${accentColor}40` }}
                >
                  {isFront ? "Front" : isBack ? "Back" : `Z-${totalLayers - index}`}
                </div>

                {/* Arrow buttons */}
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => moveLayer(index, "up")}
                    disabled={index === 0}
                    className="p-0.5 rounded text-muted-foreground/40 hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    title="Move forward"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => moveLayer(index, "down")}
                    disabled={index === totalLayers - 1}
                    className="p-0.5 rounded text-muted-foreground/40 hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    title="Move backward"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Bottom label */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground/60 uppercase tracking-widest font-semibold px-3 pt-1">
            <span className="flex-1">← Renders Behind All</span>
          </div>
        </div>
      )}

      {dirty && (
        <div className="flex items-center gap-2 text-xs text-amber-400/80 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2 max-w-lg">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          Unsaved changes — click Save Order to apply.
        </div>
      )}
    </div>
  );
}

export function Admin() {
  const { data: stats, isLoading: isLoadingStats } = useGetAdminStats();
  const { data: traitsData, isLoading: isLoadingTraits } = useListTraits({ includeAll: true, limit: 9999 });
  const { data: rarityTiersData } = useQuery({
    queryKey: ["admin-rarity-tiers"],
    queryFn: async () => {
      const res = await fetch("/api/admin/rarities");
      if (!res.ok) return { tiers: [] };
      return res.json() as Promise<{ tiers: { id: number; name: string; rank: number; color: string | null }[] }>;
    },
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [editingTrait, setEditingTrait] = useState<Trait | null>(null);
  const [traitView, setTraitView] = useState<"all" | "in-store" | "vault">("all");
  const [traitCategory, setTraitCategory] = useState<string>("all");
  const [traitRarity, setTraitRarity] = useState<string>("all");
  const [traitSearch, setTraitSearch] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const createTrait = useCreateTrait({
    mutation: {
      onSuccess: () => {
        toast({ title: "Trait created successfully" });
        setIsCreateOpen(false);
        queryClient.invalidateQueries({ queryKey: ['/api/traits'] });
        queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
      },
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          "Failed to create trait";
        toast({ title: msg, variant: "destructive" });
      },
    },
  });

  const updateTrait = useUpdateTrait({
    mutation: {
      onSuccess: () => {
        toast({ title: "Trait updated successfully" });
        setEditingTrait(null);
        queryClient.invalidateQueries({ queryKey: ['/api/traits'] });
      },
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          "Failed to update trait";
        toast({ title: msg, variant: "destructive" });
      },
    },
  });

  const deleteTrait = useDeleteTrait({
    mutation: {
      onSuccess: () => {
        toast({ title: "Trait deleted" });
        queryClient.invalidateQueries({ queryKey: ['/api/traits'] });
        queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
      },
      onError: () => toast({ title: "Failed to delete trait", variant: "destructive" }),
    },
  });

  const handleCreate = (data: TraitFormValues) => {
    createTrait.mutate({ data });
  };

  const handleUpdate = (data: TraitFormValues) => {
    if (!editingTrait) return;
    updateTrait.mutate({
      traitId: editingTrait.id,
      data: {
        name: data.name,
        description: data.description,
        imageUrl: data.imageUrl,
        mediaType: data.mediaType,
        priceEth: data.priceEth,
        totalSupply: data.totalSupply,
        rarity: data.rarity,
        isActive: data.isActive,
        theme: data.theme || undefined,
        payoutSplits: data.payoutSplits,
      },
    });
  };

  useEffect(() => { setSelectedIds(new Set()); }, [traitView, traitCategory, traitRarity, traitSearch]);

  const filteredTraitsForDisplay = useMemo(() =>
    (traitsData?.traits ?? []).filter(trait =>
      (traitView === "all" ? true : traitView === "in-store" ? trait.isActive : !trait.isActive) &&
      (traitCategory === "all" ? true : trait.category === traitCategory) &&
      (traitRarity === "all" ? true : (trait.rarity as string) === traitRarity) &&
      (traitSearch.trim() === "" ? true : trait.name.toLowerCase().includes(traitSearch.trim().toLowerCase()))
    ),
    [traitsData, traitView, traitCategory, traitRarity, traitSearch]
  );
  const allFilteredSelected = filteredTraitsForDisplay.length > 0 && filteredTraitsForDisplay.every(t => selectedIds.has(t.id));
  const someFilteredSelected = !allFilteredSelected && filteredTraitsForDisplay.some(t => selectedIds.has(t.id));

  const handleBulkSetActive = async (active: boolean) => {
    if (selectedIds.size === 0) return;
    setBulkUpdating(true);
    try {
      await Promise.all([...selectedIds].map(id =>
        fetch(`/api/traits/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: active }),
        })
      ));
      await queryClient.invalidateQueries({ queryKey: ['/api/traits'] });
      setSelectedIds(new Set());
      toast({ title: `${selectedIds.size} trait${selectedIds.size !== 1 ? "s" : ""} ${active ? "enabled in store" : "moved to vault"}` });
    } catch {
      toast({ title: "Bulk update failed", variant: "destructive" });
    } finally {
      setBulkUpdating(false);
    }
  };

  const toggleSelectId = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight mb-1">Admin Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Manage traits, configure payout splits, and customize site appearance.
        </p>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="bg-secondary border border-border/50 p-1 h-auto">
          <TabsTrigger value="dashboard" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white rounded-sm px-4 py-2">
            <BarChart3 className="w-4 h-4" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white rounded-sm px-4 py-2">
            <Paintbrush className="w-4 h-4" /> Appearance
          </TabsTrigger>
          <TabsTrigger value="fees" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white rounded-sm px-4 py-2">
            <Percent className="w-4 h-4" /> Fees
          </TabsTrigger>
          <TabsTrigger value="transactions" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white rounded-sm px-4 py-2">
            <Activity className="w-4 h-4" /> Transactions
          </TabsTrigger>
          <TabsTrigger value="layers" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white rounded-sm px-4 py-2">
            <Layers className="w-4 h-4" /> Layers
          </TabsTrigger>
          <TabsTrigger value="rarities" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white rounded-sm px-4 py-2">
            <Gem className="w-4 h-4" /> Rarity Tiers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-8 border border-primary/40 rounded-lg p-6 shadow-[0_0_20px_rgba(124,58,237,0.08)]">

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
            <DollarSign className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingStats ? "..." : `${stats?.totalRevenue ?? "0"} ETH`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              From {stats?.totalSales} sales
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Traits
            </CardTitle>
            <Package className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingStats ? "..." : stats?.activeTraits}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Out of {stats?.totalTraits} total
            </p>
          </CardContent>
        </Card>


        <Card className="bg-card border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Top Seller
            </CardTitle>
            <BarChart3 className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold truncate">
              {isLoadingStats ? "..." : stats?.topSellingTraits[0]?.name || "N/A"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.topSellingTraits[0]?.salesCount || 0} sales
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-12 mb-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold tracking-tight">Trait Management</h2>
            {/* Primary tabs: All / In Store / Vault */}
            <div className="flex bg-secondary border border-border/50 rounded-md p-1 gap-1">
              {(["all", "in-store", "vault"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => { setTraitView(v); setTraitCategory("all"); }}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${traitView === v ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {v === "all"
                    ? `All (${traitsData?.traits?.length ?? 0})`
                    : v === "in-store"
                    ? `In Store (${traitsData?.traits?.filter(t => t.isActive).length ?? 0})`
                    : `Vault (${traitsData?.traits?.filter(t => !t.isActive).length ?? 0})`}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
          {/* Search by name */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by name…"
              value={traitSearch}
              onChange={(e) => setTraitSearch(e.target.value)}
              className="pl-8 h-9 w-48 text-sm bg-secondary/40 border-border/50 focus:border-primary/60 focus:w-60 transition-all duration-200"
            />
            {traitSearch && (
              <button
                onClick={() => setTraitSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Batch upload */}
          <Dialog open={isBatchOpen} onOpenChange={setIsBatchOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-primary/50 hover:bg-primary/10 gap-2">
                <Upload className="w-4 h-4" />
                Batch Upload
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Batch Upload Traits</DialogTitle>
              </DialogHeader>
              <BatchTraitUploadDialog onClose={() => setIsBatchOpen(false)} />
            </DialogContent>
          </Dialog>

          {/* Single trait */}
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-white hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                New Trait
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Trait</DialogTitle>
              </DialogHeader>
              <TraitForm
                onSubmit={handleCreate}
                isSubmitting={createTrait.isPending}
              />
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Secondary tabs: category filter */}
        {(() => {
          const primaryFiltered = (traitsData?.traits ?? []).filter(t =>
            traitView === "all" ? true : traitView === "in-store" ? t.isActive : !t.isActive
          );
          const cats = ["all", ...CATEGORIES] as const;
          return (
            <div className="flex flex-wrap gap-1.5">
              {cats.map((cat) => {
                const count = cat === "all"
                  ? primaryFiltered.length
                  : primaryFiltered.filter(t => t.category === cat).length;
                const isActive = traitCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setTraitCategory(cat)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                      isActive
                        ? "bg-primary/20 border-primary/60 text-primary shadow-[0_0_8px_rgba(124,58,237,0.25)]"
                        : "bg-secondary/50 border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
                    }`}
                  >
                    {cat !== "all" && <span className="text-sm leading-none">{LAYER_ICONS[cat] ?? "📦"}</span>}
                    {cat === "all" ? "All Categories" : cat}
                    <span className={`ml-0.5 ${isActive ? "text-primary/80" : "text-muted-foreground/50"}`}>
                      ({count})
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })()}

        {/* Rarity filter */}
        {(() => {
          const viewAndCatFiltered = (traitsData?.traits ?? []).filter(t =>
            (traitView === "all" ? true : traitView === "in-store" ? t.isActive : !t.isActive) &&
            (traitCategory === "all" ? true : t.category === traitCategory)
          );
          const tiers = rarityTiersData?.tiers ?? [];
          return (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] text-muted-foreground/40 uppercase tracking-widest font-semibold flex items-center gap-1 mr-1">
                <Gem className="w-3 h-3" />
                Rarity
              </span>
              <button
                onClick={() => setTraitRarity("all")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  traitRarity === "all"
                    ? "bg-primary/20 border-primary/60 text-primary shadow-[0_0_8px_rgba(124,58,237,0.25)]"
                    : "bg-secondary/50 border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
                }`}
              >
                All
                <span className={`ml-0.5 ${traitRarity === "all" ? "text-primary/80" : "text-muted-foreground/50"}`}>
                  ({viewAndCatFiltered.length})
                </span>
              </button>
              {tiers.map((tier) => {
                const count = viewAndCatFiltered.filter(t => (t.rarity as string) === tier.name).length;
                const isActive = traitRarity === tier.name;
                return (
                  <button
                    key={tier.id}
                    onClick={() => setTraitRarity(tier.name)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all capitalize ${
                      isActive ? "shadow-[0_0_8px_rgba(124,58,237,0.2)]" : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                    }`}
                    style={isActive ? {
                      background: `${tier.color ?? "#888"}22`,
                      borderColor: `${tier.color ?? "#888"}80`,
                      color: tier.color ?? "#888",
                    } : {
                      borderColor: "hsl(var(--border) / 0.4)",
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: tier.color ?? "#888" }}
                    />
                    {tier.name}
                    <span className="ml-0.5 opacity-60">({count})</span>
                  </button>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Bulk action bar — visible whenever anything is selected */}
      {(selectedIds.size > 0 || someFilteredSelected || allFilteredSelected) && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-primary/40 bg-primary/10 shadow-[0_0_16px_rgba(124,58,237,0.15)]">
          <span className="text-sm font-semibold text-primary flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {selectedIds.size} of {filteredTraitsForDisplay.length} selected
          </span>
          {!allFilteredSelected && (
            <button
              onClick={() => setSelectedIds(new Set(filteredTraitsForDisplay.map(t => t.id)))}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              Select all {filteredTraitsForDisplay.length}
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={() => handleBulkSetActive(true)}
            disabled={bulkUpdating}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border bg-emerald-500/15 border-emerald-400/60 text-emerald-300 hover:bg-emerald-500/25 hover:shadow-[0_0_12px_rgba(52,211,153,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {bulkUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />}
            Enable in Store
          </button>
          <button
            onClick={() => handleBulkSetActive(false)}
            disabled={bulkUpdating}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border bg-secondary/60 border-border text-muted-foreground hover:border-primary/50 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {bulkUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />}
            Move to Vault
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            disabled={bulkUpdating}
            className="ml-1 w-7 h-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            title="Clear selection"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <Card className="bg-card border-border/50">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="w-10 pr-0 pl-4">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border border-border/60 bg-secondary/50 accent-primary cursor-pointer"
                    checked={allFilteredSelected}
                    ref={el => { if (el) el.indeterminate = someFilteredSelected; }}
                    onChange={() => {
                      if (allFilteredSelected) {
                        setSelectedIds(new Set());
                      } else {
                        setSelectedIds(new Set(filteredTraitsForDisplay.map(t => t.id)));
                      }
                    }}
                    title={allFilteredSelected ? "Deselect all" : "Select all visible"}
                  />
                </TableHead>
                <TableHead>Trait</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price (ETH)</TableHead>
                <TableHead>Supply</TableHead>
                <TableHead>Payout Splits</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                if (isLoadingTraits) {
                  return (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  );
                }

                type TraitItem = NonNullable<typeof traitsData>["traits"][0];

                const renderTraitRow = (trait: TraitItem) => {
                  const isSelected = selectedIds.has(trait.id);
                  return (
                  <TableRow
                    key={trait.id}
                    className={`border-border/50 cursor-pointer transition-colors ${isSelected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-secondary/30"}`}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.closest("button") || target.closest("a") || target.closest("[role=dialog]") || target.closest("input[type=checkbox]")) return;
                      toggleSelectId(trait.id);
                    }}
                  >
                    <TableCell className="w-10 pr-0 pl-4" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectId(trait.id)}
                        className="w-4 h-4 rounded border border-border/60 bg-secondary/50 accent-primary cursor-pointer"
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        {trait.imageUrl ? (
                          <div className="w-14 h-14 rounded-lg bg-secondary/50 overflow-hidden flex-shrink-0">
                            <TraitMedia url={trait.imageUrl} mediaType={(trait as Record<string,unknown>).mediaType as string} alt={trait.name} className="w-full h-full object-contain" showBadge />
                          </div>
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-secondary flex items-center justify-center text-base font-bold">
                            {trait.name[0]}
                          </div>
                        )}
                        <div>{trait.name}</div>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{trait.category}</TableCell>
                    <TableCell className="font-mono text-sm">{trait.priceEth}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className={trait.remainingSupply === 0 ? "text-destructive font-bold" : ""}>
                          {trait.remainingSupply}
                        </span>
                        <span className="text-muted-foreground"> / {trait.totalSupply}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <PayoutSplitsSummary splits={trait.payoutSplits ?? []} />
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const isPendingThis = updateTrait.isPending &&
                          (updateTrait.variables as { traitId: number } | undefined)?.traitId === trait.id;
                        const displayActive = isPendingThis ? !trait.isActive : trait.isActive;
                        return (
                          <button
                            disabled={updateTrait.isPending}
                            onClick={() => updateTrait.mutate({ traitId: trait.id, data: { isActive: !trait.isActive } })}
                            data-testid={`switch-active-${trait.id}`}
                            title={displayActive ? "Click to move to Vault" : "Click to publish to Store"}
                            className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-full border font-bold text-xs uppercase tracking-wider transition-all duration-200 disabled:cursor-not-allowed ${
                              displayActive
                                ? "bg-emerald-500/15 border-emerald-400/60 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.35)] hover:shadow-[0_0_16px_rgba(52,211,153,0.55)] hover:bg-emerald-500/25 hover:border-emerald-400"
                                : "bg-secondary/60 border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${displayActive ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)] animate-pulse" : "bg-muted-foreground/40"}`} />
                            {displayActive ? "ON" : "OFF"}
                            {isPendingThis && <Loader2 className="w-3 h-3 animate-spin ml-0.5" />}
                          </button>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Dialog
                          open={editingTrait?.id === trait.id}
                          onOpenChange={(open) => !open && setEditingTrait(null)}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingTrait(trait)}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              data-testid={`button-edit-${trait.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Edit Trait: {trait.name}</DialogTitle>
                            </DialogHeader>
                            {editingTrait?.id === trait.id && (
                              <TraitForm
                                defaultValues={editingTrait}
                                onSubmit={handleUpdate}
                                isSubmitting={updateTrait.isPending}
                              />
                            )}
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Delete this trait permanently?")) {
                              deleteTrait.mutate({ traitId: trait.id });
                            }
                          }}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          data-testid={`button-delete-${trait.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                };

                const filteredTraits = filteredTraitsForDisplay;

                if (filteredTraits.length === 0) {
                  return (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-sm">
                        {traitSearch.trim()
                          ? `No traits matching "${traitSearch.trim()}"`
                          : traitView === "vault" ? "No vaulted traits" : traitView === "in-store" ? "No active traits in store" : "No traits yet"}
                      </TableCell>
                    </TableRow>
                  );
                }

                // For All / In Store, or vault with a specific category selected — plain flat list
                if (traitView !== "vault" || traitCategory !== "all") {
                  return <>{filteredTraits.map(renderTraitRow)}</>;
                }

                // Vault + All Categories — group by category
                const grouped: Record<string, TraitItem[]> = {};
                for (const t of filteredTraits) {
                  const cat = (t.category as string) || "Other";
                  if (!grouped[cat]) grouped[cat] = [];
                  grouped[cat].push(t);
                }
                const sortedCats = CATEGORIES.filter(c => grouped[c])
                  .concat(Object.keys(grouped).filter(c => !CATEGORIES.includes(c)).sort());

                return (
                  <>
                    {sortedCats.flatMap(cat => [
                      <TableRow key={`vault-cat-${cat}`} className="border-0 bg-primary/5 hover:bg-primary/5">
                        <TableCell colSpan={7} className="py-2 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-base leading-none select-none">{LAYER_ICONS[cat] ?? "📦"}</span>
                            <span className="text-xs font-bold uppercase tracking-widest text-primary/80">{cat}</span>
                            <span className="text-xs text-muted-foreground/50 font-normal">
                              — {grouped[cat].length} trait{grouped[cat].length !== 1 ? "s" : ""}
                            </span>
                            <div className="flex-1 h-px bg-border/30 ml-1" />
                          </div>
                        </TableCell>
                      </TableRow>,
                      ...grouped[cat].map(renderTraitRow),
                    ])}
                  </>
                );
              })()}
            </TableBody>
          </Table>
        </div>
      </Card>
        </TabsContent>

        <TabsContent value="appearance" className="border border-primary/40 rounded-lg p-6 shadow-[0_0_20px_rgba(124,58,237,0.08)]">
          <AppearanceSettings />
        </TabsContent>

        <TabsContent value="fees" className="border border-primary/40 rounded-lg p-6 shadow-[0_0_20px_rgba(124,58,237,0.08)]">
          <FeesSettings />
        </TabsContent>

        <TabsContent value="transactions" className="border border-primary/40 rounded-lg p-6 shadow-[0_0_20px_rgba(124,58,237,0.08)]">
          <TransactionsLog />
        </TabsContent>

        <TabsContent value="layers" className="border border-primary/40 rounded-lg p-6 shadow-[0_0_20px_rgba(124,58,237,0.08)]">
          <LayerOrderSettings />
        </TabsContent>

        <TabsContent value="rarities" className="border border-primary/40 rounded-lg p-6 shadow-[0_0_20px_rgba(124,58,237,0.08)]">
          <RarityTiersSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Rarity Tiers Settings Tab ─────────────────────────────────────────────────
type RarityTierItem = {
  id: number;
  name: string;
  rank: number;
  color: string | null;
  createdAt: string;
};

function RarityTiersSettings() {
  const { toast } = useToast();
  const [tiers, setTiers] = useState<RarityTierItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#888888");
  const [isAdding, setIsAdding] = useState(false);
  const [movingId, setMovingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchTiers = async () => {
    const res = await fetch("/api/admin/rarities");
    if (!res.ok) return;
    const data = await res.json();
    setTiers(data.tiers ?? []);
    setIsLoading(false);
  };

  useEffect(() => { fetchTiers(); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setIsAdding(true);
    try {
      const res = await fetch("/api/admin/rarities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: data.error ?? "Failed to add rarity", variant: "destructive" });
        return;
      }
      setNewName("");
      setNewColor("#888888");
      await fetchTiers();
      toast({ title: "Rarity added", description: `"${data.tier.name}" has been added to the tier list.` });
    } finally {
      setIsAdding(false);
    }
  };

  const handleMove = async (id: number, dir: "up" | "down") => {
    setMovingId(id);
    try {
      const res = await fetch(`/api/admin/rarities/${id}/move-${dir}`, { method: "POST" });
      if (!res.ok) return;
      const data = await res.json();
      setTiers(data.tiers ?? []);
    } finally {
      setMovingId(null);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/admin/rarities/${id}`, { method: "DELETE" });
      await fetchTiers();
      toast({ title: "Rarity removed", description: `"${name}" has been deleted.` });
    } finally {
      setDeletingId(null);
    }
  };

  const PRESET_COLORS = ["#F59E0B", "#60A5FA", "#34D399", "#9CA3AF", "#F472B6", "#A78BFA", "#FB923C", "#EF4444"];

  // API returns tiers ASC by rank; rank 1 = highest (legendary), displayed at top naturally
  const displayTiers = tiers;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Gem className="w-5 h-5 text-primary" />
          Rarity Tiers
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Highest rarity is at the top, lowest at the bottom. Use the arrows to reorder.
        </p>
      </div>

      {/* Tier list — highest rank at top */}
      <div className="space-y-2">
        {displayTiers.map((tier, idx) => (
          <div
            key={tier.id}
            className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-secondary/30 group transition-all hover:border-primary/30"
          >
            {/* Color swatch */}
            <div
              className="w-4 h-10 rounded-md flex-shrink-0 ring-1 ring-black/20"
              style={{ background: tier.color ?? "#888888" }}
            />

            {/* Position label */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{
                background: `${tier.color ?? "#888888"}22`,
                color: tier.color ?? "#888888",
                border: `1px solid ${tier.color ?? "#888888"}55`,
              }}
            >
              #{idx + 1}
            </div>

            {/* Name */}
            <div className="flex-1 min-w-0">
              <div className="font-bold capitalize text-base">{tier.name}</div>
              <div className="text-xs text-muted-foreground/60 font-mono">{tier.color ?? "#888888"}</div>
            </div>

            {/* Move buttons — rank 1 = highest tier at top */}
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => handleMove(tier.id, "up")}
                disabled={idx === 0 || movingId === tier.id}
                className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-25 disabled:cursor-not-allowed transition-all"
                title="Move up (increase rarity)"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleMove(tier.id, "down")}
                disabled={idx === displayTiers.length - 1 || movingId === tier.id}
                className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-25 disabled:cursor-not-allowed transition-all"
                title="Move down (decrease rarity)"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Delete */}
            <button
              onClick={() => handleDelete(tier.id, tier.name)}
              disabled={deletingId === tier.id}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100"
              title="Delete rarity"
            >
              {deletingId === tier.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        ))}

        {tiers.length === 0 && (
          <div className="text-center py-10 text-muted-foreground/50 border border-dashed border-border/30 rounded-xl">
            No rarity tiers yet. Add one below.
          </div>
        )}
      </div>

      {/* Add new tier form */}
      <div className="border border-primary/20 rounded-xl p-5 space-y-4 bg-primary/5">
        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Plus className="w-3.5 h-3.5" />
          Add New Rarity Tier
        </h4>

        <div className="flex gap-3">
          <div className="flex-1">
            <Label className="text-xs mb-1.5 block">Name</Label>
            <Input
              placeholder="e.g. mythic, godlike…"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdd()}
              className="bg-secondary/50 border-border/50 h-9"
            />
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">Color</Label>
            <input
              type="color"
              value={newColor}
              onChange={e => setNewColor(e.target.value)}
              className="h-9 w-12 rounded-md border border-border/50 bg-secondary/50 cursor-pointer p-0.5"
              title="Pick a color for this rarity"
            />
          </div>
        </div>

        {/* Color presets */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground/50">Presets:</span>
          {PRESET_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setNewColor(c)}
              title={c}
              className={`w-5 h-5 rounded-full ring-1 ring-black/20 transition-all hover:scale-125 ${newColor === c ? "ring-2 ring-white scale-125" : ""}`}
              style={{ background: c }}
            />
          ))}
        </div>

        {/* Preview */}
        {newName && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground/50">Preview:</span>
            <span
              className="px-2.5 py-0.5 rounded-full text-xs font-bold capitalize"
              style={{
                background: `${newColor}22`,
                color: newColor,
                border: `1px solid ${newColor}55`,
              }}
            >
              {newName.trim()}
            </span>
          </div>
        )}

        <Button
          onClick={handleAdd}
          disabled={isAdding || !newName.trim()}
          className="w-full bg-primary text-white hover:bg-primary/90 gap-2"
        >
          {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add Rarity Tier
        </Button>
      </div>
    </div>
  );
}

// ── Appearance Settings Tab ────────────────────────────────────────────────────
function AppearanceSettings() {
  const { settings, updateColors, updateImages, resetColors } = useSiteSettings();
  const { toast } = useToast();

  const logoUpload = useUpload();
  const bgUpload = useUpload();
  const bannerUpload = useUpload();

  const logoRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (file: File) => {
    const result = await logoUpload.uploadFile(file);
    if (result) {
      updateImages({ logoUrl: `/api/storage${result.objectPath}` });
      toast({ title: "Logo updated" });
    } else {
      toast({ title: "Logo upload failed", variant: "destructive" });
    }
  };

  const handleBgUpload = async (file: File) => {
    const result = await bgUpload.uploadFile(file);
    if (result) {
      updateImages({ backgroundUrl: `/api/storage${result.objectPath}` });
      toast({ title: "Background updated" });
    } else {
      toast({ title: "Background upload failed", variant: "destructive" });
    }
  };

  const handleBannerUpload = async (file: File) => {
    const result = await bannerUpload.uploadFile(file);
    if (result) {
      updateImages({ bannerUrl: `/api/storage${result.objectPath}` });
      toast({ title: "Banner updated" });
    } else {
      toast({ title: "Banner upload failed", variant: "destructive" });
    }
  };

  const COLOR_OPTIONS: { key: keyof typeof settings.colors; label: string; description: string }[] = [
    { key: "primary", label: "Primary Color", description: "Buttons, active states, borders, glows" },
    { key: "secondary", label: "Secondary Color", description: "Secondary backgrounds, muted surfaces" },
    { key: "text", label: "Text Color", description: "Main body text and card text" },
    { key: "headerLine", label: "Header Lines", description: "Header border, nav underlines, input borders" },
    { key: "cardPanel", label: "Card Panel", description: "Card and popover background color" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold mb-1">Appearance Settings</h2>
        <p className="text-sm text-muted-foreground">Customize the site logo, images, and color theme. Changes apply instantly.</p>
      </div>

      {/* ── Image Assets ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Logo */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-primary" />
              Site Logo
              <span className="text-xs text-muted-foreground font-normal ml-auto">200 × 200 · PNG / JPG / GIF</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              className="w-full aspect-square max-w-[200px] mx-auto border-2 border-dashed border-border/60 flex items-center justify-center bg-secondary/20 overflow-hidden cursor-pointer hover:border-primary/60 transition-colors"
              onClick={() => logoRef.current?.click()}
            >
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <div className="text-center p-4">
                  <ImageIcon className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Click to upload</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">200×200 · PNG, JPG, GIF</p>
                </div>
              )}
            </div>
            <input
              ref={logoRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/*"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
            />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => logoRef.current?.click()} disabled={logoUpload.isUploading}>
                {logoUpload.isUploading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Upload className="w-3 h-3 mr-1" />}
                {settings.logoUrl ? "Replace" : "Upload"}
              </Button>
              {settings.logoUrl && (
                <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => updateImages({ logoUrl: null })}>
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Background */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-primary" />
              Background Image
              <span className="text-xs text-muted-foreground font-normal ml-auto">Any size · PNG / JPG / GIF</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              className="w-full aspect-video border-2 border-dashed border-border/60 flex items-center justify-center bg-secondary/20 overflow-hidden cursor-pointer hover:border-primary/60 transition-colors"
              onClick={() => bgRef.current?.click()}
            >
              {settings.backgroundUrl ? (
                <img src={settings.backgroundUrl} alt="Background" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center p-4">
                  <ImageIcon className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Click to upload</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Full-page background · PNG, JPG, GIF</p>
                </div>
              )}
            </div>
            <input
              ref={bgRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/*"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleBgUpload(e.target.files[0])}
            />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => bgRef.current?.click()} disabled={bgUpload.isUploading}>
                {bgUpload.isUploading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Upload className="w-3 h-3 mr-1" />}
                {settings.backgroundUrl ? "Replace" : "Upload"}
              </Button>
              {settings.backgroundUrl && (
                <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => updateImages({ backgroundUrl: null })}>
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Banner */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-primary" />
              Site Banner
              <span className="text-xs text-muted-foreground font-normal ml-auto">1500 × 500 · PNG / JPG / GIF</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              className="w-full border-2 border-dashed border-border/60 flex items-center justify-center bg-secondary/20 overflow-hidden cursor-pointer hover:border-primary/60 transition-colors"
              style={{ aspectRatio: '3/1' }}
              onClick={() => bannerRef.current?.click()}
            >
              {settings.bannerUrl ? (
                <img src={settings.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center p-4">
                  <ImageIcon className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Click to upload</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">1500×500 · PNG, JPG, GIF supported</p>
                </div>
              )}
            </div>
            <input
              ref={bannerRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/*"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleBannerUpload(e.target.files[0])}
            />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => bannerRef.current?.click()} disabled={bannerUpload.isUploading}>
                {bannerUpload.isUploading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Upload className="w-3 h-3 mr-1" />}
                {settings.bannerUrl ? "Replace" : "Upload"}
              </Button>
              {settings.bannerUrl && (
                <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => updateImages({ bannerUrl: null })}>
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator className="border-border/40" />

      {/* ── Color Theme ── */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold">Color Theme</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Click any swatch to open the color picker. Changes apply instantly across the site.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { resetColors(); toast({ title: "Colors reset to default" }); }}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Default
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {COLOR_OPTIONS.map(({ key, label, description }) => (
            <ColorPickerCard
              key={key}
              label={label}
              description={description}
              value={settings.colors[key]}
              onChange={hex => updateColors({ [key]: hex })}
            />
          ))}
        </div>

        {/* Live preview strip */}
        <div className="mt-6 p-4 border border-border/40 bg-card/50 space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono">Live Preview</p>
          <div className="flex flex-wrap gap-3 items-center">
            <div
              className="px-4 py-2 text-sm font-bold text-white"
              style={{ background: settings.colors.primary }}
            >
              Primary Button
            </div>
            <div
              className="px-4 py-2 text-sm font-bold border-2"
              style={{ background: settings.colors.secondary, borderColor: settings.colors.headerLine, color: settings.colors.text }}
            >
              Secondary
            </div>
            <div
              className="px-4 py-2 text-sm border"
              style={{ background: settings.colors.cardPanel, borderColor: settings.colors.headerLine, color: settings.colors.text }}
            >
              Card Panel
            </div>
            <div
              className="w-full h-0.5"
              style={{ background: settings.colors.headerLine }}
            />
            <span className="text-sm" style={{ color: settings.colors.text }}>Text color sample — The quick brown fox</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorPickerCard({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className="flex items-center gap-4 p-4 border border-border/50 bg-card/50 hover:border-primary/40 transition-colors cursor-pointer group"
      onClick={() => inputRef.current?.click()}
    >
      <div className="relative flex-shrink-0">
        <div
          className="w-12 h-12 border-2 border-border/60 group-hover:border-primary/60 transition-colors shadow-sm"
          style={{ background: value }}
        />
        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-secondary border border-border/60 flex items-center justify-center">
          <Paintbrush className="w-3 h-3 text-muted-foreground" />
        </div>
        <input
          ref={inputRef}
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="sr-only"
          onClick={e => e.stopPropagation()}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
        <div className="font-mono text-xs text-muted-foreground/60 mt-1">{value.toUpperCase()}</div>
      </div>
    </div>
  );
}

// ── Fees Settings Tab ─────────────────────────────────────────────────────────

interface FeeSettings {
  id: number;
  buyingFeePercent: string;
  buyingFeeWallet: string | null;
  sellingFeePercent: string;
  sellingFeeWallet: string | null;
}

const feeSchema = z.object({
  buyingFeePercent: z
    .string()
    .regex(/^\d+(\.\d+)?$/, "Must be a valid number (e.g. 2.5)")
    .refine(v => parseFloat(v) <= 100, "Cannot exceed 100%"),
  buyingFeeWallet: z.string().optional(),
  sellingFeePercent: z
    .string()
    .regex(/^\d+(\.\d+)?$/, "Must be a valid number (e.g. 2.5)")
    .refine(v => parseFloat(v) <= 100, "Cannot exceed 100%"),
  sellingFeeWallet: z.string().optional(),
});

type FeeFormValues = z.infer<typeof feeSchema>;

function FeesSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: fees, isLoading } = useQuery<FeeSettings>({
    queryKey: ["admin-fees"],
    queryFn: async () => {
      const res = await fetch("/api/admin/fees");
      if (!res.ok) throw new Error("Failed to load fees");
      return res.json();
    },
  });

  const form = useForm<FeeFormValues>({
    resolver: zodResolver(feeSchema),
    defaultValues: {
      buyingFeePercent: "0",
      buyingFeeWallet: "",
      sellingFeePercent: "0",
      sellingFeeWallet: "",
    },
    values: fees
      ? {
          buyingFeePercent: fees.buyingFeePercent,
          buyingFeeWallet: fees.buyingFeeWallet ?? "",
          sellingFeePercent: fees.sellingFeePercent,
          sellingFeeWallet: fees.sellingFeeWallet ?? "",
        }
      : undefined,
  });

  const saveFees = useMutation({
    mutationFn: async (data: FeeFormValues) => {
      const res = await fetch("/api/admin/fees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyingFeePercent: data.buyingFeePercent,
          buyingFeeWallet: data.buyingFeeWallet || null,
          sellingFeePercent: data.sellingFeePercent,
          sellingFeeWallet: data.sellingFeeWallet || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to save fees");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-fees"] });
      toast({ title: "Fee settings saved" });
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const buyingPct = parseFloat(form.watch("buyingFeePercent") || "0");
  const sellingPct = parseFloat(form.watch("sellingFeePercent") || "0");

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold mb-1">Fee Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure platform fees for buying and selling traits. Fees are taken from each transaction and forwarded to the designated wallet.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(d => saveFees.mutate(d))} className="space-y-6">

        {/* ── Buying Fee ── */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="w-5 h-5 text-primary" />
              Buyer Fee
              <span className="ml-auto text-2xl font-black text-primary" style={{ fontFamily: "'Bebas Neue', 'Rajdhani', sans-serif", letterSpacing: '0.05em' }}>
                {isNaN(buyingPct) ? "0" : buyingPct.toFixed(1)}%
              </span>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Charged to the buyer on top of the trait price. Goes to the wallet below.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="buyingFeePercent">
                  Fee Percentage
                  <span className="ml-1 text-xs text-muted-foreground">(0 – 100)</span>
                </Label>
                <div className="relative">
                  <Input
                    id="buyingFeePercent"
                    {...form.register("buyingFeePercent")}
                    placeholder="2.5"
                    className="bg-secondary/50 pr-8"
                  />
                  <Percent className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                </div>
                {form.formState.errors.buyingFeePercent && (
                  <p className="text-xs text-destructive">{form.formState.errors.buyingFeePercent.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="buyingFeeWallet">
                  Recipient Wallet
                  <span className="ml-1 text-xs text-muted-foreground">(ETH address)</span>
                </Label>
                <div className="relative">
                  <Input
                    id="buyingFeeWallet"
                    {...form.register("buyingFeeWallet")}
                    placeholder="0x..."
                    className="bg-secondary/50 font-mono text-xs pl-8"
                  />
                  <Wallet className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Preview bar */}
            {buyingPct > 0 && (
              <div className="text-xs text-muted-foreground p-3 bg-secondary/30 border border-border/40 font-mono">
                On a <span className="text-foreground">0.1 ETH</span> trait → buyer pays{" "}
                <span className="text-primary font-bold">{(0.1 + 0.1 * buyingPct / 100).toFixed(4)} ETH</span>
                {" "}({buyingPct}% fee = {(0.1 * buyingPct / 100).toFixed(4)} ETH)
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Selling Fee ── */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Tag className="w-5 h-5 text-accent" />
              Seller Fee
              <span className="ml-auto text-2xl font-black text-accent" style={{ fontFamily: "'Bebas Neue', 'Rajdhani', sans-serif", letterSpacing: '0.05em' }}>
                {isNaN(sellingPct) ? "0" : sellingPct.toFixed(1)}%
              </span>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Deducted from the seller's proceeds when a trait is sold. Goes to the wallet below.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sellingFeePercent">
                  Fee Percentage
                  <span className="ml-1 text-xs text-muted-foreground">(0 – 100)</span>
                </Label>
                <div className="relative">
                  <Input
                    id="sellingFeePercent"
                    {...form.register("sellingFeePercent")}
                    placeholder="2.5"
                    className="bg-secondary/50 pr-8"
                  />
                  <Percent className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                </div>
                {form.formState.errors.sellingFeePercent && (
                  <p className="text-xs text-destructive">{form.formState.errors.sellingFeePercent.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sellingFeeWallet">
                  Recipient Wallet
                  <span className="ml-1 text-xs text-muted-foreground">(ETH address)</span>
                </Label>
                <div className="relative">
                  <Input
                    id="sellingFeeWallet"
                    {...form.register("sellingFeeWallet")}
                    placeholder="0x..."
                    className="bg-secondary/50 font-mono text-xs pl-8"
                  />
                  <Wallet className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Preview bar */}
            {sellingPct > 0 && (
              <div className="text-xs text-muted-foreground p-3 bg-secondary/30 border border-border/40 font-mono">
                On a <span className="text-foreground">0.1 ETH</span> sale → seller receives{" "}
                <span className="text-accent font-bold">{(0.1 - 0.1 * sellingPct / 100).toFixed(4)} ETH</span>
                {" "}({sellingPct}% fee = {(0.1 * sellingPct / 100).toFixed(4)} ETH)
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Summary ── */}
        {(buyingPct > 0 || sellingPct > 0) && (
          <div className="p-4 border border-primary/30 bg-primary/5 flex items-start gap-3">
            <DollarSign className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <div className="font-semibold text-foreground">Combined fee impact on a 0.1 ETH trait</div>
              <div className="text-muted-foreground font-mono text-xs space-y-0.5">
                {buyingPct > 0 && (
                  <div>Buyer pays: <span className="text-primary">{(0.1 + 0.1 * buyingPct / 100).toFixed(4)} ETH</span> (+{buyingPct}% buyer fee)</div>
                )}
                {sellingPct > 0 && (
                  <div>Seller gets: <span className="text-accent">{(0.1 - 0.1 * sellingPct / 100).toFixed(4)} ETH</span> (−{sellingPct}% seller fee)</div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={saveFees.isPending}
            className="bg-primary hover:bg-primary/90 text-white gap-2 px-8"
          >
            {saveFees.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Fee Settings
          </Button>
        </div>
      </form>
    </div>
  );
}

// ── Transactions Log Tab ───────────────────────────────────────────────────────

interface TxRow {
  id: number;
  type: "buy" | "sell" | "trade";
  traitId: number;
  traitName: string;
  traitCategory: string;
  traitImageUrl: string | null;
  walletAddress: string;
  ethAmount: string;
  txHash: string | null;
  tokenId: number | null;
  createdAt: string;
}

interface TxResponse {
  transactions: TxRow[];
  total: number;
  limit: number;
  offset: number;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function truncateWallet(addr: string) {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const TX_TYPE_META = {
  buy: {
    label: "Buy",
    icon: ArrowDownToLine,
    color: "text-green-400",
    bg: "bg-green-400/10 border-green-400/30",
  },
  sell: {
    label: "Sell",
    icon: ArrowUpFromLine,
    color: "text-red-400",
    bg: "bg-red-400/10 border-red-400/30",
  },
  trade: {
    label: "Equip",
    icon: Repeat2,
    color: "text-primary",
    bg: "bg-primary/10 border-primary/30",
  },
};

function TransactionsLog() {
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data, isLoading, refetch } = useQuery<TxResponse>({
    queryKey: ["admin-transactions", typeFilter],
    queryFn: async () => {
      const qs = typeFilter !== "all" ? `?type=${typeFilter}` : "";
      const res = await fetch(`/api/admin/transactions${qs}`);
      if (!res.ok) throw new Error("Failed to load transactions");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const txs = data?.transactions ?? [];

  const totalBuys = txs.filter(t => t.type === "buy").length;
  const totalTrades = txs.filter(t => t.type === "trade").length;
  const totalEth = txs
    .filter(t => t.type === "buy")
    .reduce((sum, t) => sum + parseFloat(t.ethAmount || "0"), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold mb-1">Transaction Log</h2>
          <p className="text-sm text-muted-foreground">
            Live activity feed of all trait purchases and equips across the store.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
        >
          <Clock className="w-3.5 h-3.5" /> Auto-refreshes every 30s
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="border border-green-400/20 bg-green-400/5 rounded-lg p-4 text-center">
          <div className="text-2xl font-black text-green-400" style={{ fontFamily: "'Bebas Neue', 'Rajdhani', sans-serif", letterSpacing: '0.05em' }}>
            {data?.total ?? 0}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Total Events</div>
        </div>
        <div className="border border-primary/20 bg-primary/5 rounded-lg p-4 text-center">
          <div className="text-2xl font-black text-primary" style={{ fontFamily: "'Bebas Neue', 'Rajdhani', sans-serif", letterSpacing: '0.05em' }}>
            {totalTrades}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Equips</div>
        </div>
        <div className="border border-yellow-400/20 bg-yellow-400/5 rounded-lg p-4 text-center">
          <div className="text-2xl font-black text-yellow-400" style={{ fontFamily: "'Bebas Neue', 'Rajdhani', sans-serif", letterSpacing: '0.05em' }}>
            {totalEth.toFixed(3)} Ξ
          </div>
          <div className="text-xs text-muted-foreground mt-1">Volume (buys)</div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground mr-1">Filter:</span>
        {["all", "buy", "sell", "trade"].map(f => (
          <button
            key={f}
            onClick={() => setTypeFilter(f)}
            className={`px-3 py-1 rounded text-xs font-medium uppercase tracking-wide transition-colors border ${
              typeFilter === f
                ? "bg-primary text-white border-primary"
                : "border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/50"
            }`}
          >
            {f === "trade" ? "Equip" : f}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : txs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/50 gap-3">
          <Activity className="w-12 h-12" />
          <p className="text-sm">No transactions yet.</p>
          <p className="text-xs">Activity will appear here as users buy and equip traits.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/30 hover:bg-secondary/30">
                <TableHead className="text-xs uppercase tracking-widest text-muted-foreground w-24">Type</TableHead>
                <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Trait</TableHead>
                <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Wallet</TableHead>
                <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Amount</TableHead>
                <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Tx Hash</TableHead>
                <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {txs.map((tx) => {
                const meta = TX_TYPE_META[tx.type] ?? TX_TYPE_META.buy;
                const Icon = meta.icon;
                return (
                  <TableRow key={tx.id} className="border-border/30 hover:bg-secondary/20 transition-colors">
                    {/* Type badge */}
                    <TableCell>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium ${meta.bg} ${meta.color}`}>
                        <Icon className="w-3 h-3" />
                        {meta.label}
                      </span>
                    </TableCell>

                    {/* Trait */}
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        {tx.traitImageUrl ? (
                          <img
                            src={tx.traitImageUrl}
                            alt={tx.traitName}
                            className="w-8 h-8 rounded object-cover flex-shrink-0 border border-border/40"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center flex-shrink-0">
                            <Package className="w-4 h-4 text-muted-foreground/40" />
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium text-foreground">{tx.traitName}</div>
                          <div className="text-[11px] text-muted-foreground">{tx.traitCategory}
                            {tx.tokenId != null && (
                              <span className="ml-1.5 text-primary/70">→ NFT #{tx.tokenId}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Wallet */}
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground" title={tx.walletAddress}>
                        {truncateWallet(tx.walletAddress)}
                      </span>
                    </TableCell>

                    {/* Amount */}
                    <TableCell className="text-right">
                      <span className="font-mono text-sm text-foreground">
                        {parseFloat(tx.ethAmount).toFixed(4)} Ξ
                      </span>
                    </TableCell>

                    {/* Tx Hash */}
                    <TableCell>
                      {tx.txHash ? (
                        <a
                          href={`https://etherscan.io/tx/${tx.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-[11px] text-primary/80 hover:text-primary transition-colors"
                          title={tx.txHash}
                        >
                          {truncateWallet(tx.txHash)}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/40 italic">on-chain pending</span>
                      )}
                    </TableCell>

                    {/* When */}
                    <TableCell className="text-right">
                      <span className="text-xs text-muted-foreground" title={new Date(tx.createdAt).toLocaleString()}>
                        {timeAgo(tx.createdAt)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Footer count */}
      {txs.length > 0 && (
        <div className="text-xs text-muted-foreground text-right">
          Showing {txs.length} of {data?.total ?? 0} events
        </div>
      )}
    </div>
  );
}

// ── Payout splits summary shown in the table row ──────────────────────────────
function PayoutSplitsSummary({
  splits,
}: {
  splits: { walletAddress: string; percentage: number }[];
}) {
  if (!splits || splits.length === 0) {
    return <span className="text-xs text-muted-foreground italic">None set</span>;
  }
  return (
    <div className="flex flex-col gap-1">
      {splits.map((s, i) => (
        <div key={i} className="flex items-center gap-1.5 text-xs">
          <span className="font-mono text-muted-foreground">
            {s.walletAddress.slice(0, 6)}…{s.walletAddress.slice(-4)}
          </span>
          <Badge variant="secondary" className="text-[10px] px-1 py-0">
            {s.percentage}%
          </Badge>
        </div>
      ))}
    </div>
  );
}

// ── Batch Trait Upload ────────────────────────────────────────────────────────
interface BatchQueueItem {
  id: string;
  file: File;
  localUrl: string;
  name: string;
  mediaType: "image" | "gif" | "video" | "audio";
  status: "ready" | "uploading" | "creating" | "done" | "error";
  error?: string;
}

function detectMediaType(file: File): "image" | "gif" | "video" | "audio" {
  if (file.type === "image/gif") return "gif";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "image";
}

function nameFromFilename(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/, "")
    .replace(/[-_\.]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image dimensions"));
    };
    img.src = url;
  });
}

function BatchTraitUploadDialog({ onClose }: { onClose: () => void }) {
  const [queue, setQueue] = useState<BatchQueueItem[]>([]);
  const [category, setCategory] = useState("");
  const [priceEth, setPriceEth] = useState("0.01");
  const [totalSupply, setTotalSupply] = useState(100);
  const [theme, setTheme] = useState("");
  const [rarity, setRarity] = useState<Rarity>("common");
  const [isActive, setIsActive] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadResolveRef = useRef<((url: string) => void) | null>(null);
  const uploadRejectRef = useRef<((err: Error) => void) | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { uploadFile: uploadFileHook } = useUpload({
    onSuccess: (response) => {
      uploadResolveRef.current?.(`/api/storage${response.objectPath}`);
      uploadResolveRef.current = null;
      uploadRejectRef.current = null;
    },
    onError: (err) => {
      uploadRejectRef.current?.(new Error(err.message ?? "Upload failed"));
      uploadResolveRef.current = null;
      uploadRejectRef.current = null;
    },
  });

  const batchCreateTrait = useCreateTrait({ mutation: {} });

  async function addFiles(files: FileList | File[]) {
    const ACCEPTED_TYPES = ["image/", "video/", "audio/"];
    const allFiles = Array.from(files).filter((f) =>
      ACCEPTED_TYPES.some((t) => f.type.startsWith(t))
    );
    if (!allFiles.length) {
      toast({ title: "Unsupported file type — use PNG/JPG/WebP/GIF for images, MP4/WebM for video, or MP3/WAV for audio", variant: "destructive" });
      return;
    }
    const rejected: string[] = [];
    const accepted: BatchQueueItem[] = [];
    for (const f of allFiles) {
      const mt = detectMediaType(f);
      if (mt === "image") {
        let dims: { width: number; height: number };
        try {
          dims = await getImageDimensions(f);
        } catch {
          rejected.push(f.name);
          continue;
        }
        if (dims.width !== 2000 || dims.height !== 2000) {
          rejected.push(`${f.name} (${dims.width}×${dims.height})`);
          continue;
        }
      }
      accepted.push({
        id: Math.random().toString(36).slice(2),
        file: f,
        localUrl: URL.createObjectURL(f),
        name: nameFromFilename(f.name),
        mediaType: mt,
        status: "ready",
      });
    }
    if (rejected.length) {
      toast({
        title: `${rejected.length} static image${rejected.length > 1 ? "s" : ""} rejected — must be 2000×2000px`,
        description: rejected.join(", "),
        variant: "destructive",
      });
    }
    if (accepted.length) setQueue((prev) => [...prev, ...accepted]);
  }

  function removeItem(id: string) {
    setQueue((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) URL.revokeObjectURL(item.localUrl);
      return prev.filter((i) => i.id !== id);
    });
  }

  function updateName(id: string, name: string) {
    setQueue((prev) => prev.map((i) => (i.id === id ? { ...i, name } : i)));
  }

  function setItemStatus(id: string, status: BatchQueueItem["status"], error?: string) {
    setQueue((prev) => prev.map((i) => (i.id === id ? { ...i, status, error } : i)));
  }

  async function uploadFileAsync(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      uploadResolveRef.current = resolve;
      uploadRejectRef.current = reject;
      uploadFileHook(file);
    });
  }

  async function createTraitAsync(data: TraitFormValues): Promise<void> {
    return new Promise((resolve, reject) => {
      batchCreateTrait.mutate(
        { data },
        {
          onSuccess: () => resolve(),
          onError: (err) => reject(err),
        },
      );
    });
  }

  async function processAll() {
    if (!category) {
      toast({ title: "Please select a category first", variant: "destructive" });
      return;
    }
    const readyItems = queue.filter((i) => i.status === "ready");
    if (!readyItems.length) return;

    setIsProcessing(true);

    for (const item of readyItems) {
      setItemStatus(item.id, "uploading");
      let imageUrl: string;
      try {
        imageUrl = await uploadFileAsync(item.file);
      } catch {
        setItemStatus(item.id, "error", "File upload failed");
        continue;
      }

      setItemStatus(item.id, "creating");
      try {
        await createTraitAsync({
          name: item.name,
          category,
          priceEth,
          totalSupply,
          rarity,
          theme: theme || undefined,
          imageUrl,
          mediaType: item.mediaType,
          isActive,
          payoutSplits: [],
        });
        setItemStatus(item.id, "done");
      } catch {
        setItemStatus(item.id, "error", "Trait creation failed");
      }
    }

    setIsProcessing(false);
    queryClient.invalidateQueries({ queryKey: ['/api/traits'] });
    queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
  }

  const doneCount = queue.filter((i) => i.status === "done").length;
  const errorCount = queue.filter((i) => i.status === "error").length;
  const readyCount = queue.filter((i) => i.status === "ready").length;
  const allDone = queue.length > 0 && readyCount === 0 && !isProcessing;

  return (
    <div className="space-y-5 pt-2">
      {/* Shared settings */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-secondary/30 border border-border/40 rounded-lg">
        <div className="space-y-1.5 col-span-2 sm:col-span-1">
          <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Category *
          </Label>
          <Select value={category} onValueChange={setCategory} disabled={isProcessing}>
            <SelectTrigger className="bg-card border-border/60 text-sm h-9">
              <SelectValue placeholder="Pick one" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Price ETH
          </Label>
          <Input
            value={priceEth}
            onChange={(e) => setPriceEth(e.target.value)}
            disabled={isProcessing}
            className="bg-card border-border/60 text-sm h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Supply
          </Label>
          <Input
            type="number"
            value={totalSupply}
            onChange={(e) => setTotalSupply(Number(e.target.value))}
            disabled={isProcessing}
            className="bg-card border-border/60 text-sm h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Rarity
          </Label>
          <Select value={rarity} onValueChange={(v) => setRarity(v as Rarity)} disabled={isProcessing}>
            <SelectTrigger className="bg-card border-border/60 text-sm h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RARITIES.map((r) => (
                <SelectItem key={r} value={r} className="capitalize">
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Theme
          </Label>
          <Input
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="optional"
            disabled={isProcessing}
            className="bg-card border-border/60 text-sm h-9"
          />
        </div>

        <div className="col-span-2 sm:col-span-4 flex items-center gap-2 pt-1">
          <Switch
            id="batch-active"
            checked={isActive}
            onCheckedChange={setIsActive}
            disabled={isProcessing}
          />
          <Label htmlFor="batch-active" className="text-sm cursor-pointer">
            List as active immediately
          </Label>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer ${
          isDragging
            ? "border-primary bg-primary/10"
            : "border-border/50 hover:border-primary/50 hover:bg-primary/5"
        } ${isProcessing ? "opacity-50 pointer-events-none" : ""}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        role="button"
        aria-label="Drop images here"
      >
        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
          <Upload className="w-6 h-6 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold">Drop media here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            <span className="text-primary font-semibold">PNG/JPG/WebP → 2000×2000px required</span>
            {" · "}GIF · MP4/WebM · MP3/WAV · multiple OK
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/mp4,video/webm,audio/mpeg,audio/wav,audio/ogg,audio/mp4"
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
          disabled={isProcessing}
        />
      </div>

      {/* Queue */}
      {queue.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              {queue.length} file{queue.length !== 1 ? "s" : ""} queued
            </span>
            {!isProcessing && readyCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  queue.forEach((i) => URL.revokeObjectURL(i.localUrl));
                  setQueue([]);
                }}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {queue.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${
                  item.status === "done"
                    ? "bg-green-500/5 border-green-500/20"
                    : item.status === "error"
                      ? "bg-destructive/5 border-destructive/20"
                      : item.status === "uploading" || item.status === "creating"
                        ? "bg-primary/5 border-primary/20"
                        : "bg-secondary/30 border-border/30"
                }`}
              >
                {/* Thumbnail */}
                <div className="w-10 h-10 rounded flex-shrink-0 overflow-hidden bg-secondary/50 border border-border/30 flex items-center justify-center relative">
                  {item.mediaType === "video" ? (
                    <video src={item.localUrl} className="w-full h-full object-cover" muted />
                  ) : item.mediaType === "audio" ? (
                    <Music className="w-4 h-4 text-primary" />
                  ) : (
                    <img src={item.localUrl} alt={item.name} className="w-full h-full object-cover" />
                  )}
                  {item.mediaType !== "image" && (
                    <span className="absolute bottom-0 inset-x-0 text-[8px] text-center font-bold uppercase text-white bg-black/60">
                      {item.mediaType}
                    </span>
                  )}
                </div>

                {/* Name input */}
                <Input
                  value={item.name}
                  onChange={(e) => updateName(item.id, e.target.value)}
                  disabled={isProcessing || item.status === "done"}
                  className="flex-1 h-8 text-sm bg-card border-border/50"
                  placeholder="Trait name"
                />

                {/* Status badge */}
                <div className="flex-shrink-0 w-24 text-right">
                  {item.status === "ready" && (
                    <Badge variant="outline" className="text-[10px] border-border/50 text-muted-foreground">
                      Ready
                    </Badge>
                  )}
                  {item.status === "uploading" && (
                    <div className="flex items-center gap-1 justify-end">
                      <Loader2 className="w-3 h-3 animate-spin text-primary" />
                      <span className="text-[10px] text-primary">Uploading</span>
                    </div>
                  )}
                  {item.status === "creating" && (
                    <div className="flex items-center gap-1 justify-end">
                      <Loader2 className="w-3 h-3 animate-spin text-primary" />
                      <span className="text-[10px] text-primary">Creating</span>
                    </div>
                  )}
                  {item.status === "done" && (
                    <div className="flex items-center gap-1 justify-end">
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      <span className="text-[10px] text-green-500">Done</span>
                    </div>
                  )}
                  {item.status === "error" && (
                    <div
                      className="flex items-center gap-1 justify-end"
                      title={item.error}
                    >
                      <AlertCircle className="w-3 h-3 text-destructive" />
                      <span className="text-[10px] text-destructive">Failed</span>
                    </div>
                  )}
                </div>

                {/* Remove */}
                {!isProcessing && item.status !== "done" && (
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="flex-shrink-0 text-muted-foreground/40 hover:text-destructive transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Progress summary */}
          {(doneCount > 0 || errorCount > 0) && (
            <div className="flex items-center gap-4 text-xs pt-1">
              {doneCount > 0 && (
                <span className="flex items-center gap-1 text-green-500">
                  <CheckCircle2 className="w-3 h-3" /> {doneCount} created
                </span>
              )}
              {errorCount > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <AlertCircle className="w-3 h-3" /> {errorCount} failed
                </span>
              )}
              {readyCount > 0 && (
                <span className="text-muted-foreground/60">{readyCount} remaining</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex gap-3 pt-2 border-t border-border/30">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onClose}
          disabled={isProcessing}
        >
          {allDone ? "Done" : "Cancel"}
        </Button>
        <Button
          type="button"
          className="flex-1 bg-primary text-white hover:bg-primary/90 gap-2"
          disabled={!category || readyCount === 0 || isProcessing}
          onClick={processAll}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating…
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Create {readyCount > 0 ? `${readyCount} ` : ""}Trait{readyCount !== 1 ? "s" : ""}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ── Image uploader for trait JPEG images ─────────────────────────────────────
function TraitImageUploader({
  currentImageUrl,
  onUploadComplete,
  onClear,
  onMediaTypeChange,
}: {
  currentImageUrl?: string;
  onUploadComplete: (url: string) => void;
  onClear: () => void;
  onMediaTypeChange?: (type: "image" | "gif" | "video" | "audio") => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: (response) => {
      const servingUrl = `/api/storage${response.objectPath}`;
      onUploadComplete(servingUrl);
    },
    onError: (err) => {
      toast({ title: `Upload failed: ${err.message}`, variant: "destructive" });
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mt = detectMediaType(file);
    if (mt === "image") {
      try {
        const dims = await getImageDimensions(file);
        if (dims.width !== 2000 || dims.height !== 2000) {
          toast({
            title: `Static image must be 2000×2000px`,
            description: `Selected image is ${dims.width}×${dims.height}px. GIF, MP4, and audio have no size requirement.`,
            variant: "destructive",
          });
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }
      } catch {
        toast({ title: "Could not read image dimensions", variant: "destructive" });
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
    }
    onMediaTypeChange?.(mt);
    await uploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      {currentImageUrl ? (
        <div className="relative rounded-lg overflow-hidden border border-border/50 bg-secondary/30 group w-full aspect-square max-w-40">
          <TraitMedia
            url={currentImageUrl}
            alt="Trait preview"
            className="w-full h-full"
            showBadge
            autoPlay
          />
          <button
            type="button"
            onClick={onClear}
            className="absolute top-1.5 right-1.5 bg-black/70 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
            aria-label="Remove media"
          >
            <X className="w-3 h-3 text-white" />
          </button>
          <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[10px] text-center py-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
            Click × to remove
          </div>
        </div>
      ) : (
        <div
          className="border-2 border-dashed border-border/50 rounded-lg p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
          onClick={() => fileInputRef.current?.click()}
          role="button"
          aria-label="Upload media"
          data-testid="image-drop-zone"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Uploading… {progress}%</p>
              <div className="w-full bg-secondary/50 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Click to upload trait media</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <span className="text-primary font-semibold">PNG/JPG/WebP → 2000×2000px</span>
                  {" · "}GIF · MP4/WebM · MP3/WAV
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" className="gap-2">
                <Upload className="w-3.5 h-3.5" />
                Choose File
              </Button>
            </>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/mp4,video/webm,audio/mpeg,audio/wav,audio/ogg,audio/mp4"
        className="hidden"
        onChange={handleFileChange}
        disabled={isUploading}
        data-testid="input-image-file"
      />

      {currentImageUrl && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Upload className="w-3.5 h-3.5" />
          )}
          {isUploading ? "Uploading…" : "Replace Media"}
        </Button>
      )}

      {currentImageUrl && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/*"
          className="hidden"
          onChange={handleFileChange}
          disabled={isUploading}
          data-testid="input-image-file"
        />
      )}
    </div>
  );
}

// ── Trait form (create + edit) ─────────────────────────────────────────────────
function TraitForm({
  defaultValues,
  onSubmit,
  isSubmitting,
}: {
  defaultValues?: Partial<Trait>;
  onSubmit: (data: TraitFormValues) => void;
  isSubmitting: boolean;
}) {
  const form = useForm<TraitFormValues>({
    resolver: zodResolver(traitSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      category: defaultValues?.category ?? "",
      theme: defaultValues?.theme ?? "",
      description: defaultValues?.description ?? "",
      imageUrl: defaultValues?.imageUrl ?? "",
      mediaType: ((defaultValues as Record<string, unknown>)?.mediaType as MediaType) ?? "image",
      priceEth: defaultValues?.priceEth ?? "0.01",
      totalSupply: defaultValues?.totalSupply ?? 100,
      rarity: (defaultValues?.rarity as Rarity) ?? "common",
      isActive: defaultValues?.isActive ?? true,
      payoutSplits: (defaultValues?.payoutSplits as TraitFormValues["payoutSplits"]) ?? [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "payoutSplits",
  });

  const splits = form.watch("payoutSplits");
  const total = splits.reduce((sum, s) => sum + Number(s.percentage || 0), 0);
  const totalOk = splits.length === 0 || Math.abs(total - 100) < 0.01;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-2">
      {/* Core fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            {...form.register("name")}
            placeholder="e.g. Neon Visor"
            className="bg-secondary/50"
            data-testid="input-name"
          />
          {form.formState.errors.name && (
            <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Category</Label>
          <Controller
            control={form.control}
            name="category"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger className="bg-secondary/50" data-testid="select-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {form.formState.errors.category && (
            <p className="text-xs text-destructive">
              {form.formState.errors.category.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Rarity</Label>
          <Controller
            control={form.control}
            name="rarity"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger className="bg-secondary/50" data-testid="select-rarity">
                  <SelectValue placeholder="Select rarity" />
                </SelectTrigger>
                <SelectContent>
                  {RARITIES.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="theme">
            Collection / Theme
            <span className="ml-1.5 text-xs text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="theme"
            {...form.register("theme")}
            placeholder="e.g. Stoner Traits, 70s Vibes, TV Shows..."
            className="bg-secondary/50"
            data-testid="input-theme"
          />
          <p className="text-xs text-muted-foreground">
            Traits with the same collection name appear together as a tab in the Store.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="priceEth">Price (ETH)</Label>
          <Input
            id="priceEth"
            {...form.register("priceEth")}
            placeholder="0.05"
            className="bg-secondary/50 font-mono"
            data-testid="input-price"
          />
          {form.formState.errors.priceEth && (
            <p className="text-xs text-destructive">
              {form.formState.errors.priceEth.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="totalSupply">Total Supply</Label>
          <Input
            id="totalSupply"
            type="number"
            {...form.register("totalSupply")}
            className="bg-secondary/50"
            data-testid="input-supply"
          />
          {form.formState.errors.totalSupply && (
            <p className="text-xs text-destructive">
              {form.formState.errors.totalSupply.message}
            </p>
          )}
        </div>

        <div className="flex flex-col justify-center pt-5 space-y-2">
          <div className="flex items-center gap-2">
            <Controller
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <Switch
                  id="isActive"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="switch-isActive"
                />
              )}
            />
            <Label htmlFor="isActive">Active (available for purchase)</Label>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Trait Media</Label>
        <TraitImageUploader
          currentImageUrl={form.watch("imageUrl")}
          onUploadComplete={(url) => form.setValue("imageUrl", url, { shouldDirty: true })}
          onClear={() => { form.setValue("imageUrl", "", { shouldDirty: true }); form.setValue("mediaType", "image", { shouldDirty: true }); }}
          onMediaTypeChange={(mt) => form.setValue("mediaType", mt, { shouldDirty: true })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          {...form.register("description")}
          className="bg-secondary/50 resize-none h-20"
          data-testid="input-description"
        />
      </div>

      {/* ── Payout Splits ────────────────────────────────────────────── */}
      <Separator />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" />
              Payout Splits
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Distribute sale proceeds across multiple wallets. Percentages must add up to 100%.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ walletAddress: "", percentage: 100 })}
            className="shrink-0"
            data-testid="button-add-split"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Wallet
          </Button>
        </div>

        {fields.length === 0 && (
          <div className="rounded-lg border border-dashed border-border/60 px-4 py-5 text-center text-sm text-muted-foreground">
            No payout splits configured. All funds go to the contract owner by default.
          </div>
        )}

        <div className="space-y-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="flex gap-3 items-start rounded-lg bg-secondary/30 border border-border/40 p-3"
              data-testid={`payout-split-row-${index}`}
            >
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-muted-foreground">Wallet Address</Label>
                <Input
                  {...form.register(`payoutSplits.${index}.walletAddress`)}
                  placeholder="0x..."
                  className="bg-background/60 font-mono text-sm h-9"
                  data-testid={`input-split-wallet-${index}`}
                />
                {form.formState.errors.payoutSplits?.[index]?.walletAddress && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.payoutSplits[index]?.walletAddress?.message}
                  </p>
                )}
              </div>

              <div className="w-28 space-y-1">
                <Label className="text-xs text-muted-foreground">Percentage</Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="100"
                    {...form.register(`payoutSplits.${index}.percentage`)}
                    className="bg-background/60 h-9 pr-7"
                    data-testid={`input-split-pct-${index}`}
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                    %
                  </span>
                </div>
                {form.formState.errors.payoutSplits?.[index]?.percentage && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.payoutSplits[index]?.percentage?.message}
                  </p>
                )}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(index)}
                className="mt-5 h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                data-testid={`button-remove-split-${index}`}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Running total indicator */}
        {fields.length > 0 && (
          <div
            className={`flex items-center gap-2 text-sm px-1 ${
              totalOk ? "text-green-400" : "text-amber-400"
            }`}
          >
            {totalOk ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span>
              Total: <strong>{total.toFixed(2)}%</strong>
              {!totalOk && " — must equal 100%"}
            </span>
          </div>
        )}

        {form.formState.errors.payoutSplits &&
          !Array.isArray(form.formState.errors.payoutSplits) && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {(form.formState.errors.payoutSplits as { message?: string })?.message}
            </p>
          )}
      </div>

      <Button
        type="submit"
        className="w-full bg-primary hover:bg-primary/90"
        disabled={isSubmitting}
        data-testid="button-save-trait"
      >
        {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Save Trait"}
      </Button>
    </form>
  );
}
