import { Router, type IRouter } from "express";
import { eq, sql, and, isNotNull, asc } from "drizzle-orm";
import { db, traitsTable, storeSettingsTable, traitVariantsTable } from "@workspace/db";
import {
  ListTraitsQueryParams,
  ListTraitsResponse,
  GetTraitParams,
  GetTraitResponse,
  ListTraitCategoriesResponse,
  GetStoreStatsResponse,
  ListStoreThemesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function getNftCollection(query: Record<string, unknown>): string {
  const c = query.nftCollection;
  if (c === "wegenettes") return "wegenettes";
  return "wegens";
}

router.get("/traits/categories", async (req, res): Promise<void> => {
  const nftCollection = getNftCollection(req.query as Record<string, unknown>);
  const rows = await db
    .selectDistinct({ category: traitsTable.category })
    .from(traitsTable)
    .where(eq(traitsTable.nftCollection, nftCollection))
    .orderBy(traitsTable.category);
  const categories = rows.map((r) => r.category);
  res.json(ListTraitCategoriesResponse.parse({ categories }));
});

router.get("/store/themes", async (req, res): Promise<void> => {
  const nftCollection = getNftCollection(req.query as Record<string, unknown>);
  const rows = await db
    .selectDistinct({ theme: traitsTable.theme })
    .from(traitsTable)
    .where(and(isNotNull(traitsTable.theme), eq(traitsTable.nftCollection, nftCollection)))
    .orderBy(traitsTable.theme);
  const themes = rows.map((r) => r.theme).filter(Boolean) as string[];
  res.json(ListStoreThemesResponse.parse({ themes }));
});

router.get("/traits", async (req, res): Promise<void> => {
  const params = ListTraitsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { category, theme, page, limit, includeAll } = params.data;
  const nftCollection = getNftCollection(req.query as Record<string, unknown>);
  const offset = (page - 1) * limit;

  const conditions = includeAll ? [] : [eq(traitsTable.isActive, true)];
  conditions.push(eq(traitsTable.nftCollection, nftCollection));
  if (category) {
    conditions.push(eq(traitsTable.category, category));
  }
  if (theme) {
    conditions.push(eq(traitsTable.theme, theme));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [traits, countResult] = await Promise.all([
    db
      .select()
      .from(traitsTable)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(traitsTable.createdAt),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(traitsTable)
      .where(whereClause),
  ]);

  const total = countResult[0]?.count ?? 0;
  res.json(ListTraitsResponse.parse({ traits, total, page, limit }));
});

router.get("/traits/:traitId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.traitId)
    ? req.params.traitId[0]
    : req.params.traitId;
  const params = GetTraitParams.safeParse({ traitId: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [trait] = await db
    .select()
    .from(traitsTable)
    .where(eq(traitsTable.id, params.data.traitId));

  if (!trait) {
    res.status(404).json({ error: "Trait not found" });
    return;
  }

  res.json(GetTraitResponse.parse(trait));
});

router.get("/store/stats", async (req, res): Promise<void> => {
  const nftCollection = getNftCollection(req.query as Record<string, unknown>);
  const collectionFilter = eq(traitsTable.nftCollection, nftCollection);

  const [traitsCountResult, categoryRows, lockerCountResult, holderCountResult] =
    await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(traitsTable).where(collectionFilter),
      db
        .selectDistinct({ category: traitsTable.category })
        .from(traitsTable)
        .where(collectionFilter),
      db.execute(sql`SELECT count(*)::int as count FROM locker_items`),
      db.execute(
        sql`SELECT count(distinct wallet_address)::int as count FROM locker_items`,
      ),
    ]);

  const totalTraits = traitsCountResult[0]?.count ?? 0;
  const totalCategories = categoryRows.length;
  const totalPurchases = (lockerCountResult.rows[0] as { count: number })?.count ?? 0;
  const totalHolders = (holderCountResult.rows[0] as { count: number })?.count ?? 0;

  const categoryCountRows = await db.execute(sql`
    SELECT category, count(*)::int as count FROM traits
    WHERE nft_collection = ${nftCollection}
    GROUP BY category ORDER BY category
  `);

  const traitsByCategory = (categoryCountRows.rows as { category: string; count: number }[]).map(
    (r) => ({ category: r.category, count: r.count }),
  );

  const recentResult = await db.execute(sql`
    SELECT count(*)::int as count FROM locker_items WHERE purchased_at > now() - interval '24 hours'
  `);
  const recentPurchases = (recentResult.rows[0] as { count: number })?.count ?? 0;

  res.json(
    GetStoreStatsResponse.parse({
      totalTraits,
      totalCategories,
      totalPurchases,
      totalHolders,
      traitsByCategory,
      recentPurchases,
    }),
  );
});

// ── GET /traits/:traitId/variants ────────────────────────────────────────────
router.get("/traits/:traitId/variants", async (req, res): Promise<void> => {
  const traitId = parseInt(req.params.traitId, 10);
  if (isNaN(traitId)) { res.status(400).json({ error: "Invalid traitId" }); return; }
  const variants = await db
    .select()
    .from(traitVariantsTable)
    .where(eq(traitVariantsTable.traitId, traitId))
    .orderBy(asc(traitVariantsTable.sortOrder), asc(traitVariantsTable.createdAt));
  res.json({ variants });
});

// ── GET /store/config — public config for frontend (maintenance gate etc.) ────
router.get("/store/config", async (req, res): Promise<void> => {
  const nftCollection = getNftCollection(req.query as Record<string, unknown>);
  const [settings] = await db
    .select()
    .from(storeSettingsTable)
    .where(eq(storeSettingsTable.nftCollection, nftCollection))
    .limit(1);
  res.json({
    storeOpen: settings?.storeOpen ?? true,
    maintenanceMode: settings?.maintenanceMode ?? false,
    maintenanceWhitelist: JSON.parse(settings?.maintenanceWhitelist ?? "[]") as string[],
    ineligibleNfts: JSON.parse(settings?.ineligibleNfts ?? "[]") as string[],
    storeName: settings?.storeName ?? (nftCollection === "wegenettes" ? "Wegenettes Trait Store" : "Wegen Trait Store"),
    announcementBanner: settings?.announcementBanner ?? null,
  });
});

export default router;
