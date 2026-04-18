import { useState, useRef } from "react";
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
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Trait } from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { useSiteSettings, DEFAULT_COLORS } from "@/contexts/SiteSettingsContext";

const CATEGORIES = ["Background", "Body", "Clothes", "Eyes", "Headgear", "Mouth"];

const payoutSplitSchema = z.object({
  walletAddress: z.string().min(1, "Wallet address required"),
  percentage: z.coerce
    .number()
    .min(0.01, "Must be > 0")
    .max(100, "Max 100"),
});

const traitSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  theme: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  priceEth: z.string().regex(/^\d+(\.\d+)?$/, "Must be a valid number e.g. 0.05"),
  totalSupply: z.coerce.number().min(1, "Supply must be at least 1"),
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

export function Admin() {
  const { data: stats, isLoading: isLoadingStats } = useGetAdminStats();
  const { data: traitsData, isLoading: isLoadingTraits } = useListTraits();

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTrait, setEditingTrait] = useState<Trait | null>(null);

  const createTrait = useCreateTrait({
    mutation: {
      onSuccess: () => {
        toast({ title: "Trait created successfully" });
        setIsCreateOpen(false);
        queryClient.invalidateQueries({ queryKey: getListTraitsQueryKey() });
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
        queryClient.invalidateQueries({ queryKey: getListTraitsQueryKey() });
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
        queryClient.invalidateQueries({ queryKey: getListTraitsQueryKey() });
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
        priceEth: data.priceEth,
        totalSupply: data.totalSupply,
        isActive: data.isActive,
        theme: data.theme || undefined,
        payoutSplits: data.payoutSplits,
      },
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

      <div className="flex items-center justify-between mt-12 mb-4">
        <h2 className="text-2xl font-bold tracking-tight">Trait Management</h2>
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

      <Card className="bg-card border-border/50">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
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
              {isLoadingTraits ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : (
                traitsData?.traits?.map((trait) => (
                  <TableRow key={trait.id} className="border-border/50">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        {trait.imageUrl ? (
                          <img
                            src={trait.imageUrl}
                            alt={trait.name}
                            className="w-8 h-8 rounded bg-secondary/50 object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center text-xs font-bold">
                            {trait.name[0]}
                          </div>
                        )}
                        <div>
                          {trait.name}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{trait.category}</TableCell>
                    <TableCell className="font-mono text-sm">{trait.priceEth}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span
                          className={
                            trait.remainingSupply === 0 ? "text-destructive font-bold" : ""
                          }
                        >
                          {trait.remainingSupply}
                        </span>
                        <span className="text-muted-foreground"> / {trait.totalSupply}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <PayoutSplitsSummary splits={trait.payoutSplits ?? []} />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={trait.isActive}
                        onCheckedChange={(checked) =>
                          updateTrait.mutate({
                            traitId: trait.id,
                            data: { isActive: checked },
                          })
                        }
                        disabled={updateTrait.isPending}
                        data-testid={`switch-active-${trait.id}`}
                      />
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
                ))
              )}
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
      </Tabs>
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
              <span className="text-xs text-muted-foreground font-normal ml-auto">200 × 200</span>
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
                  <p className="text-[10px] text-muted-foreground/60 mt-1">200×200 recommended</p>
                </div>
              )}
            </div>
            <input
              ref={logoRef}
              type="file"
              accept="image/*"
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
              <span className="text-xs text-muted-foreground font-normal ml-auto">Any size</span>
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
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Full-page background</p>
                </div>
              )}
            </div>
            <input
              ref={bgRef}
              type="file"
              accept="image/*"
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
              <span className="ml-auto text-2xl font-black text-primary" style={{ fontFamily: "'Bangers', Impact, sans-serif", letterSpacing: '0.05em' }}>
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
              <span className="ml-auto text-2xl font-black text-accent" style={{ fontFamily: "'Bangers', Impact, sans-serif", letterSpacing: '0.05em' }}>
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

// ── Image uploader for trait JPEG images ─────────────────────────────────────
function TraitImageUploader({
  currentImageUrl,
  onUploadComplete,
  onClear,
}: {
  currentImageUrl?: string;
  onUploadComplete: (url: string) => void;
  onClear: () => void;
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
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file (JPEG, PNG, etc.)", variant: "destructive" });
      return;
    }
    await uploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      {currentImageUrl ? (
        <div className="relative rounded-lg overflow-hidden border border-border/50 bg-secondary/30 group w-full aspect-square max-w-40">
          <img
            src={currentImageUrl}
            alt="Trait preview"
            className="w-full h-full object-contain p-2"
          />
          <button
            type="button"
            onClick={onClear}
            className="absolute top-1.5 right-1.5 bg-black/70 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
            aria-label="Remove image"
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
          aria-label="Upload image"
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
                <p className="text-sm font-medium">Click to upload JPEG</p>
                <p className="text-xs text-muted-foreground mt-0.5">JPEG, PNG, GIF, WebP</p>
              </div>
              <Button type="button" variant="outline" size="sm" className="gap-2">
                <Upload className="w-3.5 h-3.5" />
                Choose File
              </Button>
            </>
          )}
        </div>
      )}

      {!currentImageUrl && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
          disabled={isUploading}
          data-testid="input-image-file"
        />
      )}

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
          {isUploading ? "Uploading…" : "Replace Image"}
        </Button>
      )}

      {currentImageUrl && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
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
      priceEth: defaultValues?.priceEth ?? "0.01",
      totalSupply: defaultValues?.totalSupply ?? 100,
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
        <Label>Trait Image (JPEG)</Label>
        <TraitImageUploader
          currentImageUrl={form.watch("imageUrl")}
          onUploadComplete={(url) => form.setValue("imageUrl", url, { shouldDirty: true })}
          onClear={() => form.setValue("imageUrl", "", { shouldDirty: true })}
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
