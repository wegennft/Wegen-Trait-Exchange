export const WEGEN_CONTRACT = "0x31a53ce49c99b0c05085dd76d17669871dacd6c0";
export const ALCHEMY_BASE = "https://eth-mainnet.g.alchemy.com/nft/v3/demo";

export interface AlchemyNft {
  tokenId: string;
  name: string;
  image?: { cachedUrl?: string; thumbnailUrl?: string; originalUrl?: string };
  raw?: { metadata?: { attributes?: Array<{ trait_type: string; value: unknown }> } };
}

export function getOriginAttribute(nft: AlchemyNft): string | null {
  const attrs = nft.raw?.metadata?.attributes ?? [];
  const origin = attrs.find((a) => a.trait_type === "Origin");
  return typeof origin?.value === "string" ? origin.value.toLowerCase() : null;
}

export function bestImageUrl(nft: AlchemyNft): string | null {
  return nft.image?.cachedUrl ?? nft.image?.thumbnailUrl ?? nft.image?.originalUrl ?? null;
}

/** NFT has a "Golden Ticket" trait_type (any value) */
export function hasGoldenTicketAttr(nft: AlchemyNft): boolean {
  const attrs = nft.raw?.metadata?.attributes ?? [];
  return attrs.some(
    (a) =>
      String(a.trait_type).toLowerCase() === "golden ticket" ||
      String(a.value).toLowerCase() === "golden ticket",
  );
}

/** NFT has a "Team" trait_type — identifies team Wegens */
export function hasTeamAttr(nft: AlchemyNft): boolean {
  const attrs = nft.raw?.metadata?.attributes ?? [];
  return attrs.some((a) => String(a.trait_type).toLowerCase() === "team");
}

/** NFT has a "Legend" trait_type — identifies 1-of-1 legendary characters */
export function hasLegendAttr(nft: AlchemyNft): boolean {
  const attrs = nft.raw?.metadata?.attributes ?? [];
  return attrs.some((a) => String(a.trait_type).toLowerCase() === "legend");
}

/** NFT has an "Ultra Rare" trait_type — identifies ultra rare 1-of-1 wegens */
export function hasUltraRareAttr(nft: AlchemyNft): boolean {
  const attrs = nft.raw?.metadata?.attributes ?? [];
  return attrs.some((a) => String(a.trait_type).toLowerCase() === "ultra rare");
}

/** Returns which special category this NFT belongs to (or null) */
export function getNftLegendCategory(
  nft: AlchemyNft,
): "golden_ticket" | "team" | "legend" | "ultra_rare" | null {
  if (hasGoldenTicketAttr(nft)) return "golden_ticket";
  if (hasTeamAttr(nft)) return "team";
  if (hasLegendAttr(nft)) return "legend";
  if (hasUltraRareAttr(nft)) return "ultra_rare";
  return null;
}

/**
 * Returns all Wegens owned by walletAddress from the Ethereum contract.
 * Pages through Alchemy results automatically (100 per page).
 * Returns [] on network failure so routes degrade gracefully.
 */
export async function fetchOnChainWegens(walletAddress: string): Promise<AlchemyNft[]> {
  const results: AlchemyNft[] = [];
  let pageKey: string | undefined;
  try {
    do {
      const url = new URL(`${ALCHEMY_BASE}/getNFTsForOwner`);
      url.searchParams.set("owner", walletAddress);
      url.searchParams.append("contractAddresses[]", WEGEN_CONTRACT);
      url.searchParams.set("limit", "100");
      url.searchParams.set("includeRawMetadata", "true");
      if (pageKey) url.searchParams.set("pageKey", pageKey);

      const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
      if (!resp.ok) break;
      const data = (await resp.json()) as { ownedNfts?: AlchemyNft[]; pageKey?: string };
      if (data.ownedNfts) results.push(...data.ownedNfts);
      pageKey = data.pageKey;
    } while (pageKey);
  } catch {
    // Network/timeout — return whatever we collected
  }
  return results;
}

/**
 * Fetches ALL NFTs in the Wegen contract by scanning the full collection.
 * Pages through up to `maxPages` pages (default 100 = 10,000 NFTs).
 * Returns whatever was collected on network failure.
 */
export async function fetchAllCollectionNfts(maxPages = 100): Promise<AlchemyNft[]> {
  const results: AlchemyNft[] = [];
  let pageKey: string | undefined;
  let pages = 0;
  try {
    do {
      const url = new URL(`${ALCHEMY_BASE}/getNFTsForCollection`);
      url.searchParams.set("contractAddress", WEGEN_CONTRACT);
      url.searchParams.set("limit", "100");
      url.searchParams.set("withMetadata", "true");
      if (pageKey) url.searchParams.set("pageKey", pageKey);

      const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
      if (!resp.ok) break;
      const data = (await resp.json()) as { nfts?: AlchemyNft[]; pageKey?: string };
      if (data.nfts) results.push(...data.nfts);
      pageKey = data.pageKey;
      pages++;
    } while (pageKey && pages < maxPages);
  } catch {
    // Network/timeout — return whatever we collected
  }
  return results;
}
