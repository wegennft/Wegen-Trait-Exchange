import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, traitsTable, lockerItemsTable } from "@workspace/db";
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

router.post("/admin/traits", async (req, res): Promise<void> => {
  const body = CreateTraitBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { name, category, description, imageUrl, priceEth, totalSupply, rarity, isActive } =
    body.data;

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
      description: description ?? null,
      imageUrl: imageUrl ?? null,
      priceEth,
      priceWei,
      totalSupply,
      remainingSupply: totalSupply,
      rarity: rarity as "common" | "uncommon" | "rare" | "legendary",
      isActive: isActive ?? true,
    })
    .returning();

  res.status(201).json(trait);
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

  const updates: Record<string, unknown> = { ...body.data };

  if (body.data.priceEth) {
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

export default router;
