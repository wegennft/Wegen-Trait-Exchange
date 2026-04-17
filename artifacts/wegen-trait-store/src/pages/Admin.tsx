import { useState } from "react";
import { 
  useGetAdminStats, 
  useListTraits, 
  useCreateTrait, 
  useUpdateTrait,
  useDeleteTrait,
  getListTraitsQueryKey,
  getGetAdminStatsQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, Package, DollarSign, Activity, Loader2, Plus, Edit, Trash2 } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trait } from "@workspace/api-client-react/src/generated/api.schemas";

const traitSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  priceEth: z.string().regex(/^\d+(\.\d+)?$/, "Must be a valid number"),
  totalSupply: z.coerce.number().min(1),
  rarity: z.enum(["common", "uncommon", "rare", "legendary"]),
  isActive: z.boolean().default(true),
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
      onError: () => toast({ title: "Failed to create trait", variant: "destructive" })
    }
  });

  const updateTrait = useUpdateTrait({
    mutation: {
      onSuccess: () => {
        toast({ title: "Trait updated successfully" });
        setEditingTrait(null);
        queryClient.invalidateQueries({ queryKey: getListTraitsQueryKey() });
      },
      onError: () => toast({ title: "Failed to update trait", variant: "destructive" })
    }
  });

  const deleteTrait = useDeleteTrait({
    mutation: {
      onSuccess: () => {
        toast({ title: "Trait deleted successfully" });
        queryClient.invalidateQueries({ queryKey: getListTraitsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
      },
      onError: () => toast({ title: "Failed to delete trait", variant: "destructive" })
    }
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
        rarity: data.rarity
      }
    });
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage traits, view sales, and monitor store activity.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <DollarSign className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoadingStats ? "..." : `${stats?.totalRevenue} ETH`}</div>
            <p className="text-xs text-muted-foreground mt-1">From {stats?.totalSales} sales</p>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Traits</CardTitle>
            <Package className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoadingStats ? "..." : stats?.activeTraits}</div>
            <p className="text-xs text-muted-foreground mt-1">Out of {stats?.totalTraits} total traits</p>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Out of Stock</CardTitle>
            <Activity className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoadingStats ? "..." : stats?.outOfStockTraits}</div>
            <p className="text-xs text-muted-foreground mt-1">Traits needing supply update</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Top Seller</CardTitle>
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Trait</DialogTitle>
            </DialogHeader>
            <TraitForm onSubmit={handleCreate} isSubmitting={createTrait.isPending} />
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
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingTraits ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></TableCell>
                </TableRow>
              ) : traitsData?.traits?.map((trait) => (
                <TableRow key={trait.id} className="border-border/50">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      {trait.imageUrl ? (
                        <img src={trait.imageUrl} alt={trait.name} className="w-8 h-8 rounded bg-secondary/50 object-contain" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center text-xs font-bold">{trait.name[0]}</div>
                      )}
                      <div>
                        {trait.name}
                        <div className="text-[10px] text-muted-foreground uppercase">{trait.rarity}</div>
                      </div>
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
                    <Switch 
                      checked={trait.isActive} 
                      onCheckedChange={(checked) => updateTrait.mutate({ traitId: trait.id, data: { isActive: checked }})}
                      disabled={updateTrait.isPending}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Dialog open={editingTrait?.id === trait.id} onOpenChange={(open) => !open && setEditingTrait(null)}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => setEditingTrait(trait)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Edit Trait: {trait.name}</DialogTitle>
                          </DialogHeader>
                          {editingTrait?.id === trait.id && (
                            <TraitForm 
                              defaultValues={trait} 
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
                          if (confirm("Are you sure you want to delete this trait?")) {
                            deleteTrait.mutate({ traitId: trait.id });
                          }
                        }}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

// Form Component
function TraitForm({ defaultValues, onSubmit, isSubmitting }: { 
  defaultValues?: Partial<TraitFormValues>, 
  onSubmit: (data: TraitFormValues) => void,
  isSubmitting: boolean 
}) {
  const form = useForm<TraitFormValues>({
    resolver: zodResolver(traitSchema),
    defaultValues: {
      name: defaultValues?.name || "",
      category: defaultValues?.category || "",
      description: defaultValues?.description || "",
      imageUrl: defaultValues?.imageUrl || "",
      priceEth: defaultValues?.priceEth || "0.01",
      totalSupply: defaultValues?.totalSupply || 100,
      rarity: defaultValues?.rarity || "common",
      isActive: defaultValues?.isActive ?? true,
    }
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" {...form.register("name")} placeholder="e.g. Neon Visor" className="bg-secondary/50" />
          {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Input id="category" {...form.register("category")} placeholder="e.g. headwear" className="bg-secondary/50" />
          {form.formState.errors.category && <p className="text-sm text-destructive">{form.formState.errors.category.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="priceEth">Price (ETH)</Label>
          <Input id="priceEth" {...form.register("priceEth")} placeholder="0.05" className="bg-secondary/50 font-mono" />
          {form.formState.errors.priceEth && <p className="text-sm text-destructive">{form.formState.errors.priceEth.message}</p>}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="totalSupply">Total Supply</Label>
          <Input id="totalSupply" type="number" {...form.register("totalSupply")} className="bg-secondary/50" />
          {form.formState.errors.totalSupply && <p className="text-sm text-destructive">{form.formState.errors.totalSupply.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>Rarity</Label>
          <Controller
            control={form.control}
            name="rarity"
            render={({ field }) => (
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <SelectTrigger className="bg-secondary/50">
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
        
        <div className="space-y-2 flex flex-col justify-center pt-6">
          <div className="flex items-center space-x-2">
            <Controller
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <Switch 
                  id="isActive" 
                  checked={field.value} 
                  onCheckedChange={field.onChange} 
                />
              )}
            />
            <Label htmlFor="isActive">Active (Available for purchase)</Label>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="imageUrl">Image URL (Optional)</Label>
        <Input id="imageUrl" {...form.register("imageUrl")} placeholder="https://..." className="bg-secondary/50" />
        {form.formState.errors.imageUrl && <p className="text-sm text-destructive">{form.formState.errors.imageUrl.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (Optional)</Label>
        <Textarea id="description" {...form.register("description")} className="bg-secondary/50 resize-none h-24" />
      </div>

      <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Save Trait"}
      </Button>
    </form>
  );
}
