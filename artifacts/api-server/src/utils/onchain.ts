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

export function hasGoldenTicketAttr(nft: AlchemyNft): boolean {
  const attrs = nft.raw?.metadata?.attributes ?? [];
  return attrs.some(
    (a) =>
      String(a.trait_type).toLowerCase() === "golden ticket" ||
      String(a.value).toLowerCase() === "golden ticket",
  );
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
