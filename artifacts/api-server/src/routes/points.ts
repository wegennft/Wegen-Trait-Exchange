import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, pointPacksTable, walletPointsTable, storePointPurchasesTable } from "@workspace/db";
import {
  ListPointPacksResponse,
  ListAdminPointPacksResponse,
  CreatePointPackBody,
  PurchasePointPackBody,
  GetStorePointsResponse,
} from "@workspace/api-zod";
import { requireWalletOwnership, requireAdmin } from "../middleware/requireAuth";
import { awardPoints } from "./bounties";

const router: IRouter = Router();

// All /admin/* routes on this router require an authenticated admin session.
router.use("/admin", requireAdmin);

function parseId(raw: unknown): number | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// ── GET /point-packs (public, active only) ────────────────────────────────────

router.get("/point-packs", async (_req, res): Promise<void> => {
  const pointPacks = await db
    .select()
    .from(pointPacksTable)
    .where(eq(pointPacksTable.isActive, true))
    .orderBy(pointPacksTable.id);

  res.json(ListPointPacksResponse.parse({ pointPacks }));
});

// ── GET /wallet/:walletAddress/points ─────────────────────────────────────────

router.get("/wallet/:walletAddress/points", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.walletAddress)
    ? req.params.walletAddress[0]
    : req.params.walletAddress;
  const walletAddress = raw?.toLowerCase();
  if (!walletAddress) {
    res.status(400).json({ error: "Invalid wallet address" });
    return;
  }

  const [row] = await db
    .select()
    .from(walletPointsTable)
    .where(eq(walletPointsTable.walletAddress, walletAddress));

  res.json(
    GetStorePointsResponse.parse({
      walletAddress,
      totalPoints: row?.totalPoints ?? 0,
    }),
  );
});

// ── POST /point-packs/:packId/purchase ────────────────────────────────────────

router.post(
  "/point-packs/:packId/purchase",
  requireWalletOwnership(),
  async (req, res): Promise<void> => {
    const packId = parseId(req.params.packId);
    if (!packId) {
      res.status(400).json({ error: "Invalid point pack id" });
      return;
    }

    const body = PurchasePointPackBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const { ethAmount, ethPriceAtPurchase, txHash } = body.data;
    const walletAddress = body.data.walletAddress.toLowerCase();

    const [pack] = await db
      .select()
      .from(pointPacksTable)
      .where(eq(pointPacksTable.id, packId));

    if (!pack || !pack.isActive) {
      res.status(404).json({ error: "Point pack not found" });
      return;
    }

    await db.insert(storePointPurchasesTable).values({
      walletAddress,
      pointPackId: packId,
      pointsGranted: pack.pointsGranted,
      usdValue: pack.usdValue,
      ethAmount,
      ethPriceAtPurchase,
      txHash: txHash ?? null,
    });

    // Purchased We Smackz are credited immediately (not pending) to the same
    // shared wallet_points balance used by bounties/airdrops/redemptions.
    await awardPoints(walletAddress, pack.pointsGranted, "purchase", `Purchased pack: ${pack.name}`);

    const [updated] = await db
      .select()
      .from(walletPointsTable)
      .where(eq(walletPointsTable.walletAddress, walletAddress));

    res.status(201).json(
      GetStorePointsResponse.parse({
        walletAddress,
        totalPoints: updated?.totalPoints ?? pack.pointsGranted,
      }),
    );
  },
);

// ── Admin: point pack CRUD ─────────────────────────────────────────────────────

router.get("/admin/point-packs", async (_req, res): Promise<void> => {
  const pointPacks = await db
    .select()
    .from(pointPacksTable)
    .orderBy(desc(pointPacksTable.createdAt));

  res.json(ListAdminPointPacksResponse.parse({ pointPacks }));
});

router.post("/admin/point-packs", async (req, res): Promise<void> => {
  const body = CreatePointPackBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [pack] = await db
    .insert(pointPacksTable)
    .values({
      name: body.data.name,
      description: body.data.description ?? null,
      imageUrl: body.data.imageUrl ?? null,
      usdValue: body.data.usdValue,
      pointsGranted: body.data.pointsGranted,
      isActive: body.data.isActive ?? true,
    })
    .returning();

  res.status(201).json(pack);
});

router.put("/admin/point-packs/:packId", async (req, res): Promise<void> => {
  const packId = parseId(req.params.packId);
  if (!packId) {
    res.status(400).json({ error: "Invalid point pack id" });
    return;
  }

  const body = CreatePointPackBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [pack] = await db
    .update(pointPacksTable)
    .set({
      name: body.data.name,
      description: body.data.description ?? null,
      imageUrl: body.data.imageUrl ?? null,
      usdValue: body.data.usdValue,
      pointsGranted: body.data.pointsGranted,
      isActive: body.data.isActive ?? true,
    })
    .where(eq(pointPacksTable.id, packId))
    .returning();

  if (!pack) {
    res.status(404).json({ error: "Point pack not found" });
    return;
  }

  res.json(pack);
});

router.delete("/admin/point-packs/:packId", async (req, res): Promise<void> => {
  const packId = parseId(req.params.packId);
  if (!packId) {
    res.status(400).json({ error: "Invalid point pack id" });
    return;
  }

  await db.delete(pointPacksTable).where(eq(pointPacksTable.id, packId));
  res.json({ success: true });
});

export default router;
