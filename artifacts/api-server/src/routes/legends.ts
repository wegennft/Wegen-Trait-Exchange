import { Router, type IRouter } from "express";
import { eq, and, asc, inArray } from "drizzle-orm";
import { db, legendsTable, legendVariantsTable } from "@workspace/db";

const router: IRouter = Router();

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
router.get("/legends/variants/by-collection", async (req, res): Promise<void> => {
  const nftCollection = getNftCollection(req.query as Record<string, unknown>);
  const name = (req.query.name as string | undefined)?.trim();
  if (!name) { res.json({ variantMap: {} }); return; }
  const ids = await legendIdsForCollection(nftCollection);
  if (ids.length === 0) { res.json({ variantMap: {} }); return; }
  const variants = await db
    .select()
    .from(legendVariantsTable)
    .where(and(
      inArray(legendVariantsTable.legendId, ids),
      eq(legendVariantsTable.name, name),
      eq(legendVariantsTable.isEnabled, true),
    ));
  const map: Record<number, { imageUrl: string | null; mediaType: string }> = {};
  for (const v of variants) map[v.legendId] = { imageUrl: v.imageUrl, mediaType: v.mediaType };
  res.json({ variantMap: map });
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

// POST /admin/legends
router.post("/admin/legends", async (req, res): Promise<void> => {
  const { name, nftCollection, imageUrl, mediaType, description, isActive, sortOrder } = req.body as {
    name?: string; nftCollection?: string; imageUrl?: string; mediaType?: string;
    description?: string; isActive?: boolean; sortOrder?: number;
  };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
  const [legend] = await db.insert(legendsTable).values({
    name: name.trim(),
    nftCollection: nftCollection === "wegenettes" ? "wegenettes" : "wegens",
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
  const { name, imageUrl, mediaType, description, isActive, sortOrder } = req.body as {
    name?: string; imageUrl?: string | null; mediaType?: string;
    description?: string | null; isActive?: boolean; sortOrder?: number;
  };
  const updates: Partial<typeof legendsTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name.trim();
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
