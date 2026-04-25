import { useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { WalletConnectGuard } from "@/components/shared/WalletConnectGuard";
import { 
  useGetUserNfts, 
  useGetLocker,
  useApplyTrait,
  useRemoveTrait,
  getGetUserNftsQueryKey,
  getGetLockerQueryKey
} from "@workspace/api-client-react";
import { WegenNft, LockerItem } from "@workspace/api-client-react/src/generated/api.schemas";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Fingerprint, Gem, Plus, X, Loader2 } from "lucide-react";

export function Nfts() {
  return (
    <WalletConnectGuard message="Connect your wallet to view and customize your Wegen NFTs.">
      <NftsContent />
    </WalletConnectGuard>
  );
}

function NftsContent() {
  const [selectedNft, setSelectedNft] = useState<WegenNft | null>(null);
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>("all");
  
  const { walletAddress } = useWallet();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: nftsData, isLoading: isLoadingNfts } = useGetUserNfts(walletAddress || "", {
    query: {
      enabled: !!walletAddress,
      queryKey: getGetUserNftsQueryKey(walletAddress || "")
    }
  });

  const { data: lockerData, isLoading: isLoadingLocker } = useGetLocker(walletAddress || "", {
    query: {
      enabled: !!walletAddress,
      queryKey: getGetLockerQueryKey(walletAddress || "")
    }
  });

  const applyTrait = useApplyTrait({
    mutation: {
      onSuccess: (_data, variables) => {
        const isReplacing = selectedNft?.equippedTraits.some(
          et => {
            const item = lockerData?.items?.find(i => i.id === variables.data.lockerItemId);
            return item && et.category === item.trait.category;
          }
        );
        toast({
          title: isReplacing ? "Trait Swapped" : "Trait Equipped",
          description: isReplacing
            ? "The previous trait was returned to your locker."
            : "The trait has been equipped to your NFT.",
        });
        queryClient.invalidateQueries({ queryKey: getGetUserNftsQueryKey(walletAddress || "") });
        queryClient.invalidateQueries({ queryKey: getGetLockerQueryKey(walletAddress || "") });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to apply trait.",
          variant: "destructive",
        });
      }
    }
  });

  const removeTrait = useRemoveTrait({
    mutation: {
      onSuccess: () => {
        toast({
          title: "Trait Removed",
          description: "The trait has been returned to your locker.",
        });
        queryClient.invalidateQueries({ queryKey: getGetUserNftsQueryKey(walletAddress || "") });
        queryClient.invalidateQueries({ queryKey: getGetLockerQueryKey(walletAddress || "") });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to remove trait.",
          variant: "destructive",
        });
      }
    }
  });

  const handleApplyTrait = (lockerItem: LockerItem) => {
    if (!selectedNft || !walletAddress) return;
    
    applyTrait.mutate({
      tokenId: selectedNft.tokenId,
      data: {
        lockerItemId: lockerItem.id,
        walletAddress
      }
    });
  };

  const handleRemoveTrait = (nft: WegenNft, category: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!walletAddress) return;
    
    removeTrait.mutate({
      tokenId: nft.tokenId,
      data: {
        category,
        walletAddress
      }
    });
  };

  // Find categories available in locker for the selected NFT
  const availableLockerItems = lockerData?.items?.filter(item => item.equippedToTokenId === null) || [];
  const categories = Array.from(new Set(availableLockerItems.map(item => item.trait.category)));

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'text-yellow-500';
      case 'rare': return 'text-blue-500';
      case 'uncommon': return 'text-green-500';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">
          My Wegens
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          View your Wegen NFTs and customize them with traits from your locker.
        </p>
      </div>

      {isLoadingNfts ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-card border-border/50">
              <Skeleton className="h-[400px] w-full rounded-none" />
              <CardContent className="p-6">
                <Skeleton className="h-8 w-3/4 mb-4" />
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : nftsData?.nfts?.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-border/50 rounded-xl bg-card/90">
          <div className="w-20 h-20 rounded-full bg-secondary mx-auto flex items-center justify-center mb-6">
            <Gem className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-2xl font-bold mb-2">No Wegens Found</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            We couldn't find any Wegen NFTs in your connected wallet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {nftsData?.nfts?.map((nft) => (
            <Card key={nft.tokenId} className="bg-card/90 border-border/60 overflow-hidden flex flex-col group relative">
              <div className="absolute top-4 left-4 z-10">
                <Badge variant="secondary" className="bg-black/60 backdrop-blur-md font-mono">
                  <Fingerprint className="w-3 h-3 mr-1" />
                  #{nft.tokenId}
                </Badge>
              </div>
              
              <div className="relative aspect-[3/4] bg-secondary/30 overflow-hidden p-6 flex flex-col items-center justify-center">
                {/* Base NFT Image or Placeholder */}
                {nft.imageUrl ? (
                  <img src={nft.imageUrl} alt={nft.name} className="absolute inset-0 w-full h-full object-cover z-0" />
                ) : (
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-secondary to-background z-0 flex items-center justify-center">
                    <Gem className="w-24 h-24 text-muted-foreground/20" />
                  </div>
                )}
                
                {/* Equipped Traits Overlay Visualization */}
                <div className="relative z-10 w-full h-full flex flex-col justify-end gap-2 p-2">
                  {nft.equippedTraits.map(et => (
                    <div key={et.category} className="bg-black/70 backdrop-blur-md rounded-md p-2 flex items-center gap-3 border border-white/10 group/trait">
                      {et.trait.imageUrl ? (
                        <img src={et.trait.imageUrl} alt={et.trait.name} className="w-8 h-8 object-contain rounded" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center text-xs font-bold uppercase">
                          {et.category[0]}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-bold truncate ${getRarityColor(et.trait.rarity)}`}>{et.trait.name}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{et.category}</div>
                      </div>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={(e) => handleRemoveTrait(nft, et.category, e)}
                        disabled={removeTrait.isPending}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              
              <CardContent className="p-6 flex flex-col flex-1 border-t border-border/50 bg-card">
                <h3 className="text-2xl font-bold mb-6 tracking-tight">{nft.name}</h3>
                
                <div className="mt-auto">
                  <Button 
                    onClick={() => setSelectedNft(nft)}
                    className="w-full bg-secondary text-foreground hover:bg-primary hover:text-white transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Equip Traits
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Trait Application Dialog */}
      <Dialog open={!!selectedNft} onOpenChange={(open) => !open && setSelectedNft(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="text-2xl">Equip Traits to {selectedNft?.name}</DialogTitle>
            <DialogDescription>
              Select traits from your locker to equip. Replacing a category automatically returns the previous trait to your locker — nothing is ever lost.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden flex flex-col pt-4">
            <Tabs defaultValue="all" className="flex-1 flex flex-col h-full" value={activeCategoryTab} onValueChange={setActiveCategoryTab}>
              <TabsList className="w-full justify-start overflow-x-auto rounded-none border-b border-border bg-transparent p-0 h-auto hide-scrollbar">
                <TabsTrigger 
                  value="all" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                >
                  All Traits
                </TabsTrigger>
                {categories.map(cat => (
                  <TabsTrigger 
                    key={cat} 
                    value={cat}
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 capitalize"
                  >
                    {cat}
                  </TabsTrigger>
                ))}
              </TabsList>
              
              <div className="flex-1 overflow-y-auto p-4 hide-scrollbar">
                {isLoadingLocker ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : availableLockerItems.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    You have no available traits in your locker to equip.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {availableLockerItems
                      .filter(item => activeCategoryTab === "all" || item.trait.category === activeCategoryTab)
                      .map(item => {
                        // Check if this category is already equipped on this NFT
                        const isCategoryOccupied = selectedNft?.equippedTraits.some(et => et.category === item.trait.category);
                        const isPending = applyTrait.isPending && applyTrait.variables?.data.lockerItemId === item.id;
                        
                        return (
                          <div key={item.id} className="border border-border/50 rounded-lg bg-secondary/20 overflow-hidden flex flex-col group hover:border-primary/50 transition-colors">
                            <div className="aspect-square p-4 flex items-center justify-center bg-secondary/40 relative">
                              {item.trait.imageUrl ? (
                                <img src={item.trait.imageUrl} alt={item.trait.name} className="w-full h-full object-contain" />
                              ) : (
                                <div className="text-4xl font-black text-muted-foreground/20 uppercase tracking-tighter mix-blend-overlay">
                                  {item.trait.category.slice(0, 3)}
                                </div>
                              )}
                              <Badge variant="outline" className={`absolute top-2 right-2 text-[8px] uppercase px-1 py-0 ${getRarityColor(item.trait.rarity)} border-current`}>
                                {item.trait.rarity}
                              </Badge>
                            </div>
                            <div className="p-3 flex-1 flex flex-col">
                              <div className="font-bold text-sm mb-1 truncate">{item.trait.name}</div>
                              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">{item.trait.category}</div>
                              
                              <Button 
                                size="sm" 
                                className={`w-full mt-auto ${isCategoryOccupied ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-primary hover:bg-primary/90 text-white'}`}
                                onClick={() => handleApplyTrait(item)}
                                disabled={isPending || applyTrait.isPending}
                              >
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : isCategoryOccupied ? "Replace" : "Equip"}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
