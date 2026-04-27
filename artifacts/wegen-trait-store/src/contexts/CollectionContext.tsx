import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export type NftCollection = "wegens" | "wegenettes";

interface CollectionContextValue {
  collection: NftCollection;
  collectionLabel: string;
  setCollection: (c: NftCollection) => void;
}

const CollectionContext = createContext<CollectionContextValue>({
  collection: "wegens",
  collectionLabel: "Wegens",
  setCollection: () => {},
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

export function CollectionProvider({ children }: { children: ReactNode }) {
  const [collection, setCollectionState] = useState<NftCollection>(() => {
    const fromUrl = readFromUrl();
    if (fromUrl !== "wegens") return fromUrl;
    const stored = localStorage.getItem("nftCollection");
    return stored === "wegenettes" ? "wegenettes" : "wegens";
  });

  useEffect(() => {
    writeToUrl(collection);
    localStorage.setItem("nftCollection", collection);
  }, [collection]);

  const setCollection = useCallback((c: NftCollection) => {
    setCollectionState(c);
  }, []);

  return (
    <CollectionContext.Provider value={{ collection, collectionLabel: getLabel(collection), setCollection }}>
      {children}
    </CollectionContext.Provider>
  );
}

export function useCollection() {
  return useContext(CollectionContext);
}
