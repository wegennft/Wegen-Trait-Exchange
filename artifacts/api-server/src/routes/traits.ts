import { Router, type IRouter } from "express";
import { eq, sql, and, isNotNull, asc, inArray } from "drizzle-orm";
import { db, traitsTable, storeSettingsTable, traitVariantsTable } from "@workspace/db";
import sharp from "sharp";
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
  res.set("Cache-Control", "no-store");
  res.json(ListTraitsResponse.parse({ traits, total, page, limit }));
});

// ── GET /traits/variant-collections — static; must come before /:traitId ─────
router.get("/traits/variant-collections", async (req, res): Promise<void> => {
  const nftCollection = getNftCollection(req.query as Record<string, unknown>);
  const rows = await db
    .selectDistinct({ name: traitVariantsTable.name })
    .from(traitVariantsTable)
    .innerJoin(traitsTable, eq(traitVariantsTable.traitId, traitsTable.id))
    .where(
      and(
        eq(traitsTable.nftCollection, nftCollection),
        eq(traitVariantsTable.isEnabled, true),
      ),
    )
    .orderBy(asc(traitVariantsTable.name));
  res.json({ collections: rows.map((r) => r.name) });
});

// ── GET /traits/variant-preview-image — composited PNG from on-chain attributes + variant pack ──
// ?variant=Cyber+Punks&nftCollection=wegens&attrs=Background:Don't+Be+Hating|Body:Albino|...
router.get("/traits/variant-preview-image", async (req, res): Promise<void> => {
  const nftCollection = getNftCollection(req.query as Record<string, unknown>);
  const variant = typeof req.query.variant === "string" ? req.query.variant : "";
  const attrsRaw = typeof req.query.attrs === "string" ? req.query.attrs : "";

  const makePlaceholder = () =>
    sharp({ create: { width: 1000, height: 1000, channels: 4, background: { r: 26, g: 5, b: 51, alpha: 1 } } })
      .png().toBuffer();

  if (!variant || !attrsRaw) {
    res.status(400).json({ error: "variant and attrs are required" });
    return;
  }

  // Normalize on-chain trait_type names to DB category names
  const CATEGORY_ALIASES: Record<string, string> = {
    "Skin": "Body",
    "Head & Hair": "Headgear",
    "HeadGear": "Headgear",
  };

  // Parse "Category:Value|..." pairs (split only on first colon per segment)
  const pairs = attrsRaw.split("|").map((s) => {
    const idx = s.indexOf(":");
    if (idx === -1) return null;
    const rawCat = s.slice(0, idx).trim();
    return {
      category: CATEGORY_ALIASES[rawCat] ?? rawCat,
      name: s.slice(idx + 1).trim(),
    };
  }).filter((p): p is { category: string; name: string } => p !== null && p.category !== "" && p.name !== "");

  if (pairs.length === 0) {
    res.setHeader("Content-Type", "image/png");
    res.send(await makePlaceholder());
    return;
  }

  try {
    // Find traits matching the on-chain attribute (category, name) pairs
    const names = pairs.map((p) => p.name);
    const candidates = await db
      .select({ id: traitsTable.id, category: traitsTable.category, name: traitsTable.name })
      .from(traitsTable)
      .where(and(eq(traitsTable.nftCollection, nftCollection), inArray(traitsTable.name, names)));

    const pairSet = new Set(pairs.map((p) => `${p.category}:::${p.name}`));
    const matched = candidates.filter((t) => pairSet.has(`${t.category}:::${t.name}`));

    if (matched.length === 0) {
      res.setHeader("Content-Type", "image/png");
      res.send(await makePlaceholder());
      return;
    }

    // Get variant images for the matched trait IDs
    const traitIds = matched.map((t) => t.id);
    const variants = await db
      .select({
        traitId: traitVariantsTable.traitId,
        imageUrl: traitVariantsTable.imageUrl,
        category: traitsTable.category,
      })
      .from(traitVariantsTable)
      .innerJoin(traitsTable, eq(traitVariantsTable.traitId, traitsTable.id))
      .where(
        and(
          eq(traitVariantsTable.name, variant),
          inArray(traitVariantsTable.traitId, traitIds),
          eq(traitVariantsTable.isEnabled, true),
        ),
      );

    // Get layer order from store settings
    const settings = await db.query.storeSettingsTable.findFirst({
      where: eq(storeSettingsTable.nftCollection, nftCollection),
    });
    const layerOrder: string[] = (() => {
      try { return settings?.layerOrder ? (JSON.parse(settings.layerOrder) as string[]) : []; }
      catch { return []; }
    })();
    const defaultOrder = ["Background", "Body", "Clothes", "Mouth", "Eyes", "Headgear"];
    const order = layerOrder.length > 0 ? layerOrder : defaultOrder;

    // category → variant imageUrl map
    const variantByCategory = new Map<string, string>();
    for (const v of variants) {
      if (v.imageUrl) variantByCategory.set(v.category, v.imageUrl);
    }

    // Sort matched traits by layer order and resolve URLs
    const proto = req.headers["x-forwarded-proto"] ?? req.protocol;
    const host = req.headers["x-forwarded-host"] ?? req.get("host");
    const baseUrl = `${proto}://${host}`;

    const sorted = [...matched].sort((a, b) => {
      const ai = order.indexOf(a.category);
      const bi = order.indexOf(b.category);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

    const layerUrls: string[] = [];
    for (const item of sorted) {
      const rawUrl = variantByCategory.get(item.category) ?? null;
      if (!rawUrl) continue;
      layerUrls.push(rawUrl.startsWith("http") ? rawUrl : `${baseUrl}${rawUrl}`);
    }

    if (layerUrls.length === 0) {
      res.setHeader("Content-Type", "image/png");
      res.send(await makePlaceholder());
      return;
    }

    // Fetch image buffers in parallel
    const fetchBuf = async (url: string): Promise<Buffer | null> => {
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!r.ok) return null;
        return Buffer.from(await r.arrayBuffer());
      } catch { return null; }
    };

    const buffers = (await Promise.all(layerUrls.map(fetchBuf))).filter((b): b is Buffer => b !== null);

    if (buffers.length === 0) {
      res.setHeader("Content-Type", "image/png");
      res.send(await makePlaceholder());
      return;
    }

    const resized = await Promise.all(
      buffers.map((b) =>
        sharp(b).resize(1000, 1000, { fit: "cover", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .ensureAlpha().png().toBuffer(),
      ),
    );

    const [base, ...rest] = resized;
    const composited = await sharp(base)
      .composite(rest.map((buf) => ({ input: buf, blend: "over" as const })))
      .png().toBuffer();

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(composited);
  } catch (err) {
    req.log?.error({ err }, "Failed to composite variant preview image");
    res.status(500).send("Failed to generate image");
  }
});

// ── GET /traits/variants/by-collection — static; must come before /:traitId ──
router.get("/traits/variants/by-collection", async (req, res): Promise<void> => {
  const nftCollection = getNftCollection(req.query as Record<string, unknown>);
  const name = typeof req.query.name === "string" ? req.query.name : "";
  if (!name) { res.json({ variantMap: {}, nameMap: {} }); return; }
  const rows = await db
    .select({
      traitId: traitVariantsTable.traitId,
      traitName: traitsTable.name,
      traitCategory: traitsTable.category,
      imageUrl: traitVariantsTable.imageUrl,
      mediaType: traitVariantsTable.mediaType,
    })
    .from(traitVariantsTable)
    .innerJoin(traitsTable, eq(traitVariantsTable.traitId, traitsTable.id))
    .where(
      and(
        eq(traitsTable.nftCollection, nftCollection),
        eq(traitVariantsTable.name, name),
        eq(traitVariantsTable.isEnabled, true),
      ),
    );
  const variantMap: Record<string, { imageUrl: string | null; mediaType: string }> = {};
  const nameMap: Record<string, { imageUrl: string | null; mediaType: string; category: string }> = {};
  for (const r of rows) {
    variantMap[String(r.traitId)] = { imageUrl: r.imageUrl, mediaType: r.mediaType };
    nameMap[r.traitName.toLowerCase()] = { imageUrl: r.imageUrl, mediaType: r.mediaType, category: r.traitCategory };
  }
  res.json({ variantMap, nameMap });
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
    .where(and(eq(traitVariantsTable.traitId, traitId), eq(traitVariantsTable.isEnabled, true)))
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
