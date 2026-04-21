import { Router, type IRouter } from "express";
import { eq, sql, and, isNotNull } from "drizzle-orm";
import { db, traitsTable } from "@workspace/db";
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

router.get("/traits/categories", async (_req, res): Promise<void> => {
  const rows = await db
    .selectDistinct({ category: traitsTable.category })
    .from(traitsTable)
    .orderBy(traitsTable.category);
  const categories = rows.map((r) => r.category);
  res.json(ListTraitCategoriesResponse.parse({ categories }));
});

router.get("/store/themes", async (_req, res): Promise<void> => {
  const rows = await db
    .selectDistinct({ theme: traitsTable.theme })
    .from(traitsTable)
    .where(isNotNull(traitsTable.theme))
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
  const offset = (page - 1) * limit;

  const conditions = includeAll ? [] : [eq(traitsTable.isActive, true)];
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

router.get("/store/stats", async (_req, res): Promise<void> => {
  const [traitsCountResult, categoryRows, lockerCountResult, holderCountResult] =
    await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(traitsTable),
      db
        .selectDistinct({ category: traitsTable.category })
        .from(traitsTable),
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
    SELECT category, count(*)::int as count FROM traits GROUP BY category ORDER BY category
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

export default router;
