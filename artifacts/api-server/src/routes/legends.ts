import { Router, type IRouter } from "express";
import { eq, and, asc, inArray, isNotNull } from "drizzle-orm";
import { db, legendsTable, legendVariantsTable, wegenNftsTable, traitsTable } from "@workspace/db";
import { requireAdmin } from "../middleware/requireAuth";
import {
  fetchOnChainWegens,
  fetchAllCollectionNfts,
  getOriginAttribute,
  bestImageUrl,
  hasGoldenTicketAttr,
  hasTeamAttr,
  hasLegendAttr,
  hasUltraRareAttr,
  hasSeasonedWegenAttr,
} from "../utils/onchain";

const router: IRouter = Router();

// All /admin/* routes on this router require an authenticated admin session.
router.use("/admin", requireAdmin);

function getNftCollection(q: Record<string, unknown>): string {
  return q.nftCollection === "wegenettes" ? "wegenettes" : "wegens";
}

async function legendIdsForCollection(nftCollection: string): Promise<number[]> {
  const rows = await db
    .select({ id: legendsTable.id })
    .from(legendsTable)
    .where(eq(legendsTable.nftCollection, nftCollection));
  return rows.map((r) => r.id);
}

// GET /legends?nftCollection= — public: active legends only
router.get("/legends", async (req, res): Promise<void> => {
  const nftCollection = getNftCollection(req.query as Record<string, unknown>);
  const legends = await db
    .select()
    .from(legendsTable)
    .where(and(eq(legendsTable.nftCollection, nftCollection), eq(legendsTable.isActive, true)))
    .orderBy(asc(legendsTable.sortOrder), asc(legendsTable.name));
  res.json({ legends });
});

// GET /legends/mine?walletAddress=&nftCollection= — legends owned by wallet (token ID cross-reference)
router.get("/legends/mine", async (req, res): Promise<void> => {
  const nftCollection = getNftCollection(req.query as Record<string, unknown>);
  const walletAddress = (req.query.walletAddress as string | undefined)?.toLowerCase().trim();
  if (!walletAddress) { res.status(400).json({ error: "walletAddress is required" }); return; }

  // Fetch on-chain NFTs (source of truth for ownership) + DB-only seeded records in parallel.
  // The DB-only path covers demo/seeded wallets whose NFTs aren't on-chain yet.
  const [onChain, dbNfts] = await Promise.all([
    fetchOnChainWegens(walletAddress).catch(() => [] as Awaited<ReturnType<typeof fetchOnChainWegens>>),
    db.select({ tokenId: wegenNftsTable.tokenId }).from(wegenNftsTable).where(eq(wegenNftsTable.walletAddress, walletAddress)),
  ]);

  // Filter on-chain NFTs by the requested collection
  const onChainForCollection = onChain.filter((n) =>
    nftCollection === "wegenettes"
      ? getOriginAttribute(n) === "wegenette"
      : getOriginAttribute(n) !== "wegenette",
  );
  const onChainTokenIds = onChainForCollection.map((n) => parseInt(n.tokenId, 10));
  const dbTokenIds = dbNfts.map((n) => n.tokenId);
  const ownedTokenIds = [...new Set([...onChainTokenIds, ...dbTokenIds])];

  if (ownedTokenIds.length === 0) { res.json({ legends: [] }); return; }

  // Legends for this collection whose tokenId matches one of the wallet's NFTs
  const legends = await db
    .select()
    .from(legendsTable)
    .where(
      and(
        eq(legendsTable.nftCollection, nftCollection),
        eq(legendsTable.isActive, true),
        inArray(legendsTable.tokenId, ownedTokenIds),
      )
    )
    .orderBy(asc(legendsTable.sortOrder), asc(legendsTable.name));
  res.json({ legends });
});

// GET /legends/all?nftCollection= — admin: all legends including inactive
router.get("/legends/all", async (req, res): Promise<void> => {
  const nftCollection = getNftCollection(req.query as Record<string, unknown>);
  const legends = await db
    .select()
    .from(legendsTable)
    .where(eq(legendsTable.nftCollection, nftCollection))
    .orderBy(asc(legendsTable.sortOrder), asc(legendsTable.name));
  res.json({ legends });
});

// GET /legends/variant-collections?nftCollection= — enabled pack names
router.get("/legends/variant-collections", async (req, res): Promise<void> => {
  const nftCollection = getNftCollection(req.query as Record<string, unknown>);
  const ids = await legendIdsForCollection(nftCollection);
  if (ids.length === 0) { res.json({ collections: [] }); return; }
  const rows = await db
    .selectDistinct({ name: legendVariantsTable.name })
    .from(legendVariantsTable)
    .where(and(inArray(legendVariantsTable.legendId, ids), eq(legendVariantsTable.isEnabled, true)))
    .orderBy(legendVariantsTable.name);
  res.json({ collections: rows.map((r) => r.name) });
});

// GET /legends/variants/by-collection?nftCollection=&name=
// Returns variantMap (keyed by legendId) AND tokenMap (keyed by tokenId) so
// callers that only know the NFT's tokenId can look up the variant without a
// separate legends fetch.
router.get("/legends/variants/by-collection", async (req, res): Promise<void> => {
  const nftCollection = getNftCollection(req.query as Record<string, unknown>);
  const name = (req.query.name as string | undefined)?.trim();
  if (!name) { res.json({ variantMap: {}, tokenMap: {} }); return; }
  const ids = await legendIdsForCollection(nftCollection);
  if (ids.length === 0) { res.json({ variantMap: {}, tokenMap: {} }); return; }

  // Fetch tokenId for each legend so we can build a tokenId-keyed map
  const legendRows = await db
    .select({ id: legendsTable.id, tokenId: legendsTable.tokenId })
    .from(legendsTable)
    .where(inArray(legendsTable.id, ids));
  const legendIdToTokenId = new Map<number, number | null>();
  for (const r of legendRows) legendIdToTokenId.set(r.id, r.tokenId);

  const variants = await db
    .select()
    .from(legendVariantsTable)
    .where(and(
      inArray(legendVariantsTable.legendId, ids),
      eq(legendVariantsTable.name, name),
      eq(legendVariantsTable.isEnabled, true),
    ));
  const map: Record<number, { imageUrl: string | null; mediaType: string }> = {};
  const tokenMap: Record<number, { imageUrl: string | null; mediaType: string }> = {};
  for (const v of variants) {
    map[v.legendId] = { imageUrl: v.imageUrl, mediaType: v.mediaType };
    const tokenId = legendIdToTokenId.get(v.legendId);
    if (tokenId != null) {
      tokenMap[tokenId] = { imageUrl: v.imageUrl, mediaType: v.mediaType };
    }
  }
  res.json({ variantMap: map, tokenMap });
});

// GET /legends/:id/variants
router.get("/legends/:id/variants", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const variants = await db
    .select()
    .from(legendVariantsTable)
    .where(eq(legendVariantsTable.legendId, id))
    .orderBy(asc(legendVariantsTable.sortOrder), asc(legendVariantsTable.name));
  res.json({ variants });
});

// POST /admin/legends/sync — scan the full Wegen collection and auto-add
// Golden Tickets, Team Wegens, Legendary (Legend trait), Ultra Rare, and Seasoned Wegen NFTs to the legends table.
router.post("/admin/legends/sync-golden-tickets", async (req, res): Promise<void> => {
  // Fetch the entire collection from the blockchain
  const allNfts = await fetchAllCollectionNfts();

  // Separate into categories
  const candidates = allNfts.filter(
    (nft) => hasGoldenTicketAttr(nft) || hasTeamAttr(nft) || hasLegendAttr(nft) || hasUltraRareAttr(nft) || hasSeasonedWegenAttr(nft),
  );

  if (candidates.length === 0) {
    res.json({ added: 0, scanned: allNfts.length, goldenTickets: 0, team: 0, legends: 0, ultraRare: 0, seasonedWegens: 0 });
    return;
  }

  // Fetch all token IDs already in the legends table to avoid duplicates
  const candidateTokenIds = candidates
    .map((n) => parseInt(n.tokenId, 10))
    .filter((id) => !isNaN(id));

  const existing = await db
    .select({ tokenId: legendsTable.tokenId })
    .from(legendsTable)
    .where(inArray(legendsTable.tokenId, candidateTokenIds));
  const existingIds = new Set(
    existing.map((r) => r.tokenId).filter((id): id is number => id !== null),
  );

  const toInsert = candidates.filter((nft) => {
    const id = parseInt(nft.tokenId, 10);
    return !isNaN(id) && !existingIds.has(id);
  });

  let goldenTickets = 0;
  let team = 0;
  let legends = 0;
  let ultraRare = 0;
  let seasonedWegens = 0;

  if (toInsert.length > 0) {
    const rows = toInsert.map((nft) => {
      const tokenId = parseInt(nft.tokenId, 10);
      const isWegenette = getOriginAttribute(nft) === "wegenette";

      if (hasGoldenTicketAttr(nft)) goldenTickets++;
      else if (hasTeamAttr(nft)) team++;
      else if (hasLegendAttr(nft)) legends++;
      else if (hasUltraRareAttr(nft)) ultraRare++;
      else if (hasSeasonedWegenAttr(nft)) seasonedWegens++;

      return {
        // Always generate a clean name for Wegenettes — on-chain token name reads "Wegens #X" for migrated Wegenettes
        name: isWegenette ? `Wegenette #${tokenId}` : (nft.name ?? `Wegen #${tokenId}`),
        nftCollection: (isWegenette ? "wegenettes" : "wegens") as "wegenettes" | "wegens",
        tokenId,
        imageUrl: bestImageUrl(nft) ?? null,
        isActive: true,
        sortOrder: 0,
      };
    });

    await db.insert(legendsTable).values(rows);
  }

  res.json({
    added: toInsert.length,
    scanned: allNfts.length,
    goldenTickets,
    team,
    legends,
    ultraRare,
    seasonedWegens,
  });
});

// GET /admin/storage/gallery — returns all uploaded image URLs for the image picker
router.get("/admin/storage/gallery", async (req, res): Promise<void> => {
  const [traitImages, legendImages, variantImages] = await Promise.all([
    db.select({ url: traitsTable.imageUrl, label: traitsTable.name })
      .from(traitsTable)
      .where(isNotNull(traitsTable.imageUrl)),
    db.select({ url: legendsTable.imageUrl, label: legendsTable.name })
      .from(legendsTable)
      .where(isNotNull(legendsTable.imageUrl)),
    db.select({ url: legendVariantsTable.imageUrl, label: legendVariantsTable.name })
      .from(legendVariantsTable)
      .where(isNotNull(legendVariantsTable.imageUrl)),
  ]);

  const seen = new Set<string>();
  const images: { url: string; label: string; source: string }[] = [];

  for (const { url, label } of legendImages) {
    if (url && !seen.has(url)) { seen.add(url); images.push({ url, label: label ?? "", source: "legend" }); }
  }
  for (const { url, label } of traitImages) {
    if (url && !seen.has(url)) { seen.add(url); images.push({ url, label: label ?? "", source: "trait" }); }
  }
  for (const { url, label } of variantImages) {
    if (url && !seen.has(url)) { seen.add(url); images.push({ url, label: label ?? "", source: "variant" }); }
  }

  res.json({ images });
});

// POST /admin/legends
router.post("/admin/legends", async (req, res): Promise<void> => {
  const { name, nftCollection, tokenId, imageUrl, mediaType, description, isActive, sortOrder } = req.body as {
    name?: string; nftCollection?: string; tokenId?: number | null; imageUrl?: string; mediaType?: string;
    description?: string; isActive?: boolean; sortOrder?: number;
  };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
  const [legend] = await db.insert(legendsTable).values({
    name: name.trim(),
    nftCollection: nftCollection === "wegenettes" ? "wegenettes" : "wegens",
    tokenId: tokenId ?? null,
    imageUrl: imageUrl ?? null,
    mediaType: mediaType ?? "image",
    description: description ?? null,
    isActive: isActive ?? true,
    sortOrder: sortOrder ?? 0,
  }).returning();
  res.status(201).json({ legend });
});

// PUT /admin/legends/:id
router.put("/admin/legends/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { name, tokenId, imageUrl, mediaType, description, isActive, sortOrder } = req.body as {
    name?: string; tokenId?: number | null; imageUrl?: string | null; mediaType?: string;
    description?: string | null; isActive?: boolean; sortOrder?: number;
  };
  const updates: Partial<typeof legendsTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name.trim();
  if (tokenId !== undefined) updates.tokenId = tokenId;
  if (imageUrl !== undefined) updates.imageUrl = imageUrl;
  if (mediaType !== undefined) updates.mediaType = mediaType;
  if (description !== undefined) updates.description = description;
  if (isActive !== undefined) updates.isActive = isActive;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;
  const [legend] = await db.update(legendsTable).set(updates).where(eq(legendsTable.id, id)).returning();
  if (!legend) { res.status(404).json({ error: "Legend not found" }); return; }
  res.json({ legend });
});

// DELETE /admin/legends/:id
router.delete("/admin/legends/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(legendsTable).where(eq(legendsTable.id, id));
  res.json({ success: true });
});

// POST /admin/legends/:id/variants
router.post("/admin/legends/:id/variants", async (req, res): Promise<void> => {
  const legendId = parseInt(req.params.id, 10);
  if (isNaN(legendId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { name, imageUrl, mediaType, sortOrder } = req.body as {
    name?: string; imageUrl?: string; mediaType?: string; sortOrder?: number;
  };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
  const [variant] = await db.insert(legendVariantsTable).values({
    legendId,
    name: name.trim(),
    imageUrl: imageUrl ?? null,
    mediaType: mediaType ?? "image",
    sortOrder: sortOrder ?? 0,
  }).returning();
  res.json({ variant });
});

// DELETE /admin/legend-variants/:variantId
router.delete("/admin/legend-variants/:variantId", async (req, res): Promise<void> => {
  const variantId = parseInt(req.params.variantId, 10);
  if (isNaN(variantId)) { res.status(400).json({ error: "Invalid variantId" }); return; }
  await db.delete(legendVariantsTable).where(eq(legendVariantsTable.id, variantId));
  res.json({ success: true });
});

// GET /admin/all-legend-variants?nftCollection= — all variants grouped by legendId
router.get("/admin/all-legend-variants", async (req, res): Promise<void> => {
  const nftCollection = getNftCollection(req.query as Record<string, unknown>);
  const ids = await legendIdsForCollection(nftCollection);
  if (ids.length === 0) { res.json({ variantsByLegendId: {} }); return; }
  const variants = await db
    .select()
    .from(legendVariantsTable)
    .where(inArray(legendVariantsTable.legendId, ids))
    .orderBy(asc(legendVariantsTable.sortOrder), asc(legendVariantsTable.name));
  const map: Record<number, { id: number; name: string; imageUrl: string | null; mediaType: string; isEnabled: boolean }[]> = {};
  for (const v of variants) {
    if (!map[v.legendId]) map[v.legendId] = [];
    map[v.legendId].push({ id: v.id, name: v.name, imageUrl: v.imageUrl, mediaType: v.mediaType, isEnabled: v.isEnabled });
  }
  res.json({ variantsByLegendId: map });
});

// GET /admin/legend-variant-packs?nftCollection= — pack summary
router.get("/admin/legend-variant-packs", async (req, res): Promise<void> => {
  const nftCollection = getNftCollection(req.query as Record<string, unknown>);
  const ids = await legendIdsForCollection(nftCollection);
  if (ids.length === 0) { res.json({ packs: [] }); return; }
  const variants = await db
    .select()
    .from(legendVariantsTable)
    .where(inArray(legendVariantsTable.legendId, ids));
  const packMap = new Map<string, { total: number; enabled: number }>();
  for (const v of variants) {
    const existing = packMap.get(v.name) ?? { total: 0, enabled: 0 };
    existing.total++;
    if (v.isEnabled) existing.enabled++;
    packMap.set(v.name, existing);
  }
  const packs = Array.from(packMap.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => a.name.localeCompare(b.name));
  res.json({ packs });
});

// PATCH /admin/legend-variant-packs?nftCollection= — bulk-toggle a pack
router.patch("/admin/legend-variant-packs", async (req, res): Promise<void> => {
  const nftCollection = getNftCollection(
    (req.query.nftCollection ? req.query : req.body) as Record<string, unknown>
  );
  const { name, isEnabled } = req.body as { name?: string; isEnabled?: boolean };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
  if (typeof isEnabled !== "boolean") { res.status(400).json({ error: "isEnabled (boolean) is required" }); return; }
  const ids = await legendIdsForCollection(nftCollection);
  if (ids.length === 0) { res.json({ updated: 0 }); return; }
  const result = await db
    .update(legendVariantsTable)
    .set({ isEnabled })
    .where(and(inArray(legendVariantsTable.legendId, ids), eq(legendVariantsTable.name, name.trim())))
    .returning({ id: legendVariantsTable.id });
  res.json({ updated: result.length });
});

export default router;
