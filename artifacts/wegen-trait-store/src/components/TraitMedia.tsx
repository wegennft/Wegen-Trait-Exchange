import { Music, Play } from "lucide-react";

type MediaType = "image" | "gif" | "video" | "audio" | string | null | undefined;

interface TraitMediaProps {
  url: string | null | undefined;
  mediaType?: MediaType;
  alt?: string;
  className?: string;
  /** Show a compact badge overlay for the type */
  showBadge?: boolean;
  /** For videos: whether to autoplay (muted) */
  autoPlay?: boolean;
}

function getMediaType(url: string | null | undefined, hint?: MediaType): "image" | "gif" | "video" | "audio" {
  if (hint && hint !== "image") return hint as "image" | "gif" | "video" | "audio";
  if (!url) return "image";
  const lower = url.toLowerCase().split("?")[0];
  if (lower.endsWith(".gif")) return "gif";
  if (lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov")) return "video";
  if (lower.endsWith(".mp3") || lower.endsWith(".wav") || lower.endsWith(".ogg") || lower.endsWith(".m4a")) return "audio";
  return "image";
}

export function TraitMedia({ url, mediaType, alt = "Trait", className = "", showBadge = false, autoPlay = true }: TraitMediaProps) {
  const type = getMediaType(url, mediaType);

  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-secondary/30 text-muted-foreground/40 ${className}`}>
        <Play className="w-6 h-6" />
      </div>
    );
  }

  const badge = showBadge ? (
    <span
      className="absolute top-1 right-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
      style={{
        background: type === "video" ? "rgba(157,0,255,0.85)" : type === "audio" ? "rgba(20,160,80,0.85)" : type === "gif" ? "rgba(200,120,0,0.85)" : "transparent",
        color: "white",
        display: type === "image" ? "none" : "block",
        pointerEvents: "none",
      }}
    >
      {type === "gif" ? "GIF" : type === "video" ? "MP4" : type === "audio" ? "AUD" : ""}
    </span>
  ) : null;

  if (type === "gif" || type === "image") {
    return (
      <div className={`relative ${className}`} style={{ position: "relative" }}>
        <img src={url} alt={alt} className="w-full h-full object-contain" />
        {badge}
      </div>
    );
  }

  if (type === "video") {
    return (
      <div className={`relative ${className}`} style={{ position: "relative" }}>
        <video
          src={url}
          className="w-full h-full object-contain"
          autoPlay={autoPlay}
          loop
          muted
          playsInline
        />
        {badge}
      </div>
    );
  }

  if (type === "audio") {
    return (
      <div className={`relative flex flex-col items-center justify-center gap-2 bg-secondary/20 ${className}`}>
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Music className="w-5 h-5 text-primary" />
          </div>
          <audio
            src={url}
            controls
            className="w-full max-w-[140px]"
            style={{ height: "28px", minWidth: "100px" }}
          />
        </div>
        {badge}
      </div>
    );
  }

  return <img src={url} alt={alt} className={`object-contain ${className}`} />;
}
