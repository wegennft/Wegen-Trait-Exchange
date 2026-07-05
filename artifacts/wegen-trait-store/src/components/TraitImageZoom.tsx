import { useState, type MouseEvent, type ReactNode } from "react";
import { ZoomIn } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TraitMedia } from "@/components/TraitMedia";
import { cn } from "@/lib/utils";

interface TraitImageZoomProps {
  url: string | null | undefined;
  mediaType?: string | null;
  alt?: string;
  children: ReactNode;
  className?: string;
  /** Show a small magnifier hint icon on hover */
  showHint?: boolean;
}

export function TraitImageZoom({ url, mediaType, alt = "Trait", children, className, showHint = true }: TraitImageZoomProps) {
  const [open, setOpen] = useState(false);

  if (!url) {
    return <>{children}</>;
  }

  const handleOpen = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setOpen(true);
  };

  return (
    <>
      <div
        className={cn("relative cursor-zoom-in group/zoom", className)}
        onClick={handleOpen}
        role="button"
        aria-label={`View larger image of ${alt}`}
      >
        {children}
        {showHint && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/zoom:bg-black/30 transition-colors duration-200 pointer-events-none">
            <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover/zoom:opacity-90 scale-75 group-hover/zoom:scale-100 transition-all duration-200 drop-shadow-lg" />
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-3xl w-[92vw] sm:w-full bg-black/90 border-white/10 shadow-2xl p-4 flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <DialogDescription className="sr-only">Enlarged preview of {alt}</DialogDescription>
          <TraitMedia
            url={url}
            mediaType={mediaType}
            alt={alt}
            className="max-h-[78vh] w-full object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
