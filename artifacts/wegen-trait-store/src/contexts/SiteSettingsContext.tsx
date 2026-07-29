import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useCollection } from "@/contexts/CollectionContext";

export interface SiteColors {
  primary: string;
  secondary: string;
  text: string;
  headerLine: string;
  cardPanel: string;
}

export interface SiteSettings {
  logoUrl: string | null;
  backgroundUrl: string | null;
  bannerUrl: string | null;
  colors: SiteColors;
}

export const DEFAULT_COLORS: SiteColors = {
  primary: "#8800ee",
  secondary: "#17091f",
  text: "#f5ede0",
  headerLine: "#c8920a",
  cardPanel: "#110714",
};

const SETTINGS_VERSION = 4;

const DEFAULT_SETTINGS: SiteSettings = {
  logoUrl: null,
  backgroundUrl: "/graffiti-bg.png",
  bannerUrl: null,
  colors: DEFAULT_COLORS,
};

const STORAGE_KEY = "wegen-site-settings";

function hexToHsl(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

const COLLECTION_CSS_VARS: Record<string, { primary: string; background: string; card: string; secondary: string; muted: string; input: string }> = {
  wegenettes: { primary: "320 100% 55%", background: "300 30% 2%", card: "300 25% 4%", secondary: "300 25% 8%", muted: "295 20% 11%", input: "295 20% 9%" },
  wegens:     { primary: "272 100% 62%", background: "270 45% 2%", card: "270 30% 4%", secondary: "270 30% 7%", muted: "270 20% 10%", input: "270 25% 8%" },
};

function applyColorsToRoot(colors: SiteColors) {
  const root = document.documentElement;
  const collection = root.getAttribute("data-collection") ?? "wegens";
  const cVars = COLLECTION_CSS_VARS[collection] ?? COLLECTION_CSS_VARS.wegens;

  const p = cVars.primary;
  const s = hexToHsl(colors.secondary);
  const t = hexToHsl(colors.text);
  const hl = hexToHsl(colors.headerLine);
  const cp = hexToHsl(colors.cardPanel);

  root.style.setProperty("--primary", p);
  root.style.setProperty("--ring", p);
  root.style.setProperty("--secondary", s);
  root.style.setProperty("--muted", s);
  root.style.setProperty("--foreground", t);
  root.style.setProperty("--card-foreground", t);
  root.style.setProperty("--popover-foreground", t);
  root.style.setProperty("--border", hl);
  root.style.setProperty("--input", hl);
  root.style.setProperty("--card", cp);
  root.style.setProperty("--popover", cp);
  root.style.setProperty("--background", cVars.background);
}

interface SiteSettingsContextValue {
  settings: SiteSettings;
  isInheriting: boolean;
  updateColors: (colors: Partial<SiteColors>) => void;
  updateImages: (images: Partial<Pick<SiteSettings, "logoUrl" | "backgroundUrl" | "bannerUrl">>) => void;
  resetColors: () => void;
}

const SiteSettingsContext = createContext<SiteSettingsContextValue | undefined>(undefined);

type RemoteSettings = SiteSettings & { isInheriting: boolean };

async function fetchRemoteSettings(collection: string): Promise<RemoteSettings | null> {
  try {
    const res = await fetch(`/api/admin/appearance-settings?nftCollection=${encodeURIComponent(collection)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      logoUrl: data.logoUrl ?? null,
      backgroundUrl: data.backgroundUrl ?? DEFAULT_SETTINGS.backgroundUrl,
      bannerUrl: data.bannerUrl ?? null,
      colors: { ...DEFAULT_COLORS, ...(data.colors ?? {}) },
      isInheriting: data.isInheriting === true,
    };
  } catch {
    return null;
  }
}

async function saveRemoteSettings(collection: string, patch: Partial<SiteSettings>): Promise<RemoteSettings | null> {
  try {
    const body: Record<string, unknown> = {};
    if (patch.logoUrl !== undefined) body.logoUrl = patch.logoUrl;
    if (patch.backgroundUrl !== undefined) body.backgroundUrl = patch.backgroundUrl;
    if (patch.bannerUrl !== undefined) body.bannerUrl = patch.bannerUrl;
    if (patch.colors !== undefined) body.colors = patch.colors;
    const res = await fetch(`/api/admin/appearance-settings?nftCollection=${encodeURIComponent(collection)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      logoUrl: data.logoUrl ?? null,
      backgroundUrl: data.backgroundUrl ?? DEFAULT_SETTINGS.backgroundUrl,
      bannerUrl: data.bannerUrl ?? null,
      colors: { ...DEFAULT_COLORS, ...(data.colors ?? {}) },
      // PUT response now includes isInheriting from the server
      isInheriting: data.isInheriting === true,
    };
  } catch {
    return null;
  }
}

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const { collection } = useCollection();

  const [settings, setSettings] = useState<SiteSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SiteSettings & { _version?: number };
        if ((parsed._version ?? 0) >= SETTINGS_VERSION) {
          return { ...DEFAULT_SETTINGS, ...parsed };
        }
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
    return DEFAULT_SETTINGS;
  });
  const [isInheriting, setIsInheriting] = useState(false);

  // Re-fetch settings whenever the active collection changes
  useEffect(() => {
    let cancelled = false;
    fetchRemoteSettings(collection).then(remote => {
      if (remote && !cancelled) {
        const { isInheriting: inheriting, ...settingsOnly } = remote;
        setSettings(settingsOnly);
        setIsInheriting(inheriting);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settingsOnly, _version: SETTINGS_VERSION })); } catch { /* ignore */ }
      }
    });
    return () => { cancelled = true; };
  }, [collection]);

  useEffect(() => {
    applyColorsToRoot(settings.colors);
  }, [settings.colors]);

  useEffect(() => {
    const body = document.body;
    body.style.backgroundImage = "";
    body.style.backgroundSize = "";
    body.style.backgroundAttachment = "";
    body.style.backgroundBlendMode = "";
  }, [settings.backgroundUrl]);

  const persist = useCallback((next: SiteSettings, patch: Partial<SiteSettings>) => {
    setSettings(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...next, _version: SETTINGS_VERSION })); } catch { /* ignore */ }
    saveRemoteSettings(collection, patch).then(remote => {
      if (remote) {
        const { isInheriting: inheriting, ...settingsOnly } = remote;
        setSettings(settingsOnly);
        setIsInheriting(inheriting);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settingsOnly, _version: SETTINGS_VERSION })); } catch { /* ignore */ }
      }
    });
  }, [collection]);

  const updateColors = useCallback((colors: Partial<SiteColors>) => {
    setSettings(prev => {
      const next = { ...prev, colors: { ...prev.colors, ...colors } };
      persist(next, { colors: next.colors });
      return next;
    });
  }, [persist]);

  const updateImages = useCallback(
    (images: Partial<Pick<SiteSettings, "logoUrl" | "backgroundUrl" | "bannerUrl">>) => {
      const next = { ...settings, ...images };
      persist(next, images);
    },
    [persist, settings]
  );

  const resetColors = useCallback(() => {
    setSettings(prev => {
      const next = { ...prev, colors: DEFAULT_COLORS };
      persist(next, { colors: DEFAULT_COLORS });
      return next;
    });
  }, [persist]);

  return (
    <SiteSettingsContext.Provider value={{ settings, isInheriting, updateColors, updateImages, resetColors }}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  const ctx = useContext(SiteSettingsContext);
  if (!ctx) throw new Error("useSiteSettings must be used within SiteSettingsProvider");
  return ctx;
}
