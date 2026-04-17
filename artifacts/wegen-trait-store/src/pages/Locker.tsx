import { useWallet } from "@/contexts/WalletContext";
import { WalletConnectGuard } from "@/components/shared/WalletConnectGuard";
import { useGetLocker, getGetLockerQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Fingerprint } from "lucide-react";
import { format } from "date-fns";

export function Locker() {
  return (
    <WalletConnectGuard message="Connect your wallet to view your purchased traits.">
      <LockerContent />
    </WalletConnectGuard>
  );
}

function LockerContent() {
  const { walletAddress } = useWallet();
  
  const { data: lockerData, isLoading } = useGetLocker(walletAddress || "", {
    query: {
      enabled: !!walletAddress,
      queryKey: getGetLockerQueryKey(walletAddress || "")
    }
  });

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.5)]';
      case 'rare': return 'bg-blue-500/20 text-blue-500 border-blue-500/50';
      case 'uncommon': return 'bg-green-500/20 text-green-500 border-green-500/50';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">
          Trait Locker
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Your personal vault of acquired traits. These can be equipped to your Wegen NFTs.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-card border-border/50">
              <Skeleton className="h-40 w-full rounded-none" />
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : lockerData?.items?.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-border/50 rounded-xl bg-card/30">
          <div className="w-20 h-20 rounded-full bg-secondary mx-auto flex items-center justify-center mb-6">
            <Package className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-2xl font-bold mb-2">Your Locker is Empty</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            You haven't purchased any traits yet. Head over to the store to acquire some exclusive artifacts.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {lockerData?.items?.map((item, index) => (
            <Card 
              key={item.id} 
              className="bg-card/50 border-border/50 overflow-hidden relative group"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {item.equippedToTokenId !== null && (
                <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden z-10">
                  <div className="bg-primary text-white text-[10px] font-bold uppercase tracking-wider py-1 text-center w-24 transform rotate-45 absolute top-3 -right-6 shadow-md">
                    Equipped
                  </div>
                </div>
              )}
              
              <div className="relative aspect-square overflow-hidden bg-secondary/50 flex items-center justify-center p-8">
                {item.trait.imageUrl ? (
                  <img 
                    src={item.trait.imageUrl} 
                    alt={item.trait.name} 
                    className={`w-full h-full object-contain drop-shadow-2xl ${item.equippedToTokenId ? 'opacity-50 grayscale' : ''}`}
                  />
                ) : (
                  <div className="text-6xl font-black text-muted-foreground/20 uppercase tracking-tighter mix-blend-overlay">
                    {item.trait.category.slice(0, 3)}
                  </div>
                )}
                
                <div className="absolute bottom-3 left-3 flex gap-2">
                  <Badge variant="outline" className={`uppercase tracking-wider text-[10px] font-bold px-2 py-1 ${getRarityColor(item.trait.rarity)}`}>
                    {item.trait.rarity}
                  </Badge>
                </div>
              </div>
              
              <CardContent className="p-5 flex flex-col h-[140px]">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="text-lg font-bold tracking-tight line-clamp-1">{item.trait.name}</h3>
                  <div className="bg-secondary text-foreground text-xs font-mono px-2 py-0.5 rounded-sm shrink-0 ml-2">
                    x{item.quantity}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground uppercase tracking-widest text-[10px] font-bold mb-4">
                  {item.trait.category}
                </div>
                
                <div className="mt-auto pt-4 border-t border-border/20 text-xs text-muted-foreground flex flex-col gap-1.5">
                  <div className="flex justify-between">
                    <span>Acquired:</span>
                    <span>{format(new Date(item.purchasedAt), "MMM d, yyyy")}</span>
                  </div>
                  {item.equippedToTokenId && (
                    <div className="flex justify-between text-primary/80">
                      <span className="flex items-center gap-1"><Fingerprint className="w-3 h-3" /> Token ID:</span>
                      <span className="font-mono">#{item.equippedToTokenId}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
