import { Router, type IRouter } from "express";
import { eq, sql, asc, inArray, desc } from "drizzle-orm";
import { db, traitsTable, lockerItemsTable, storeSettingsTable, transactionsTable, rarityTiersTable } from "@workspace/db";
import { z } from "zod";
import { encryptAuthorityKey, verifyStoredKey } from "../keyEncryption.js";

const UpdateFeesBody = z.object({
  buyingFeePercent: z.string().regex(/^\d+(\.\d+)?$/, "Must be a valid number"),
  buyingFeeWallet: z.string().nullable().optional(),
  sellingFeePercent: z.string().regex(/^\d+(\.\d+)?$/, "Must be a valid number"),
  sellingFeeWallet: z.string().nullable().optional(),
  marketplaceListingFeePercent: z.string().regex(/^\d+(\.\d+)?$/, "Must be a valid number").optional().default("0"),
  marketplaceListingFeeWallet: z.string().nullable().optional(),
});
import {
  CreateTraitBody,
  UpdateTraitParams,
  UpdateTraitBody,
  UpdateTraitResponse,
  DeleteTraitParams,
  DeleteTraitResponse,
  GetAdminStatsResponse,
} from "@workspace/api-zod";
import { ethers } from "ethers";

const router: IRouter = Router();

function validatePayoutSplits(
  splits: { walletAddress: string; percentage: number }[],
): string | null {
  if (splits.length === 0) return null;
  const total = splits.reduce((sum, s) => sum + s.percentage, 0);
  if (Math.abs(total - 100) > 0.01) {
    return `Payout percentages must sum to 100% (currently ${total.toFixed(2)}%)`;
  }
  for (const s of splits) {
    if (!s.walletAddress || s.walletAddress.trim() === "") {
      return "All payout splits must have a wallet address";
    }
    if (s.percentage <= 0) {
      return "All payout percentages must be greater than 0";
    }
  }
  return null;
}

router.post("/admin/traits", async (req, res): Promise<void> => {
  const body = CreateTraitBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { name, category, theme, dropName, description, imageUrl, mediaType, priceEth, totalSupply, rarity, isActive, payoutSplits } =
    body.data;

  const splits = payoutSplits ?? [];
  const splitError = validatePayoutSplits(splits);
  if (splitError) {
    res.status(400).json({ error: splitError });
    return;
  }

  let priceWei: string;
  try {
    priceWei = ethers.parseEther(priceEth).toString();
  } catch {
    priceWei = "0";
  }

  const [trait] = await db
    .insert(traitsTable)
    .values({
      name,
      category,
      theme: theme ?? null,
      dropName: dropName ?? null,
      description: description ?? null,
      imageUrl: imageUrl ?? null,
      mediaType: mediaType ?? "image",
      priceEth,
      priceWei,
      totalSupply,
      remainingSupply: totalSupply,
      rarity: rarity as "common" | "uncommon" | "rare" | "legendary",
      isActive: isActive ?? true,
      payoutSplits: splits,
    })
    .returning();

  res.status(201).json({ ...trait, payoutSplits: splits });
});

router.put("/admin/traits/:traitId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.traitId)
    ? req.params.traitId[0]
    : req.params.traitId;
  const pathParams = UpdateTraitParams.safeParse({ traitId: rawId });
  if (!pathParams.success) {
    res.status(400).json({ error: pathParams.error.message });
    return;
  }

  const body = UpdateTraitBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  if (body.data.payoutSplits !== undefined) {
    const splitError = validatePayoutSplits(body.data.payoutSplits);
    if (splitError) {
      res.status(400).json({ error: splitError });
      return;
    }
  }

  const updates: Record<string, unknown> = {};

  if (body.data.name !== undefined) updates.name = body.data.name;
  if (body.data.description !== undefined) updates.description = body.data.description;
  if (body.data.imageUrl !== undefined) updates.imageUrl = body.data.imageUrl;
  if (body.data.mediaType !== undefined) updates.mediaType = body.data.mediaType;
  if (body.data.isActive !== undefined) updates.isActive = body.data.isActive;
  if (body.data.rarity !== undefined) updates.rarity = body.data.rarity;
  if (body.data.payoutSplits !== undefined) updates.payoutSplits = body.data.payoutSplits;
  if ("theme" in body.data) updates.theme = body.data.theme ?? null;
  if ("dropName" in body.data) updates.dropName = body.data.dropName ?? null;

  if (body.data.priceEth !== undefined) {
    updates.priceEth = body.data.priceEth;
    try {
      updates.priceWei = ethers.parseEther(body.data.priceEth).toString();
    } catch {
      updates.priceWei = "0";
    }
  }

  if (typeof body.data.totalSupply === "number") {
    const [current] = await db
      .select()
      .from(traitsTable)
      .where(eq(traitsTable.id, pathParams.data.traitId));

    if (current) {
      const diff = body.data.totalSupply - current.totalSupply;
      updates.totalSupply = body.data.totalSupply;
      updates.remainingSupply = Math.max(0, current.remainingSupply + diff);
    }
  }

  const [trait] = await db
    .update(traitsTable)
    .set(updates as Parameters<typeof db.update>[0] extends infer T ? T : never)
    .where(eq(traitsTable.id, pathParams.data.traitId))
    .returning();

  if (!trait) {
    res.status(404).json({ error: "Trait not found" });
    return;
  }

  res.json(UpdateTraitResponse.parse(trait));
});

router.delete("/admin/traits/:traitId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.traitId)
    ? req.params.traitId[0]
    : req.params.traitId;
  const pathParams = DeleteTraitParams.safeParse({ traitId: rawId });
  if (!pathParams.success) {
    res.status(400).json({ error: pathParams.error.message });
    return;
  }

  const [trait] = await db
    .delete(traitsTable)
    .where(eq(traitsTable.id, pathParams.data.traitId))
    .returning();

  if (!trait) {
    res.status(404).json({ error: "Trait not found" });
    return;
  }

  res.json(DeleteTraitResponse.parse({ success: true, message: "Trait deleted" }));
});

router.get("/admin/fees", async (_req, res): Promise<void> => {
  let [settings] = await db.select().from(storeSettingsTable).limit(1);

  if (!settings) {
    [settings] = await db
      .insert(storeSettingsTable)
      .values({
        buyingFeePercent: "0",
        buyingFeeWallet: null,
        sellingFeePercent: "0",
        sellingFeeWallet: null,
        marketplaceListingFeePercent: "0",
        marketplaceListingFeeWallet: null,
      })
      .returning();
  }

  res.json(settings);
});

router.put("/admin/fees", async (req, res): Promise<void> => {
  const body = UpdateFeesBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  let [existing] = await db.select().from(storeSettingsTable).limit(1);

  if (!existing) {
    const [created] = await db
      .insert(storeSettingsTable)
      .values({
        buyingFeePercent: body.data.buyingFeePercent,
        buyingFeeWallet: body.data.buyingFeeWallet ?? null,
        sellingFeePercent: body.data.sellingFeePercent,
        sellingFeeWallet: body.data.sellingFeeWallet ?? null,
        marketplaceListingFeePercent: body.data.marketplaceListingFeePercent ?? "0",
        marketplaceListingFeeWallet: body.data.marketplaceListingFeeWallet ?? null,
      })
      .returning();
    res.json(created);
    return;
  }

  const [updated] = await db
    .update(storeSettingsTable)
    .set({
      buyingFeePercent: body.data.buyingFeePercent,
      buyingFeeWallet: body.data.buyingFeeWallet ?? null,
      sellingFeePercent: body.data.sellingFeePercent,
      sellingFeeWallet: body.data.sellingFeeWallet ?? null,
      marketplaceListingFeePercent: body.data.marketplaceListingFeePercent ?? "0",
      marketplaceListingFeeWallet: body.data.marketplaceListingFeeWallet ?? null,
    })
    .where(eq(storeSettingsTable.id, existing.id))
    .returning();

  res.json(updated);
});

router.get("/admin/stats", async (_req, res): Promise<void> => {
  const [traitsResult, salesResult, activeResult, outOfStockResult] =
    await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(traitsTable),
      db.select({ count: sql<number>`count(*)::int` }).from(lockerItemsTable),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(traitsTable)
        .where(eq(traitsTable.isActive, true)),
      db.execute(
        sql`SELECT count(*)::int as count FROM traits WHERE remaining_supply = 0`,
      ),
    ]);

  const totalTraits = traitsResult[0]?.count ?? 0;
  const totalSales = salesResult[0]?.count ?? 0;
  const activeTraits = activeResult[0]?.count ?? 0;
  const outOfStockTraits =
    (outOfStockResult.rows[0] as { count: number })?.count ?? 0;

  const revenueResult = await db.execute(sql`
    SELECT sum(t.price_eth::numeric * li.quantity) as total
    FROM locker_items li
    JOIN traits t ON t.id = li.trait_id
  `);
  const totalRevenue =
    (revenueResult.rows[0] as { total: string | null })?.total ?? "0";

  const topSellingResult = await db.execute(sql`
    SELECT li.trait_id, t.name, count(*)::int as sales_count
    FROM locker_items li
    JOIN traits t ON t.id = li.trait_id
    GROUP BY li.trait_id, t.name
    ORDER BY sales_count DESC
    LIMIT 5
  `);

  const topSellingTraits = (
    topSellingResult.rows as { trait_id: number; name: string; sales_count: number }[]
  ).map((r) => ({
    traitId: r.trait_id,
    name: r.name,
    salesCount: r.sales_count,
  }));

  const recentActivityResult = await db.execute(sql`
    SELECT 'purchase' as type, li.wallet_address, t.name as trait_name, li.purchased_at as timestamp
    FROM locker_items li
    JOIN traits t ON t.id = li.trait_id
    ORDER BY li.purchased_at DESC
    LIMIT 10
  `);

  const recentActivity = (
    recentActivityResult.rows as {
      type: string;
      wallet_address: string;
      trait_name: string;
      timestamp: string;
    }[]
  ).map((r) => ({
    type: r.type,
    walletAddress: r.wallet_address,
    traitName: r.trait_name,
    timestamp: new Date(r.timestamp),
  }));

  res.json(
    GetAdminStatsResponse.parse({
      totalTraits,
      totalSales,
      totalRevenue: totalRevenue?.toString() ?? "0",
      activeTraits,
      outOfStockTraits,
      topSellingTraits,
      recentActivity,
    }),
  );
});

router.get("/admin/transactions", async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query["limit"] ?? 100), 500);
  const offset = Number(req.query["offset"] ?? 0);
  const type = req.query["type"] as string | undefined;

  const rows = await db.execute(sql`
    SELECT
      t.id,
      t.type,
      t.trait_id      AS "traitId",
      t.trait_name    AS "traitName",
      t.trait_category AS "traitCategory",
      t.trait_image_url AS "traitImageUrl",
      t.wallet_address AS "walletAddress",
      t.eth_amount    AS "ethAmount",
      t.tx_hash       AS "txHash",
      t.token_id      AS "tokenId",
      t.created_at    AS "createdAt"
    FROM transactions t
    ${type ? sql`WHERE t.type = ${type}` : sql``}
    ORDER BY t.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const countResult = await db.execute(sql`
    SELECT count(*)::int as total FROM transactions
    ${type ? sql`WHERE type = ${type}` : sql``}
  `);
  const total = (countResult.rows[0] as { total: number })?.total ?? 0;

  res.json({ transactions: rows.rows, total, limit, offset });
});

// ── GET /admin/layers ─────────────────────────────────────────────────────────

const DEFAULT_LAYER_ORDER = ["Headgear", "Eyes", "Mouth", "Clothes", "Body", "Background"];

router.get("/admin/layers", async (_req, res): Promise<void> => {
  let [settings] = await db.select().from(storeSettingsTable).limit(1);
  if (!settings) {
    [settings] = await db.insert(storeSettingsTable).values({
      buyingFeePercent: "0",
      buyingFeeWallet: null,
      sellingFeePercent: "0",
      sellingFeeWallet: null,
    }).returning();
  }
  const layerOrder = settings.layerOrder
    ? (JSON.parse(settings.layerOrder) as string[])
    : DEFAULT_LAYER_ORDER;
  res.json({ layerOrder });
});

// ── PUT /admin/layers ─────────────────────────────────────────────────────────

router.put("/admin/layers", async (req, res): Promise<void> => {
  const { layerOrder } = req.body as { layerOrder: string[] };
  if (!Array.isArray(layerOrder) || layerOrder.length === 0) {
    res.status(400).json({ error: "layerOrder must be a non-empty array" });
    return;
  }

  let [existing] = await db.select().from(storeSettingsTable).limit(1);
  if (!existing) {
    [existing] = await db.insert(storeSettingsTable).values({
      buyingFeePercent: "0",
      buyingFeeWallet: null,
      sellingFeePercent: "0",
      sellingFeeWallet: null,
      layerOrder: JSON.stringify(layerOrder),
    }).returning();
    res.json({ layerOrder: JSON.parse(existing.layerOrder ?? "[]") });
    return;
  }

  const [updated] = await db
    .update(storeSettingsTable)
    .set({ layerOrder: JSON.stringify(layerOrder) })
    .where(eq(storeSettingsTable.id, existing.id))
    .returning();
  res.json({ layerOrder: JSON.parse(updated.layerOrder ?? "[]") });
});

// ── Store Settings ────────────────────────────────────────────────────────────

const UpdateStoreSettingsBody = z.object({
  storeName: z.string().max(100).optional(),
  storeTagline: z.string().max(200).optional(),
  storeOpen: z.boolean().optional(),
  announcementBanner: z.string().max(300).nullable().optional(),
  maxTraitsPerOrder: z.number().int().min(1).max(100).optional(),
  contractAddress: z.string().nullable().optional(),
  collectionWallet: z.string().nullable().optional(),
  networkName: z.string().optional(),
  twitterUrl: z.string().url().nullable().optional().or(z.literal("")),
  discordUrl: z.string().url().nullable().optional().or(z.literal("")),
  websiteUrl: z.string().url().nullable().optional().or(z.literal("")),
  contactEmail: z.string().email().nullable().optional().or(z.literal("")),
  maintenanceMode: z.boolean().optional(),
  maintenanceWhitelist: z.array(z.string()).optional(),
  ineligibleNfts: z.array(z.string()).optional(),
});

const DEFAULT_STORE_SETTINGS = {
  buyingFeePercent: "0",
  buyingFeeWallet: null as null | string,
  sellingFeePercent: "0",
  sellingFeeWallet: null as null | string,
};

function serializeStoreSettings(settings: typeof storeSettingsTable.$inferSelect) {
  const ciphertext = settings.updateAuthorityKeyCiphertext;
  let hasUpdateAuthorityKey = false;
  if (ciphertext) {
    try { hasUpdateAuthorityKey = verifyStoredKey(ciphertext); } catch { hasUpdateAuthorityKey = false; }
  }
  return {
    storeName: settings.storeName ?? "Wegen Trait Store",
    storeTagline: settings.storeTagline ?? "",
    storeOpen: settings.storeOpen ?? true,
    announcementBanner: settings.announcementBanner ?? null,
    maxTraitsPerOrder: settings.maxTraitsPerOrder ?? 10,
    contractAddress: settings.contractAddress ?? null,
    collectionWallet: settings.collectionWallet ?? null,
    networkName: settings.networkName ?? "mainnet",
    twitterUrl: settings.twitterUrl ?? null,
    discordUrl: settings.discordUrl ?? null,
    websiteUrl: settings.websiteUrl ?? null,
    contactEmail: settings.contactEmail ?? null,
    maintenanceMode: settings.maintenanceMode ?? false,
    maintenanceWhitelist: JSON.parse(settings.maintenanceWhitelist ?? "[]") as string[],
    ineligibleNfts: JSON.parse(settings.ineligibleNfts ?? "[]") as string[],
    hasUpdateAuthorityKey,
  };
}

router.get("/admin/store-settings", async (_req, res): Promise<void> => {
  let [settings] = await db.select().from(storeSettingsTable).limit(1);
  if (!settings) {
    [settings] = await db.insert(storeSettingsTable).values(DEFAULT_STORE_SETTINGS).returning();
  }
  res.json(serializeStoreSettings(settings));
});

router.put("/admin/store-settings", async (req, res): Promise<void> => {
  const body = UpdateStoreSettingsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.issues.map(i => i.message).join(", ") });
    return;
  }

  let [existing] = await db.select().from(storeSettingsTable).limit(1);
  if (!existing) {
    [existing] = await db.insert(storeSettingsTable).values(DEFAULT_STORE_SETTINGS).returning();
  }

  const toUpdate: Record<string, unknown> = {};
  const d = body.data;
  if (d.storeName !== undefined) toUpdate.storeName = d.storeName;
  if (d.storeTagline !== undefined) toUpdate.storeTagline = d.storeTagline;
  if (d.storeOpen !== undefined) toUpdate.storeOpen = d.storeOpen;
  if (d.announcementBanner !== undefined) toUpdate.announcementBanner = d.announcementBanner || null;
  if (d.maxTraitsPerOrder !== undefined) toUpdate.maxTraitsPerOrder = d.maxTraitsPerOrder;
  if (d.contractAddress !== undefined) toUpdate.contractAddress = d.contractAddress || null;
  if (d.collectionWallet !== undefined) toUpdate.collectionWallet = d.collectionWallet || null;
  if (d.networkName !== undefined) toUpdate.networkName = d.networkName;
  if (d.twitterUrl !== undefined) toUpdate.twitterUrl = d.twitterUrl || null;
  if (d.discordUrl !== undefined) toUpdate.discordUrl = d.discordUrl || null;
  if (d.websiteUrl !== undefined) toUpdate.websiteUrl = d.websiteUrl || null;
  if (d.contactEmail !== undefined) toUpdate.contactEmail = d.contactEmail || null;
  if (d.maintenanceMode !== undefined) toUpdate.maintenanceMode = d.maintenanceMode;
  if (d.maintenanceWhitelist !== undefined) {
    const normalized = d.maintenanceWhitelist.map((w: string) => w.trim().toLowerCase());
    toUpdate.maintenanceWhitelist = JSON.stringify(normalized);
  }
  if (d.ineligibleNfts !== undefined) {
    const normalized = d.ineligibleNfts.map((id: string) => id.trim().toLowerCase());
    toUpdate.ineligibleNfts = JSON.stringify(normalized);
  }

  const [updated] = await db
    .update(storeSettingsTable)
    .set(toUpdate)
    .where(eq(storeSettingsTable.id, existing.id))
    .returning();

  res.json(serializeStoreSettings(updated));
});

// ── Game Settings ─────────────────────────────────────────────────────────────

const UpdateGameSettingsBody = z.object({
  dailyGameEnabled: z.boolean().optional(),
  dailyGameOverrides: z.record(z.string(), z.record(z.string(), z.number().nullable())).optional(),
  celebrationGifUrl: z.string().nullable().optional(),
});

function serializeGameSettings(settings: typeof storeSettingsTable.$inferSelect) {
  return {
    dailyGameEnabled: settings.dailyGameEnabled ?? true,
    dailyGameOverrides: JSON.parse(settings.dailyGameOverrides ?? "{}") as Record<string, Record<string, number | null>>,
    celebrationGifUrl: settings.celebrationGifUrl ?? null,
  };
}

router.get("/admin/game-settings", async (_req, res): Promise<void> => {
  let [settings] = await db.select().from(storeSettingsTable).limit(1);
  if (!settings) {
    [settings] = await db.insert(storeSettingsTable).values(DEFAULT_STORE_SETTINGS).returning();
  }
  res.json(serializeGameSettings(settings));
});

router.put("/admin/game-settings", async (req, res): Promise<void> => {
  const body = UpdateGameSettingsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.issues.map(i => i.message).join(", ") });
    return;
  }
  let [existing] = await db.select().from(storeSettingsTable).limit(1);
  if (!existing) {
    [existing] = await db.insert(storeSettingsTable).values(DEFAULT_STORE_SETTINGS).returning();
  }
  const toUpdate: Record<string, unknown> = {};
  const d = body.data;
  if (d.dailyGameEnabled !== undefined) toUpdate.dailyGameEnabled = d.dailyGameEnabled;
  if (d.celebrationGifUrl !== undefined) toUpdate.celebrationGifUrl = d.celebrationGifUrl || null;
  if (d.dailyGameOverrides !== undefined) toUpdate.dailyGameOverrides = JSON.stringify(d.dailyGameOverrides);
  const [updated] = await db.update(storeSettingsTable).set(toUpdate).where(eq(storeSettingsTable.id, existing.id)).returning();
  res.json(serializeGameSettings(updated));
});

// ── Update Authority Key (set / clear) ────────────────────────────────────────

const SetAuthorityKeyBody = z.object({
  key: z.string().min(1, "Key must not be empty"),
});

router.post("/admin/update-authority-key", async (req, res): Promise<void> => {
  const body = SetAuthorityKeyBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.issues[0]?.message ?? "Invalid request" });
    return;
  }
  let ciphertext: string;
  try {
    ciphertext = encryptAuthorityKey(body.data.key);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Encryption failed";
    res.status(500).json({ error: msg });
    return;
  }
  let [existing] = await db.select().from(storeSettingsTable).limit(1);
  if (!existing) {
    [existing] = await db.insert(storeSettingsTable).values({ buyingFeePercent: "0", sellingFeePercent: "0" }).returning();
  }
  const [updated] = await db
    .update(storeSettingsTable)
    .set({ updateAuthorityKeyCiphertext: ciphertext })
    .where(eq(storeSettingsTable.id, existing.id))
    .returning();
  res.json({ hasUpdateAuthorityKey: true, message: "Update authority key encrypted and stored." });
  void updated;
});

router.delete("/admin/update-authority-key", async (_req, res): Promise<void> => {
  let [existing] = await db.select().from(storeSettingsTable).limit(1);
  if (!existing) {
    res.json({ hasUpdateAuthorityKey: false, message: "No key was stored." });
    return;
  }
  await db
    .update(storeSettingsTable)
    .set({ updateAuthorityKeyCiphertext: null })
    .where(eq(storeSettingsTable.id, existing.id));
  res.json({ hasUpdateAuthorityKey: false, message: "Update authority key cleared." });
});

// ── Rarity Tiers ─────────────────────────────────────────────────────────────

const DEFAULT_RARITIES = [
  { name: "legendary", rank: 1, color: "#F59E0B" },
  { name: "rare",      rank: 2, color: "#60A5FA" },
  { name: "uncommon",  rank: 3, color: "#34D399" },
  { name: "common",    rank: 4, color: "#9CA3AF" },
];

async function ensureDefaultRarities() {
  const existing = await db.select().from(rarityTiersTable);
  if (existing.length === 0) {
    await db.insert(rarityTiersTable).values(DEFAULT_RARITIES);
  }
}

router.get("/admin/rarities", async (_req, res): Promise<void> => {
  await ensureDefaultRarities();
  const tiers = await db
    .select()
    .from(rarityTiersTable)
    .orderBy(asc(rarityTiersTable.rank));
  res.json({ tiers });
});

const CreateRarityBody = z.object({
  name: z.string().min(1).max(64),
  color: z.string().optional().default("#888888"),
});

router.post("/admin/rarities", async (req, res): Promise<void> => {
  const body = CreateRarityBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const name = body.data.name.toLowerCase().trim();
  const existing = await db
    .select()
    .from(rarityTiersTable)
    .where(eq(rarityTiersTable.name, name));
  if (existing.length > 0) {
    res.status(409).json({ error: `Rarity "${name}" already exists` });
    return;
  }
  const maxRankResult = await db.execute(
    sql`SELECT COALESCE(MAX(rank), 0) as max_rank FROM rarity_tiers`
  );
  const maxRank = Number((maxRankResult.rows[0] as { max_rank: number }).max_rank ?? 0);
  const [tier] = await db
    .insert(rarityTiersTable)
    .values({ name, rank: maxRank + 1, color: body.data.color })
    .returning();
  res.status(201).json({ tier });
});

const UpdateRarityBody = z.object({
  name: z.string().min(1).max(64).optional(),
  color: z.string().optional(),
  rank: z.number().int().optional(),
});

router.patch("/admin/rarities/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = UpdateRarityBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid body" }); return; }

  const [updated] = await db
    .update(rarityTiersTable)
    .set(body.data)
    .where(eq(rarityTiersTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ tier: updated });
});

router.delete("/admin/rarities/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(rarityTiersTable).where(eq(rarityTiersTable.id, id));
  res.json({ ok: true });
});

// Move rarity up (swap with the tier above it — lower rank number)
router.post("/admin/rarities/:id/move-up", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const tiers = await db
    .select()
    .from(rarityTiersTable)
    .orderBy(asc(rarityTiersTable.rank));
  const idx = tiers.findIndex(t => t.id === id);
  if (idx <= 0) { res.json({ tiers }); return; }
  const above = tiers[idx - 1];
  const current = tiers[idx];
  await db.update(rarityTiersTable).set({ rank: above.rank }).where(eq(rarityTiersTable.id, current.id));
  await db.update(rarityTiersTable).set({ rank: current.rank }).where(eq(rarityTiersTable.id, above.id));
  const updated = await db.select().from(rarityTiersTable).orderBy(asc(rarityTiersTable.rank));
  res.json({ tiers: updated });
});

// Move rarity down (swap with the tier below it — higher rank number)
router.post("/admin/rarities/:id/move-down", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const tiers = await db
    .select()
    .from(rarityTiersTable)
    .orderBy(asc(rarityTiersTable.rank));
  const idx = tiers.findIndex(t => t.id === id);
  if (idx < 0 || idx >= tiers.length - 1) { res.json({ tiers }); return; }
  const below = tiers[idx + 1];
  const current = tiers[idx];
  await db.update(rarityTiersTable).set({ rank: below.rank }).where(eq(rarityTiersTable.id, current.id));
  await db.update(rarityTiersTable).set({ rank: current.rank }).where(eq(rarityTiersTable.id, below.id));
  const updated = await db.select().from(rarityTiersTable).orderBy(asc(rarityTiersTable.rank));
  res.json({ tiers: updated });
});

/* ── Airdrop ────────────────────────────────────────────────────────────── */

const ETH_ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

const AirdropBody = z.object({
  walletAddresses: z
    .array(z.string().regex(ETH_ADDR_RE, "Invalid ETH address"))
    .min(1, "At least one wallet address required")
    .max(50, "Maximum 50 wallets per airdrop"),
  traitIds: z.array(z.number().int().positive()).min(1).max(100),
});

router.post("/admin/airdrop", async (req, res): Promise<void> => {
  const body = AirdropBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.issues[0]?.message ?? "Invalid body" }); return; }

  const { walletAddresses, traitIds } = body.data;

  const traits = await db.select({ id: traitsTable.id }).from(traitsTable).where(inArray(traitsTable.id, traitIds));
  const foundIds = new Set(traits.map((t) => t.id));
  const missing = traitIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) { res.status(404).json({ error: `Trait IDs not found: ${missing.join(", ")}` }); return; }

  const rows = walletAddresses.flatMap((walletAddress) =>
    traitIds.map((traitId) => ({
      traitId,
      walletAddress: walletAddress.toLowerCase(),
      quantity: 1,
      txHash: "AIRDROP",
    }))
  );

  const inserted = await db.insert(lockerItemsTable).values(rows).returning();
  res.json({ ok: true, count: inserted.length, wallets: walletAddresses.length, traitsPerWallet: traitIds.length });
});

router.get("/admin/airdrop-history", async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const rows = await db
    .select({
      id: lockerItemsTable.id,
      walletAddress: lockerItemsTable.walletAddress,
      traitId: lockerItemsTable.traitId,
      traitName: traitsTable.name,
      traitCategory: traitsTable.category,
      traitImageUrl: traitsTable.imageUrl,
      purchasedAt: lockerItemsTable.purchasedAt,
    })
    .from(lockerItemsTable)
    .innerJoin(traitsTable, eq(lockerItemsTable.traitId, traitsTable.id))
    .where(eq(lockerItemsTable.txHash, "AIRDROP"))
    .orderBy(desc(lockerItemsTable.purchasedAt))
    .limit(limit);
  res.json({ airdrops: rows });
});

export default router;

