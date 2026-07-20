import { Router, type IRouter } from "express";
import { awardPoints } from "./bounties";
import { eq, and, inArray } from "drizzle-orm";
import { db, wegenNftsTable, lockerItemsTable, traitsTable, transactionsTable, legendsTable } from "@workspace/db";
import {
  GetUserNftsParams,
  GetUserNftsResponse,
  ApplyTraitParams,
  ApplyTraitBody,
  ApplyTraitResponse,
  RemoveTraitParams,
  RemoveTraitBody,
  RemoveTraitResponse,
  ConfirmTraitsParams,
  ConfirmTraitsBody,
  ConfirmTraitsResponse,
} from "@workspace/api-zod";
import { requireWalletOwnership } from "../middleware/requireAuth";

const router: IRouter = Router();

// ── On-chain NFT lookup via Alchemy (demo endpoint — no key required) ─────────

const WEGEN_CONTRACT = "0x31a53ce49c99b0c05085dd76d17669871dacd6c0";
const ALCHEMY_BASE = "https://eth-mainnet.g.alchemy.com/nft/v3/demo";

interface AlchemyNft {
  tokenId: string;
  name: string;
  image?: { cachedUrl?: string; thumbnailUrl?: string; originalUrl?: string };
  raw?: { metadata?: { attributes?: Array<{ trait_type: string; value: unknown }> } };
}

function getOriginAttribute(nft: AlchemyNft): string | null {
  const attrs = nft.raw?.metadata?.attributes ?? [];
  const origin = attrs.find((a) => a.trait_type === "Origin");
  return typeof origin?.value === "string" ? origin.value.toLowerCase() : null;
}

/**
 * Returns all Wegens owned by walletAddress from the Ethereum contract.
 * Pages through Alchemy results automatically (100 per page).
 * Returns [] on network failure so the rest of the route degrades gracefully.
 */
async function fetchOnChainWegens(walletAddress: string): Promise<AlchemyNft[]> {
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
      const data = await resp.json() as { ownedNfts?: AlchemyNft[]; pageKey?: string };
      if (data.ownedNfts) results.push(...data.ownedNfts);
      pageKey = data.pageKey;
    } while (pageKey);
  } catch {
    // Network/timeout — return whatever we collected
  }
  return results;
}

function bestImageUrl(nft: AlchemyNft): string | null {
  return nft.image?.cachedUrl ?? nft.image?.thumbnailUrl ?? nft.image?.originalUrl ?? null;
}

async function getNftWithTraits(tokenId: number) {
  const [nft] = await db
    .select()
    .from(wegenNftsTable)
    .where(eq(wegenNftsTable.tokenId, tokenId));

  if (!nft) return null;

  const equipped = await db
    .select({
      lockerItemId: lockerItemsTable.id,
      category: traitsTable.category,
      trait: {
        id: traitsTable.id,
        name: traitsTable.name,
        category: traitsTable.category,
        description: traitsTable.description,
        imageUrl: traitsTable.imageUrl,
        priceUsd: traitsTable.priceUsd,
        priceEth: traitsTable.priceEth,
        priceWei: traitsTable.priceWei,
        totalSupply: traitsTable.totalSupply,
        remainingSupply: traitsTable.remainingSupply,
        isActive: traitsTable.isActive,
        rarity: traitsTable.rarity,
        payoutSplits: traitsTable.payoutSplits,
        createdAt: traitsTable.createdAt,
      },
    })
    .from(lockerItemsTable)
    .innerJoin(traitsTable, eq(lockerItemsTable.traitId, traitsTable.id))
    .where(eq(lockerItemsTable.equippedToTokenId, tokenId));

  return { ...nft, equippedTraits: equipped };
}

router.get("/nfts/:walletAddress/detect-collection", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.walletAddress)
    ? req.params.walletAddress[0]
    : req.params.walletAddress;
  const walletAddress = raw?.toLowerCase().trim();
  if (!walletAddress) {
    res.status(400).json({ error: "walletAddress is required" });
    return;
  }

  // Use live on-chain data to detect which collection this wallet holds
  const onChain = await fetchOnChainWegens(walletAddress);

  const hasWegenettes = onChain.some((n) => getOriginAttribute(n) === "wegenette");
  const hasWegens = onChain.some((n) => getOriginAttribute(n) !== "wegenette");

  let collection: "wegens" | "wegenettes" | null = null;
  if (hasWegenettes && !hasWegens) {
    collection = "wegenettes";
  } else if (hasWegens || onChain.length === 0) {
    collection = "wegens";
  }

  res.json({ collection, hasWegens, hasWegenettes });
});

router.get("/nfts/:walletAddress", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.walletAddress)
    ? req.params.walletAddress[0]
    : req.params.walletAddress;
  const params = GetUserNftsParams.safeParse({ walletAddress: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const wallet = params.data.walletAddress;

  // Fetch on-chain ownership and local DB records in parallel
  const [onChain, localNfts] = await Promise.all([
    fetchOnChainWegens(wallet),
    db.select().from(wegenNftsTable).where(eq(wegenNftsTable.walletAddress, wallet)),
  ]);

  // Build a map of local DB records keyed by tokenId for fast lookup
  const localByTokenId = new Map(localNfts.map((n) => [n.tokenId, n]));

  // Merge: on-chain is the source of truth for ownership + image.
  // Local DB fills in equipped-trait state, SOC metadata, etc.
  const EXCLUDED_ATTRS = new Set(["Origin", "Original Mint", "Original ID"]);

  const merged = onChain.map((oc) => {
    const tokenId = parseInt(oc.tokenId, 10);
    const local = localByTokenId.get(tokenId);
    const rawAttrs = oc.raw?.metadata?.attributes ?? [];
    const onChainAttributes = rawAttrs
      .filter((a) => !EXCLUDED_ATTRS.has(String(a.trait_type)))
      .map((a) => ({ trait_type: String(a.trait_type), value: String(a.value) }));
    return {
      tokenId,
      walletAddress: wallet,
      name: oc.name,
      imageUrl: bestImageUrl(oc) ?? local?.imageUrl ?? null,
      metadataTxHash: local?.metadataTxHash ?? null,
      metadataUpdatedAt: local?.metadataUpdatedAt ?? null,
      variantPack: local?.variantPack ?? null,
      createdAt: local?.createdAt ?? new Date(),
      isWegenette: getOriginAttribute(oc) === "wegenette",
      onChainAttributes,
    };
  });

  // Also include any DB-only NFTs that aren't on-chain yet (edge case / seeded data)
  for (const local of localNfts) {
    if (!merged.find((m) => m.tokenId === local.tokenId)) {
      merged.push({ ...local, isWegenette: false });
    }
  }

  // Fetch equipped traits for all token IDs
  const tokenIds = merged.map((n) => n.tokenId);
  const equippedRows =
    tokenIds.length > 0
      ? await db
          .select({
            equippedToTokenId: lockerItemsTable.equippedToTokenId,
            lockerItemId: lockerItemsTable.id,
            category: traitsTable.category,
            trait: {
              id: traitsTable.id,
              name: traitsTable.name,
              category: traitsTable.category,
              description: traitsTable.description,
              imageUrl: traitsTable.imageUrl,
              priceUsd: traitsTable.priceUsd,
              priceEth: traitsTable.priceEth,
              priceWei: traitsTable.priceWei,
              totalSupply: traitsTable.totalSupply,
              remainingSupply: traitsTable.remainingSupply,
              isActive: traitsTable.isActive,
              rarity: traitsTable.rarity,
              payoutSplits: traitsTable.payoutSplits,
              createdAt: traitsTable.createdAt,
            },
          })
          .from(lockerItemsTable)
          .innerJoin(traitsTable, eq(lockerItemsTable.traitId, traitsTable.id))
          .where(inArray(lockerItemsTable.equippedToTokenId, tokenIds))
      : [];

  // Group equipped traits by tokenId
  const equippedByTokenId = new Map<number, typeof equippedRows>();
  for (const row of equippedRows) {
    if (row.equippedToTokenId === null) continue;
    const arr = equippedByTokenId.get(row.equippedToTokenId) ?? [];
    arr.push(row);
    equippedByTokenId.set(row.equippedToTokenId, arr);
  }

  // Fetch legend flags
  const legendRows =
    tokenIds.length > 0
      ? await db
          .select({ tokenId: legendsTable.tokenId })
          .from(legendsTable)
          .where(and(eq(legendsTable.isActive, true), inArray(legendsTable.tokenId, tokenIds)))
      : [];
  const legendTokenIds = new Set(
    legendRows.map((r) => r.tokenId).filter((id): id is number => id !== null),
  );

  const nftsWithLegendFlag = merged.map((nft) => ({
    ...nft,
    equippedTraits: (equippedByTokenId.get(nft.tokenId) ?? []).map((r) => ({
      lockerItemId: r.lockerItemId,
      category: r.category,
      trait: r.trait,
    })),
    isLegend: legendTokenIds.has(nft.tokenId),
  }));

  res.json(GetUserNftsResponse.parse({ nfts: nftsWithLegendFlag, total: nftsWithLegendFlag.length }));
});

router.post("/nfts/:tokenId/apply-trait", requireWalletOwnership(), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.tokenId)
    ? req.params.tokenId[0]
    : req.params.tokenId;
  const pathParams = ApplyTraitParams.safeParse({ tokenId: rawId });
  if (!pathParams.success) {
    res.status(400).json({ error: pathParams.error.message });
    return;
  }

  const body = ApplyTraitBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { lockerItemId, walletAddress } = body.data;
  const tokenId = pathParams.data.tokenId;

  const [legendCheck] = await db
    .select({ id: legendsTable.id })
    .from(legendsTable)
    .where(and(eq(legendsTable.tokenId, tokenId), eq(legendsTable.isActive, true)))
    .limit(1);
  if (legendCheck) {
    res.status(403).json({ error: "Legends and 1/1s cannot have traits equipped" });
    return;
  }

  const [lockerItem] = await db
    .select()
    .from(lockerItemsTable)
    .where(
      and(
        eq(lockerItemsTable.id, lockerItemId),
        eq(lockerItemsTable.walletAddress, walletAddress),
      ),
    );

  if (!lockerItem) {
    res.status(400).json({ error: "Locker item not found or not owned by this wallet" });
    return;
  }

  if (lockerItem.equippedToTokenId !== null) {
    res.status(400).json({ error: "Trait is already equipped to an NFT" });
    return;
  }

  const [trait] = await db
    .select()
    .from(traitsTable)
    .where(eq(traitsTable.id, lockerItem.traitId));

  if (!trait) {
    res.status(400).json({ error: "Trait not found" });
    return;
  }

  // Check for an existing trait in the same category on this NFT
  const existingEquipped = await db
    .select({
      lockerItemId: lockerItemsTable.id,
    })
    .from(lockerItemsTable)
    .innerJoin(traitsTable, eq(lockerItemsTable.traitId, traitsTable.id))
    .where(
      and(
        eq(lockerItemsTable.equippedToTokenId, tokenId),
        eq(traitsTable.category, trait.category),
      ),
    );

  // If a trait of the same category is already equipped, auto-return it to the locker
  if (existingEquipped.length > 0) {
    await db
      .update(lockerItemsTable)
      .set({ equippedToTokenId: null })
      .where(eq(lockerItemsTable.id, existingEquipped[0].lockerItemId));
  }

  const [updatedItem] = await db
    .update(lockerItemsTable)
    .set({ equippedToTokenId: tokenId })
    .where(eq(lockerItemsTable.id, lockerItemId))
    .returning();

  await db.insert(transactionsTable).values({
    type: "trade",
    traitId: trait.id,
    traitName: trait.name,
    traitCategory: trait.category,
    traitImageUrl: trait.imageUrl ?? null,
    walletAddress,
    ethAmount: trait.priceEth,
    txHash: null,
    tokenId,
  });

  const nft = await getNftWithTraits(tokenId);
  if (!nft) {
    res.status(404).json({ error: "NFT not found" });
    return;
  }

  const itemWithTrait = { ...updatedItem, trait };

  res.json(ApplyTraitResponse.parse({ success: true, nft, lockerItem: itemWithTrait }));
});

router.post("/nfts/:tokenId/remove-trait", requireWalletOwnership(), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.tokenId)
    ? req.params.tokenId[0]
    : req.params.tokenId;
  const pathParams = RemoveTraitParams.safeParse({ tokenId: rawId });
  if (!pathParams.success) {
    res.status(400).json({ error: pathParams.error.message });
    return;
  }

  const body = RemoveTraitBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { category, walletAddress } = body.data;
  const tokenId = pathParams.data.tokenId;

  const [legendRemoveCheck] = await db
    .select({ id: legendsTable.id })
    .from(legendsTable)
    .where(and(eq(legendsTable.tokenId, tokenId), eq(legendsTable.isActive, true)))
    .limit(1);
  if (legendRemoveCheck) {
    res.status(403).json({ error: "Legends and 1/1s cannot have traits removed" });
    return;
  }

  const equippedRows = await db
    .select({
      lockerItem: lockerItemsTable,
      trait: traitsTable,
    })
    .from(lockerItemsTable)
    .innerJoin(traitsTable, eq(lockerItemsTable.traitId, traitsTable.id))
    .where(
      and(
        eq(lockerItemsTable.equippedToTokenId, tokenId),
        eq(lockerItemsTable.walletAddress, walletAddress),
        eq(traitsTable.category, category),
      ),
    );

  if (equippedRows.length === 0) {
    res.status(400).json({ error: "No equipped trait found for that category" });
    return;
  }

  const { lockerItem, trait } = equippedRows[0];

  const [updatedItem] = await db
    .update(lockerItemsTable)
    .set({ equippedToTokenId: null })
    .where(eq(lockerItemsTable.id, lockerItem.id))
    .returning();

  const nft = await getNftWithTraits(tokenId);
  if (!nft) {
    res.status(404).json({ error: "NFT not found" });
    return;
  }

  const itemWithTrait = { ...updatedItem, trait };

  res.json(RemoveTraitResponse.parse({ success: true, nft, lockerItem: itemWithTrait }));
});

router.post("/nfts/:tokenId/confirm-traits", requireWalletOwnership(), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.tokenId)
    ? req.params.tokenId[0]
    : req.params.tokenId;
  const pathParams = ConfirmTraitsParams.safeParse({ tokenId: rawId });
  if (!pathParams.success) {
    res.status(400).json({ error: pathParams.error.message });
    return;
  }

  const body = ConfirmTraitsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { walletAddress } = body.data;
  const tokenId = pathParams.data.tokenId;

  const [nft] = await db
    .select()
    .from(wegenNftsTable)
    .where(eq(wegenNftsTable.tokenId, tokenId));

  if (!nft) {
    res.status(404).json({ error: "NFT not found" });
    return;
  }

  if (nft.walletAddress !== walletAddress) {
    res.status(403).json({ error: "Wallet does not own this NFT" });
    return;
  }

  const [confirmLegendCheck] = await db
    .select({ id: legendsTable.id })
    .from(legendsTable)
    .where(and(eq(legendsTable.tokenId, tokenId), eq(legendsTable.isActive, true)))
    .limit(1);
  const nftIsLegend = !!confirmLegendCheck;

  const equippedRows = await db
    .select({
      category: traitsTable.category,
      name: traitsTable.name,
    })
    .from(lockerItemsTable)
    .innerJoin(traitsTable, eq(lockerItemsTable.traitId, traitsTable.id))
    .where(eq(lockerItemsTable.equippedToTokenId, tokenId));

  if (equippedRows.length === 0 && !nftIsLegend) {
    res.status(400).json({ error: "No traits equipped to this NFT" });
    return;
  }

  // Generate a simulated on-chain tx hash (replace with real contract call when ready)
  const txHash =
    "0x" +
    Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join("");

  // Optional variant pack from body (not in Zod schema — read directly)
  const variantPack =
    typeof req.body.variantPack === "string" && req.body.variantPack.length > 0
      ? req.body.variantPack
      : null;

  // Record the metadata confirmation on the NFT row
  await db
    .update(wegenNftsTable)
    .set({
      metadataTxHash: txHash,
      metadataUpdatedAt: new Date(),
      ...(variantPack !== undefined ? { variantPack } : {}),
    })
    .where(eq(wegenNftsTable.tokenId, tokenId));

  // Award 250 points for saving traits on-chain
  await awardPoints(walletAddress, 250, "confirm_traits", `SOC: token #${tokenId}`).catch(() => {});

  res.json(
    ConfirmTraitsResponse.parse({
      success: true,
      txHash,
      tokenId,
      traitsApplied: equippedRows,
    }),
  );
});

export default router;
