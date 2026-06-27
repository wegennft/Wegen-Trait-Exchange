import { Router, type IRouter } from "express";
import { eq, and, sql, desc, isNull, sum } from "drizzle-orm";
import {
  db,
  walletPointsTable,
  pointTransactionsTable,
  bountyTraitsTable,
  bountyPurchasesTable,
  dailyBountyCompletionsTable,
} from "@workspace/db";
import { requireWalletOwnership } from "../middleware/requireAuth";

const router: IRouter = Router();

const DAILY_BOUNTY_LIMIT = 5;
const BOUNTY_POINTS_PER_COMPLETION = 1;
const MAX_BOUNTY_TRAIT_PER_WALLET = 2;

// ── Shared helper: upsert points ──────────────────────────────────────────────

export async function awardPoints(
  walletAddress: string,
  points: number,
  type: "purchase" | "confirm_traits" | "sandbox_bounty" | "redeem" | "admin_airdrop",
  description?: string,
  pending = false,
) {
  // Pending transactions (admin airdrops) are NOT added to wallet total yet
  if (!pending) {
    await db
      .insert(walletPointsTable)
      .values({ walletAddress, totalPoints: points, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: walletPointsTable.walletAddress,
        set: {
          totalPoints: sql`${walletPointsTable.totalPoints} + ${points}`,
          updatedAt: new Date(),
        },
      });
  }

  await db.insert(pointTransactionsTable).values({
    walletAddress,
    type,
    points,
    description: description ?? null,
    claimedAt: pending ? null : new Date(),
  });
}

// ── GET /bounties/leaderboard ─────────────────────────────────────────────────

router.get("/bounties/leaderboard", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      walletAddress: walletPointsTable.walletAddress,
      totalPoints: walletPointsTable.totalPoints,
      updatedAt: walletPointsTable.updatedAt,
    })
    .from(walletPointsTable)
    .orderBy(desc(walletPointsTable.totalPoints))
    .limit(50);

  res.json({ leaderboard: rows });
});

// ── GET /bounties/me ──────────────────────────────────────────────────────────

router.get(
  "/bounties/me",
  requireWalletOwnership(),
  async (req, res): Promise<void> => {
    const walletAddress = req.session.walletAddress!;

    const [pointRow] = await db
      .select()
      .from(walletPointsTable)
      .where(eq(walletPointsTable.walletAddress, walletAddress));

    const totalPoints = pointRow?.totalPoints ?? 0;

    // Rank = count wallets with more points + 1
    const [rankRow] = await db.execute<{ rank: number }>(
      sql`SELECT COUNT(*)::int + 1 AS rank FROM wallet_points WHERE total_points > ${totalPoints}`,
    );
    const rank = rankRow?.rank ?? 1;

    // Daily sandbox completions today
    const today = new Date().toISOString().slice(0, 10);
    const [dayRow] = await db
      .select()
      .from(dailyBountyCompletionsTable)
      .where(
        and(
          eq(dailyBountyCompletionsTable.walletAddress, walletAddress),
          eq(dailyBountyCompletionsTable.completedDate, today),
        ),
      );
    const dailyCompletions = dayRow?.count ?? 0;

    // Pending (unclaimed) points from admin airdrops
    const [pendingRow] = await db
      .select({ total: sum(pointTransactionsTable.points) })
      .from(pointTransactionsTable)
      .where(
        and(
          eq(pointTransactionsTable.walletAddress, walletAddress),
          isNull(pointTransactionsTable.claimedAt),
        ),
      );
    const pendingPoints = Number(pendingRow?.total ?? 0);

    // Recent point history (last 20)
    const history = await db
      .select()
      .from(pointTransactionsTable)
      .where(eq(pointTransactionsTable.walletAddress, walletAddress))
      .orderBy(desc(pointTransactionsTable.createdAt))
      .limit(20);

    res.json({ totalPoints, rank, dailyCompletions, dailyLimit: DAILY_BOUNTY_LIMIT, pendingPoints, history });
  },
);

// ── POST /bounties/sandbox-complete ───────────────────────────────────────────

router.post(
  "/bounties/sandbox-complete",
  requireWalletOwnership(),
  async (req, res): Promise<void> => {
    const walletAddress = req.session.walletAddress!;
    const today = new Date().toISOString().slice(0, 10);

    const [dayRow] = await db
      .select()
      .from(dailyBountyCompletionsTable)
      .where(
        and(
          eq(dailyBountyCompletionsTable.walletAddress, walletAddress),
          eq(dailyBountyCompletionsTable.completedDate, today),
        ),
      );

    const currentCount = dayRow?.count ?? 0;

    if (currentCount >= DAILY_BOUNTY_LIMIT) {
      res.status(429).json({
        error: `Daily bounty limit reached (${DAILY_BOUNTY_LIMIT}/day)`,
        dailyCompletions: currentCount,
        dailyLimit: DAILY_BOUNTY_LIMIT,
      });
      return;
    }

    if (dayRow) {
      await db
        .update(dailyBountyCompletionsTable)
        .set({ count: currentCount + 1 })
        .where(eq(dailyBountyCompletionsTable.id, dayRow.id));
    } else {
      await db
        .insert(dailyBountyCompletionsTable)
        .values({ walletAddress, completedDate: today, count: 1 });
    }

    await awardPoints(walletAddress, BOUNTY_POINTS_PER_COMPLETION, "sandbox_bounty", "Sandbox bounty completed");

    res.json({
      success: true,
      pointsAwarded: BOUNTY_POINTS_PER_COMPLETION,
      dailyCompletions: currentCount + 1,
      dailyLimit: DAILY_BOUNTY_LIMIT,
    });
  },
);

// ── POST /bounties/claim-points ───────────────────────────────────────────────

router.post(
  "/bounties/claim-points",
  requireWalletOwnership(),
  async (req, res): Promise<void> => {
    const walletAddress = req.session.walletAddress!;

    // Find all pending (unclaimed) transactions for this wallet
    const pending = await db
      .select()
      .from(pointTransactionsTable)
      .where(
        and(
          eq(pointTransactionsTable.walletAddress, walletAddress),
          isNull(pointTransactionsTable.claimedAt),
        ),
      );

    if (pending.length === 0) {
      res.status(400).json({ error: "No pending points to claim" });
      return;
    }

    const totalClaiming = pending.reduce((s, t) => s + t.points, 0);
    const now = new Date();

    // Mark all pending as claimed
    await db
      .update(pointTransactionsTable)
      .set({ claimedAt: now })
      .where(
        and(
          eq(pointTransactionsTable.walletAddress, walletAddress),
          isNull(pointTransactionsTable.claimedAt),
        ),
      );

    // Add to wallet total
    await db
      .insert(walletPointsTable)
      .values({ walletAddress, totalPoints: totalClaiming, updatedAt: now })
      .onConflictDoUpdate({
        target: walletPointsTable.walletAddress,
        set: {
          totalPoints: sql`${walletPointsTable.totalPoints} + ${totalClaiming}`,
          updatedAt: now,
        },
      });

    res.json({ success: true, pointsClaimed: totalClaiming });
  },
);

// ── GET /bounties/traits ──────────────────────────────────────────────────────

router.get("/bounties/traits", async (req, res): Promise<void> => {
  const walletAddress = req.session?.walletAddress ?? null;

  const traits = await db
    .select()
    .from(bountyTraitsTable)
    .where(eq(bountyTraitsTable.isActive, 1))
    .orderBy(bountyTraitsTable.pointCost);

  if (!walletAddress) {
    res.json({ traits: traits.map((t) => ({ ...t, walletPurchaseCount: 0 })) });
    return;
  }

  const purchases = await db
    .select({
      bountyTraitId: bountyPurchasesTable.bountyTraitId,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(bountyPurchasesTable)
    .where(eq(bountyPurchasesTable.walletAddress, walletAddress))
    .groupBy(bountyPurchasesTable.bountyTraitId);

  const purchaseMap = Object.fromEntries(
    purchases.map((p) => [p.bountyTraitId, p.count]),
  );

  res.json({
    traits: traits.map((t) => ({
      ...t,
      walletPurchaseCount: purchaseMap[t.id] ?? 0,
    })),
  });
});

// ── POST /bounties/traits/:id/redeem ─────────────────────────────────────────

router.post(
  "/bounties/traits/:id/redeem",
  requireWalletOwnership(),
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const traitId = parseInt(rawId, 10);
    if (isNaN(traitId)) {
      res.status(400).json({ error: "Invalid trait ID" });
      return;
    }

    const walletAddress = req.session.walletAddress!;

    const [trait] = await db
      .select()
      .from(bountyTraitsTable)
      .where(eq(bountyTraitsTable.id, traitId));

    if (!trait || !trait.isActive) {
      res.status(404).json({ error: "Bounty trait not found or inactive" });
      return;
    }

    if (trait.remainingSupply !== -1 && trait.remainingSupply <= 0) {
      res.status(400).json({ error: "Bounty trait is sold out" });
      return;
    }

    // Check wallet purchase limit
    const [purchaseCount] = await db.execute<{ count: number }>(
      sql`SELECT COUNT(*)::int AS count FROM bounty_purchases WHERE wallet_address = ${walletAddress} AND bounty_trait_id = ${traitId}`,
    );
    const alreadyOwned = purchaseCount?.count ?? 0;
    if (alreadyOwned >= MAX_BOUNTY_TRAIT_PER_WALLET) {
      res.status(400).json({
        error: `Limit reached — max ${MAX_BOUNTY_TRAIT_PER_WALLET} of this trait per wallet`,
      });
      return;
    }

    // Check user has enough points
    const [pointRow] = await db
      .select()
      .from(walletPointsTable)
      .where(eq(walletPointsTable.walletAddress, walletAddress));
    const currentPoints = pointRow?.totalPoints ?? 0;

    if (currentPoints < trait.pointCost) {
      res.status(400).json({
        error: `Not enough points (need ${trait.pointCost}, have ${currentPoints})`,
      });
      return;
    }

    // Deduct points
    await awardPoints(walletAddress, -trait.pointCost, "redeem", `Redeemed: ${trait.name}`);

    // Record purchase
    await db.insert(bountyPurchasesTable).values({ walletAddress, bountyTraitId: traitId });

    // Decrement supply if finite
    if (trait.remainingSupply !== -1) {
      await db
        .update(bountyTraitsTable)
        .set({ remainingSupply: trait.remainingSupply - 1 })
        .where(eq(bountyTraitsTable.id, traitId));
    }

    res.json({
      success: true,
      traitName: trait.name,
      pointsSpent: trait.pointCost,
      remainingPoints: currentPoints - trait.pointCost,
    });
  },
);

// ── Admin: POST /admin/bounties/send-points ───────────────────────────────────

router.post("/admin/bounties/send-points", async (req, res): Promise<void> => {
  const { wallets, points, description } = req.body as {
    wallets?: string[];
    points?: number;
    description?: string;
  };

  if (!Array.isArray(wallets) || wallets.length === 0) {
    res.status(400).json({ error: "wallets array is required" });
    return;
  }
  if (typeof points !== "number" || points <= 0) {
    res.status(400).json({ error: "points must be a positive number" });
    return;
  }

  const desc_text = description?.trim() || "Admin point airdrop";
  const results: { wallet: string; ok: boolean; error?: string }[] = [];

  for (const raw of wallets) {
    const wallet = raw.trim();
    if (!wallet) continue;
    try {
      // Insert pending transaction (claimedAt = null — user must claim)
      await awardPoints(wallet, points, "admin_airdrop", desc_text, true);
      results.push({ wallet, ok: true });
    } catch (err) {
      results.push({ wallet, ok: false, error: String(err) });
    }
  }

  res.json({ success: true, results });
});

// ── Admin: GET /admin/bounties/traits ─────────────────────────────────────────

router.get("/admin/bounties/traits", async (_req, res): Promise<void> => {
  const traits = await db
    .select()
    .from(bountyTraitsTable)
    .orderBy(bountyTraitsTable.createdAt);

  const counts = await db
    .select({
      bountyTraitId: bountyPurchasesTable.bountyTraitId,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(bountyPurchasesTable)
    .groupBy(bountyPurchasesTable.bountyTraitId);

  const countMap = Object.fromEntries(counts.map((c) => [c.bountyTraitId, c.count]));

  res.json({ traits: traits.map((t) => ({ ...t, totalRedeemed: countMap[t.id] ?? 0 })) });
});

// ── Admin: POST /admin/bounties/traits ────────────────────────────────────────

router.post("/admin/bounties/traits", async (req, res): Promise<void> => {
  const { name, description, imageUrl, pointCost, totalSupply } = req.body as {
    name?: string; description?: string; imageUrl?: string;
    pointCost?: number; totalSupply?: number;
  };

  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const supply = typeof totalSupply === "number" ? totalSupply : -1;

  const [trait] = await db
    .insert(bountyTraitsTable)
    .values({
      name,
      description: description ?? null,
      imageUrl: imageUrl ?? null,
      pointCost: typeof pointCost === "number" ? pointCost : 100,
      totalSupply: supply,
      remainingSupply: supply,
      isActive: 1,
    })
    .returning();

  res.status(201).json({ trait });
});

// ── Admin: PATCH /admin/bounties/traits/:id ───────────────────────────────────

router.patch("/admin/bounties/traits/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const traitId = parseInt(rawId, 10);
  if (isNaN(traitId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { name, description, imageUrl, pointCost, totalSupply, remainingSupply, isActive } = req.body as Record<string, unknown>;

  const update: Partial<typeof bountyTraitsTable.$inferInsert> = {};
  if (typeof name === "string") update.name = name;
  if (typeof description === "string") update.description = description;
  if (typeof imageUrl === "string" || imageUrl === null) update.imageUrl = imageUrl as string | null;
  if (typeof pointCost === "number") update.pointCost = pointCost;
  if (typeof totalSupply === "number") update.totalSupply = totalSupply;
  if (typeof remainingSupply === "number") update.remainingSupply = remainingSupply;
  if (typeof isActive === "number") update.isActive = isActive;

  const [updated] = await db
    .update(bountyTraitsTable)
    .set(update)
    .where(eq(bountyTraitsTable.id, traitId))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }

  res.json({ trait: updated });
});

// ── Admin: DELETE /admin/bounties/traits/:id ──────────────────────────────────

router.delete("/admin/bounties/traits/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const traitId = parseInt(rawId, 10);
  if (isNaN(traitId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  await db.delete(bountyPurchasesTable).where(eq(bountyPurchasesTable.bountyTraitId, traitId));
  await db.delete(bountyTraitsTable).where(eq(bountyTraitsTable.id, traitId));

  res.json({ success: true });
});

// ── Admin: GET /admin/bounties/leaderboard ────────────────────────────────────

router.get("/admin/bounties/leaderboard", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(walletPointsTable)
    .orderBy(desc(walletPointsTable.totalPoints))
    .limit(100);

  res.json({ leaderboard: rows });
});

// ── Admin: GET /admin/bounties/point-log ──────────────────────────────────────

router.get("/admin/bounties/point-log", async (req, res): Promise<void> => {
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
  const limit = 50;
  const offset = (page - 1) * limit;

  const rows = await db
    .select()
    .from(pointTransactionsTable)
    .orderBy(desc(pointTransactionsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({ log: rows, page, limit });
});

export default router;
