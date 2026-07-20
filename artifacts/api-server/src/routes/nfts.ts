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
import {
  fetchOnChainWegens,
  getOriginAttribute,
  bestImageUrl,
  hasGoldenTicketAttr,
} from "../utils/onchain";

const router: IRouter = Router();

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
      merged.push({ ...local, isWegenette: false, onChainAttributes: [] });
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
    // Recognized as a legend if: (a) token ID is listed in the legends table, OR
    // (b) the NFT has a "Golden Ticket" attribute (trait_type or value, case-insensitive)
    isLegend:
      legendTokenIds.has(nft.tokenId) ||
      (nft.onChainAttributes ?? []).some(
        (a) =>
          a.trait_type.toLowerCase() === "golden ticket" ||
          a.value.toLowerCase() === "golden ticket",
      ),
  }));

  // Auto-persist Golden Ticket NFTs into the legends table so they show up in admin.
  // Only runs if any on-chain Golden Tickets were detected.
  const goldenTicketNfts = merged.filter((nft) =>
    nft.onChainAttributes && hasGoldenTicketAttr({
      tokenId: String(nft.tokenId),
      name: nft.name ?? "",
      raw: { metadata: { attributes: nft.onChainAttributes } },
    }),
  );
  if (goldenTicketNfts.length > 0) {
    try {
      const alreadyListed = await db
        .select({ tokenId: legendsTable.tokenId })
        .from(legendsTable)
        .where(inArray(legendsTable.tokenId, goldenTicketNfts.map((n) => n.tokenId)));
      const alreadyIds = new Set(
        alreadyListed.map((r) => r.tokenId).filter((id): id is number => id !== null),
      );
      const toInsert = goldenTicketNfts.filter((nft) => !alreadyIds.has(nft.tokenId));
      if (toInsert.length > 0) {
        await db.insert(legendsTable).values(
          toInsert.map((nft) => ({
            name: nft.isWegenette ? `Wegenette #${nft.tokenId}` : (nft.name ?? `Wegen #${nft.tokenId}`),
            nftCollection: (nft.isWegenette ? "wegenettes" : "wegens") as "wegenettes" | "wegens",
            tokenId: nft.tokenId,
            imageUrl: nft.imageUrl ?? null,
            isActive: true,
            sortOrder: 0,
          })),
        );
      }
    } catch {
      // Non-fatal — log suppressed intentionally; legend display degrades gracefully
    }
  }

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

  // Parse variant pack first — saving a style (even with no equipped traits) is valid
  const variantPack =
    typeof req.body.variantPack === "string" && req.body.variantPack.length > 0
      ? req.body.variantPack
      : null;

  // "variantPack" key present in body means the user is explicitly choosing a display style
  const isSavingStyle = "variantPack" in req.body;

  if (equippedRows.length === 0 && !nftIsLegend && !isSavingStyle) {
    res.status(400).json({ error: "No traits equipped to this NFT" });
    return;
  }

  // Generate a simulated on-chain tx hash (replace with real contract call when ready)
  const txHash =
    "0x" +
    Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join("");

  // Record the metadata confirmation on the NFT row; always update variantPack when style intent present
  await db
    .update(wegenNftsTable)
    .set({
      metadataTxHash: txHash,
      metadataUpdatedAt: new Date(),
      variantPack,
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
