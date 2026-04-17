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
} from "lucide-react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Trait } from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";

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
  rarity: z.enum(["common", "uncommon", "rare", "legendary"]),
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
        rarity: data.rarity,
        theme: data.theme || undefined,
        payoutSplits: data.payoutSplits,
      },
    });
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Manage traits, configure payout splits, and monitor store activity.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              Out of Stock
            </CardTitle>
            <Activity className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingStats ? "..." : stats?.outOfStockTraits}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Traits needing restock</p>
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
                          <div className="text-[10px] text-muted-foreground uppercase">
                            {trait.rarity}
                          </div>
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
      rarity: (defaultValues?.rarity as TraitFormValues["rarity"]) ?? "common",
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

        <div className="space-y-2 md:col-span-2">
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
                  <SelectItem value="common">Common</SelectItem>
                  <SelectItem value="uncommon">Uncommon</SelectItem>
                  <SelectItem value="rare">Rare</SelectItem>
                  <SelectItem value="legendary">Legendary</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
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
