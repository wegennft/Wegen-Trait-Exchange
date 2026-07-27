import { Router, type IRouter } from "express";
import { eq, sql, and, or, isNotNull, asc, inArray } from "drizzle-orm";
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
  // Only return categories that have at least one active (isActive=true) trait,
  // so the filter pills never show categories with zero purchasable traits.
  const rows = await db
    .selectDistinct({ category: traitsTable.category })
    .from(traitsTable)
    .where(and(eq(traitsTable.nftCollection, nftCollection), eq(traitsTable.isActive, true)))
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
  // Optional: original NFT image used as the bottom layer so partial matches still look complete
  const baseImageUrl = typeof req.query.baseImageUrl === "string" ? req.query.baseImageUrl : "";

  if (!variant || !attrsRaw) {
    res.status(400).json({ error: "variant and attrs are required" });
    return;
  }

  // Fetch a remote image into a Buffer (with timeout)
  const fetchBuf = async (url: string): Promise<Buffer | null> => {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) return null;
      return Buffer.from(await r.arrayBuffer());
    } catch { return null; }
  };

  // Normalize on-chain trait_type names to DB category names
  const CATEGORY_ALIASES: Record<string, string> = {
    "Skin": "Body",
    "Head & Hair": "Headgear",
    "HeadGear": "Headgear",
  };

  // Non-visual trait_type names that should never be composited as layers.
  // Includes wegenette-specific metadata attributes (Golden Ticket, Team, Collab Edition)
  // that appear as on-chain trait_types but have no corresponding visual layer.
  const NON_VISUAL_CATEGORIES = new Set([
    "origin", "seasoned wegen", "legend", "ultra rare",
    "migration #", "original name", "original mint", "original id",
    "golden ticket", "team", "collab edition",
  ]);

  // Parse "Category:Value|..." pairs (split only on first colon per segment)
  const pairs = attrsRaw.split("|").map((s) => {
    const idx = s.indexOf(":");
    if (idx === -1) return null;
    const rawCat = s.slice(0, idx).trim();
    const name = s.slice(idx + 1).trim();
    const category = CATEGORY_ALIASES[rawCat] ?? rawCat;
    return { category, name };
  }).filter((p): p is { category: string; name: string } =>
    // Discard empty pairs, non-visual categories, and very long values
    p !== null &&
    p.category !== "" &&
    p.name !== "" &&
    p.name.length <= 120 &&
    !NON_VISUAL_CATEGORIES.has(p.category.toLowerCase())
  );

  try {
    // Find traits matching the on-chain attribute (category, name) pairs.
    // Use case-insensitive matching so on-chain capitalisation variants
    // (e.g. "Varsity with J's" vs DB "Varsity With J'S") still resolve.
    // Filter by nftCollection so wegens traits are never mixed into wegenettes
    // cards (e.g. "Brown" body exists in both collections but with different
    // variant artwork).
    // Also match against `on_chain_name` when set — this handles wegenette traits
    // whose on-chain attribute value differs from the DB trait name.
    const lowerNames = pairs.map((p) => p.name.toLowerCase());
    const candidates = lowerNames.length > 0
      ? await db
          .select({ id: traitsTable.id, category: traitsTable.category, name: traitsTable.name, imageUrl: traitsTable.imageUrl, onChainName: traitsTable.onChainName })
          .from(traitsTable)
          .where(
            and(
              eq(traitsTable.nftCollection, nftCollection),
              or(
                inArray(sql`lower(${traitsTable.name})`, lowerNames),
                and(
                  isNotNull(traitsTable.onChainName),
                  inArray(sql`lower(${traitsTable.onChainName})`, lowerNames),
                ),
              ),
            )
          )
      : [];

    // Match case-insensitively on both category and name (or onChainName override)
    const pairSetLower = new Set(
      pairs.map((p) => `${p.category.toLowerCase()}:::${p.name.toLowerCase()}`)
    );
    const allMatched = candidates.filter((t) => {
      const nameKey = `${t.category.toLowerCase()}:::${t.name.toLowerCase()}`;
      const aliasKey = t.onChainName ? `${t.category.toLowerCase()}:::${t.onChainName.toLowerCase()}` : null;
      return pairSetLower.has(nameKey) || (aliasKey !== null && pairSetLower.has(aliasKey));
    });

    // Deduplicate: keep only the first match per category (avoid double-compositing Body:Ice x2)
    const seenCategories = new Set<string>();
    const matched = allMatched.filter((t) => {
      if (seenCategories.has(t.category)) return false;
      seenCategories.add(t.category);
      return true;
    });

    // Get layer order from store settings
    const settings = await db.query.storeSettingsTable.findFirst({
      where: eq(storeSettingsTable.nftCollection, nftCollection),
    });
    const layerOrder: string[] = (() => {
      try { return settings?.layerOrder ? (JSON.parse(settings.layerOrder) as string[]) : []; }
      catch { return []; }
    })();
    // layerOrder[0] is FRONT (topmost), last entry is BACK (bottommost).
    // Sort descending so highest index (back) is composited first, lowest (front) last.
    // Must match admin's DEFAULT_LAYER_ORDER so headgear renders on top, background at base.
    const defaultOrder = ["Headgear", "Eyes", "Mouth", "Clothes", "Body", "Background"];
    const order = layerOrder.length > 0 ? layerOrder : defaultOrder;

    // Get variant images for the matched trait IDs
    const proto = req.headers["x-forwarded-proto"] ?? req.protocol;
    const host = req.headers["x-forwarded-host"] ?? req.get("host");
    const serverBase = `${proto}://${host}`;

    let layerUrls: string[] = [];

    if (matched.length > 0) {
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

      // category → variant imageUrl map (first found wins per category)
      const variantByCategory = new Map<string, string>();
      for (const v of variants) {
        if (v.imageUrl && !variantByCategory.has(v.category)) {
          variantByCategory.set(v.category, v.imageUrl);
        }
      }

      // Sort matched traits by layer order: layerOrder[0] is the FRONT layer
      // (topmost), last entry is BACK (bottommost). Composite back→front, so
      // sort DESCENDING by index — highest index (back) comes first as base.
      const sorted = [...matched].sort((a, b) => {
        const ai = order.indexOf(a.category);
        const bi = order.indexOf(b.category);
        return (bi === -1 ? 1000 : bi) - (ai === -1 ? 1000 : ai);
      });

      for (const item of sorted) {
        // Prefer variant artwork; fall back to the trait's base DB imageUrl so that
        // categories without variant art are still present as a layer in the correct
        // z-order, preventing traits from the flat base image from bleeding through
        // at the wrong depth (e.g. Clothes appearing above a Body variant).
        const rawUrl = variantByCategory.get(item.category) ?? item.imageUrl ?? null;
        if (!rawUrl) continue;
        layerUrls.push(rawUrl.startsWith("http") ? rawUrl : `${serverBase}${rawUrl}`);
      }
    }

    // If the original NFT image URL was provided, use it as the bottom-most layer.
    // This ensures partial-match NFTs (where only some trait layers have variant art)
    // still show recognisable content instead of a floating silhouette or dark box.
    // Full-match NFTs (where Background is found and is 100% opaque) effectively hide
    // the base image anyway, so there's no visual cost for including it.
    const resolvedBaseImageUrl = baseImageUrl
      ? (baseImageUrl.startsWith("http") ? baseImageUrl : `${serverBase}${baseImageUrl}`)
      : null;

    // If no variant layers matched (e.g. this collection has no variant artwork for the
    // requested pack), redirect to the base image so the frontend shows the original NFT art
    // instead of a dark placeholder covering it. The 302 is intentional — it avoids re-fetching
    // and compositing when there's nothing to composite.
    if (layerUrls.length === 0) {
      if (resolvedBaseImageUrl) {
        res.redirect(302, resolvedBaseImageUrl);
        return;
      }
      // Nothing at all — serve a transparent placeholder
      const placeholder = await sharp({
        create: { width: 1000, height: 1000, channels: 4, background: { r: 26, g: 5, b: 51, alpha: 0 } },
      }).png().toBuffer();
      res.setHeader("Content-Type", "image/png");
      res.send(placeholder);
      return;
    }

    // Build the full ordered URL list: base NFT image first (if provided), then variant layers
    const allUrls: string[] = [
      ...(resolvedBaseImageUrl ? [resolvedBaseImageUrl] : []),
      ...layerUrls,
    ];

    const buffers = (await Promise.all(allUrls.map(fetchBuf))).filter((b): b is Buffer => b !== null);

    if (buffers.length === 0) {
      const placeholder = await sharp({
        create: { width: 1000, height: 1000, channels: 4, background: { r: 26, g: 5, b: 51, alpha: 1 } },
      }).png().toBuffer();
      res.setHeader("Content-Type", "image/png");
      res.send(placeholder);
      return;
    }

    const resized = await Promise.all(
      buffers.map((b) =>
        sharp(b).resize(1000, 1000, { fit: "cover", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .ensureAlpha().png().toBuffer(),
      ),
    );

    const [base, ...rest] = resized;
    const composited = rest.length > 0
      ? await sharp(base)
          .composite(rest.map((buf) => ({ input: buf, blend: "over" as const })))
          .png().toBuffer()
      : base;

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(composited);
  } catch (err) {
    req.log?.error({ err }, "Failed to composite variant preview image");
    res.status(500).send("Failed to generate image");
  }
});

// ── GET /traits/compose-preview — server-composited NFT preview for the Store page ──
// Takes on-chain attrs + a store preview trait ID. Fetches each on-chain trait's
// base imageUrl from the DB, replaces the preview trait's category slot with the
// preview trait's own imageUrl, then composites all layers in the admin-configured
// order. This guarantees correct z-ordering (e.g. Headgear above Body) even when
// the body PNG has opaque content in the headgear area.
//
// ?previewTraitId=1212&nftCollection=wegens&attrs=Background:Blaze|Skin:Brown|...&baseImageUrl=https://...
router.get("/traits/compose-preview", async (req, res): Promise<void> => {
  const nftCollection = getNftCollection(req.query as Record<string, unknown>);
  const previewTraitIdRaw = typeof req.query.previewTraitId === "string" ? req.query.previewTraitId : "";
  const attrsRaw = typeof req.query.attrs === "string" ? req.query.attrs : "";
  const baseImageUrl = typeof req.query.baseImageUrl === "string" ? req.query.baseImageUrl : "";

  const previewTraitId = parseInt(previewTraitIdRaw, 10);
  if (!previewTraitIdRaw || isNaN(previewTraitId)) {
    res.status(400).json({ error: "previewTraitId is required" });
    return;
  }

  const fetchBuf = async (url: string): Promise<Buffer | null> => {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) return null;
      return Buffer.from(await r.arrayBuffer());
    } catch { return null; }
  };

  const CATEGORY_ALIASES: Record<string, string> = {
    "Skin": "Body",
    "Head & Hair": "Headgear",
    "HeadGear": "Headgear",
  };

  const NON_VISUAL_CATEGORIES = new Set([
    "origin", "seasoned wegen", "legend", "ultra rare",
    "migration #", "original name", "original mint", "original id",
    "golden ticket", "team", "collab edition",
  ]);

  const pairs = attrsRaw.split("|").map((s) => {
    const idx = s.indexOf(":");
    if (idx === -1) return null;
    const rawCat = s.slice(0, idx).trim();
    const name = s.slice(idx + 1).trim();
    const category = CATEGORY_ALIASES[rawCat] ?? rawCat;
    return { category, name };
  }).filter((p): p is { category: string; name: string } =>
    p !== null &&
    p.category !== "" &&
    p.name !== "" &&
    p.name.length <= 120 &&
    !NON_VISUAL_CATEGORIES.has(p.category.toLowerCase())
  );

  try {
    const [previewTrait] = await db
      .select({ id: traitsTable.id, category: traitsTable.category, imageUrl: traitsTable.imageUrl })
      .from(traitsTable)
      .where(eq(traitsTable.id, previewTraitId));

    if (!previewTrait) {
      res.status(404).json({ error: "Preview trait not found" });
      return;
    }

    const proto = req.headers["x-forwarded-proto"] ?? req.protocol;
    const host = req.headers["x-forwarded-host"] ?? req.get("host");
    const serverBase = `${proto}://${host}`;

    // Find base imageUrls for all on-chain traits EXCEPT the preview trait's category
    // (that slot will be filled by the preview trait's imageUrl instead)
    const otherPairs = pairs.filter(
      (p) => p.category.toLowerCase() !== previewTrait.category.toLowerCase()
    );
    const lowerNames = otherPairs.map((p) => p.name.toLowerCase());

    const candidates = lowerNames.length > 0
      ? await db
          .select({
            id: traitsTable.id,
            category: traitsTable.category,
            name: traitsTable.name,
            imageUrl: traitsTable.imageUrl,
            onChainName: traitsTable.onChainName,
          })
          .from(traitsTable)
          .where(
            and(
              eq(traitsTable.nftCollection, nftCollection),
              or(
                inArray(sql`lower(${traitsTable.name})`, lowerNames),
                and(
                  isNotNull(traitsTable.onChainName),
                  inArray(sql`lower(${traitsTable.onChainName})`, lowerNames),
                ),
              ),
            )
          )
      : [];

    const pairSetLower = new Set(
      otherPairs.map((p) => `${p.category.toLowerCase()}:::${p.name.toLowerCase()}`)
    );
    const allMatched = candidates.filter((t) => {
      const nameKey = `${t.category.toLowerCase()}:::${t.name.toLowerCase()}`;
      const aliasKey = t.onChainName ? `${t.category.toLowerCase()}:::${t.onChainName.toLowerCase()}` : null;
      return pairSetLower.has(nameKey) || (aliasKey !== null && pairSetLower.has(aliasKey));
    });

    const seenCategories = new Set<string>();
    const matched = allMatched.filter((t) => {
      if (seenCategories.has(t.category)) return false;
      seenCategories.add(t.category);
      return true;
    });

    const settings = await db.query.storeSettingsTable.findFirst({
      where: eq(storeSettingsTable.nftCollection, nftCollection),
    });
    const layerOrder: string[] = (() => {
      try { return settings?.layerOrder ? (JSON.parse(settings.layerOrder) as string[]) : []; }
      catch { return []; }
    })();
    // layerOrder[0] is FRONT (topmost), last entry is BACK (bottommost).
    // Must match admin's DEFAULT_LAYER_ORDER so headgear renders on top, background at base.
    const defaultOrder = ["Headgear", "Eyes", "Mouth", "Clothes", "Body", "Background"];
    const order = layerOrder.length > 0 ? layerOrder : defaultOrder;

    // Build category → imageUrl map: on-chain traits + the preview trait override
    const categoryImageMap = new Map<string, string>();
    for (const t of matched) {
      if (t.imageUrl) {
        const url = t.imageUrl.startsWith("http") ? t.imageUrl : `${serverBase}${t.imageUrl}`;
        categoryImageMap.set(t.category, url);
      }
    }
    if (previewTrait.imageUrl) {
      const url = previewTrait.imageUrl.startsWith("http")
        ? previewTrait.imageUrl
        : `${serverBase}${previewTrait.imageUrl}`;
      categoryImageMap.set(previewTrait.category, url);
    }

    // Sort back→front: layerOrder[0] = front (topmost), last = back (bottommost)
    const sortedCategories = Array.from(categoryImageMap.keys()).sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      return (bi === -1 ? 1000 : bi) - (ai === -1 ? 1000 : ai);
    });
    const layerUrls = sortedCategories.map((cat) => categoryImageMap.get(cat)!);

    const resolvedBaseImageUrl = baseImageUrl
      ? (baseImageUrl.startsWith("http") ? baseImageUrl : `${serverBase}${baseImageUrl}`)
      : null;

    const allUrls: string[] = [
      ...(resolvedBaseImageUrl ? [resolvedBaseImageUrl] : []),
      ...layerUrls,
    ];

    const buffers = (await Promise.all(allUrls.map(fetchBuf))).filter(
      (b): b is Buffer => b !== null
    );

    if (buffers.length === 0) {
      const placeholder = await sharp({
        create: { width: 1000, height: 1000, channels: 4, background: { r: 26, g: 5, b: 51, alpha: 1 } },
      }).png().toBuffer();
      res.setHeader("Content-Type", "image/png");
      res.send(placeholder);
      return;
    }

    const resized = await Promise.all(
      buffers.map((b) =>
        sharp(b)
          .resize(1000, 1000, { fit: "cover", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .ensureAlpha()
          .png()
          .toBuffer()
      )
    );

    const [base, ...rest] = resized;
    const composited = rest.length > 0
      ? await sharp(base)
          .composite(rest.map((buf) => ({ input: buf, blend: "over" as const })))
          .png()
          .toBuffer()
      : base;

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.send(composited);
  } catch (err) {
    req.log?.error({ err }, "Failed to composite store preview image");
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
      onChainName: traitsTable.onChainName,
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
    const entry = { imageUrl: r.imageUrl, mediaType: r.mediaType, category: r.traitCategory };
    nameMap[r.traitName.toLowerCase()] = entry;
    // Also index by on-chain name so the frontend can look up traits whose DB name
    // differs from the on-chain attribute value (e.g. "B B T" in DB vs "B.B.T" on-chain).
    if (r.onChainName) {
      nameMap[r.onChainName.toLowerCase()] = entry;
    }
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
