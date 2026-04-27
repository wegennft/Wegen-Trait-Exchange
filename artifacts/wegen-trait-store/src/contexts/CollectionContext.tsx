import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export type NftCollection = "wegens" | "wegenettes";

export interface CollectionTheme {
  accent: string;
  accent2: string;
  accentHsl: string;
  accent2Hsl: string;
  glow: string;
  glow2: string;
  gradient: string;
  gradient2: string;
}

export const COLLECTION_THEMES: Record<NftCollection, CollectionTheme> = {
  wegens: {
    accent:    "hsl(272 100% 62%)",
    accent2:   "hsl(272 100% 62%)",
    accentHsl: "272 100% 62%",
    accent2Hsl:"272 100% 62%",
    glow:      "hsl(272 100% 62% / 0.3)",
    glow2:     "hsl(272 100% 62% / 0.15)",
    gradient:  "linear-gradient(135deg, hsl(272 100% 62%), hsl(272 100% 50%))",
    gradient2: "linear-gradient(135deg, hsl(272 100% 62% / 0.25), hsl(272 100% 50% / 0.1))",
  },
  wegenettes: {
    accent:    "hsl(320 100% 60%)",
    accent2:   "hsl(272 100% 62%)",
    accentHsl: "320 100% 60%",
    accent2Hsl:"272 100% 62%",
    glow:      "hsl(320 100% 60% / 0.35)",
    glow2:     "hsl(320 100% 60% / 0.15)",
    gradient:  "linear-gradient(135deg, hsl(320 100% 60%), hsl(272 100% 62%))",
    gradient2: "linear-gradient(135deg, hsl(320 100% 60% / 0.25), hsl(272 100% 62% / 0.1))",
  },
};

interface CollectionContextValue {
  collection: NftCollection;
  collectionLabel: string;
  setCollection: (c: NftCollection) => void;
  theme: CollectionTheme;
}

const CollectionContext = createContext<CollectionContextValue>({
  collection: "wegens",
  collectionLabel: "Wegens",
  setCollection: () => {},
  theme: COLLECTION_THEMES.wegens,
});

function getLabel(c: NftCollection) {
  return c === "wegenettes" ? "Wegenettes" : "Wegens";
}

function readFromUrl(): NftCollection {
  if (typeof window === "undefined") return "wegens";
  const params = new URLSearchParams(window.location.search);
  const c = params.get("c");
  return c === "wegenettes" ? "wegenettes" : "wegens";
}

function writeToUrl(c: NftCollection) {
  const url = new URL(window.location.href);
  if (c === "wegens") {
    url.searchParams.delete("c");
  } else {
    url.searchParams.set("c", c);
  }
  window.history.replaceState({}, "", url.toString());
}

const WEGENETTES_BG_IMAGE = [
  "radial-gradient(ellipse 900px 600px at 15% 10%, hsl(320 100% 50% / 0.18) 0%, transparent 65%)",
  "radial-gradient(ellipse 600px 700px at 92% 6%, hsl(272 100% 55% / 0.16) 0%, transparent 60%)",
  "radial-gradient(ellipse 700px 400px at 50% 100%, hsl(320 100% 38% / 0.14) 0%, transparent 70%)",
  "radial-gradient(ellipse 500px 350px at 5% 88%, hsl(272 100% 52% / 0.12) 0%, transparent 70%)",
  "radial-gradient(ellipse 400px 400px at 75% 55%, hsl(272 100% 45% / 0.08) 0%, transparent 65%)",
  "repeating-linear-gradient(0deg, transparent 0px, transparent 28px, hsl(320 30% 8% / 0.55) 28px, hsl(320 30% 8% / 0.55) 29px)",
  "repeating-linear-gradient(90deg, transparent 0px, transparent 56px, hsl(272 30% 8% / 0.35) 56px, hsl(272 30% 8% / 0.35) 57px)",
].join(", ");

const WEGENS_BG_IMAGE = [
  "radial-gradient(ellipse 900px 600px at 15% 10%, hsl(272 100% 45% / 0.18) 0%, transparent 65%)",
  "radial-gradient(ellipse 500px 700px at 90% 8%, hsl(43 100% 48% / 0.09) 0%, transparent 60%)",
  "radial-gradient(ellipse 700px 400px at 50% 100%, hsl(272 100% 35% / 0.15) 0%, transparent 70%)",
  "radial-gradient(ellipse 450px 350px at 5% 88%, hsl(43 100% 52% / 0.1) 0%, transparent 70%)",
  "repeating-linear-gradient(0deg, transparent 0px, transparent 28px, hsl(0 10% 8% / 0.55) 28px, hsl(0 10% 8% / 0.55) 29px)",
  "repeating-linear-gradient(90deg, transparent 0px, transparent 56px, hsl(0 10% 8% / 0.35) 56px, hsl(0 10% 8% / 0.35) 57px)",
].join(", ");

const WEGENETTES_VARS = {
  "--primary":    "320 100% 55%",
  "--ring":       "320 100% 55%",
  "--background": "300 30% 2%",
  "--card":       "300 25% 4%",
  "--popover":    "300 25% 4%",
  "--secondary":  "300 25% 8%",
  "--muted":      "295 20% 11%",
  "--input":      "295 20% 9%",
} as const;

const WEGENS_VARS = {
  "--primary":    "272 100% 62%",
  "--ring":       "272 100% 62%",
  "--background": "270 45% 2%",
  "--card":       "270 30% 4%",
  "--popover":    "270 30% 4%",
  "--secondary":  "270 30% 7%",
  "--muted":      "270 20% 10%",
  "--input":      "270 25% 8%",
} as const;

function applyCollectionTheme(c: NftCollection) {
  const root = document.documentElement;
  const body = document.body;

  const vars = c === "wegenettes" ? WEGENETTES_VARS : WEGENS_VARS;
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
  }

  const bgColor = c === "wegenettes" ? "hsl(300 30% 2%)" : "hsl(270 45% 2%)";
  const bgImage = c === "wegenettes" ? WEGENETTES_BG_IMAGE : WEGENS_BG_IMAGE;
  body.style.setProperty("background-color", bgColor);
  body.style.setProperty("background-image", bgImage);

  let styleEl = document.getElementById("__collection-theme") as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "__collection-theme";
    document.head.appendChild(styleEl);
  }
  if (c === "wegenettes") {
    styleEl.textContent = `
      :root, :root.dark {
        --primary: 320 100% 55% !important;
        --ring: 320 100% 55% !important;
        --background: 300 30% 2% !important;
        --card: 300 25% 4% !important;
        --popover: 300 25% 4% !important;
        --secondary: 300 25% 8% !important;
        --muted: 295 20% 11% !important;
        --input: 295 20% 9% !important;
      }
      body {
        background-color: hsl(300 30% 2%) !important;
        background-image: ${WEGENETTES_BG_IMAGE} !important;
      }
    `;
  } else {
    styleEl.textContent = `
      :root, :root.dark {
        --primary: 272 100% 62% !important;
        --ring: 272 100% 62% !important;
        --background: 270 45% 2% !important;
        --card: 270 30% 4% !important;
        --popover: 270 30% 4% !important;
        --secondary: 270 30% 7% !important;
        --muted: 270 20% 10% !important;
        --input: 270 25% 8% !important;
      }
      body {
        background-color: hsl(270 45% 2%) !important;
        background-image: ${WEGENS_BG_IMAGE} !important;
      }
    `;
  }
}

export function CollectionProvider({ children }: { children: ReactNode }) {
  const [collection, setCollectionState] = useState<NftCollection>(() => {
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const urlParam = params?.get("c");
    let c: NftCollection;
    if (urlParam === "wegenettes") {
      c = "wegenettes";
    } else if (urlParam === "wegens") {
      c = "wegens";
    } else {
      c = localStorage.getItem("nftCollection") === "wegenettes" ? "wegenettes" : "wegens";
    }
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-collection", c);
      applyCollectionTheme(c);
    }
    return c;
  });

  useEffect(() => {
    writeToUrl(collection);
    localStorage.setItem("nftCollection", collection);
    document.documentElement.setAttribute("data-collection", collection);
    applyCollectionTheme(collection);
  }, [collection]);

  const setCollection = useCallback((c: NftCollection) => {
    setCollectionState(c);
  }, []);

  return (
    <CollectionContext.Provider value={{
      collection,
      collectionLabel: getLabel(collection),
      setCollection,
      theme: COLLECTION_THEMES[collection],
    }}>
      {children}
    </CollectionContext.Provider>
  );
}

export function useCollection() {
  return useContext(CollectionContext);
}
