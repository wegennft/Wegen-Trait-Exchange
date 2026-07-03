import { Router, type IRouter } from "express";
import { eq, inArray, desc } from "drizzle-orm";
import { ethers } from "ethers";
import {
  db,
  traitBundlesTable,
  bundleItemsTable,
  bundlePurchasesTable,
  traitsTable,
  lockerItemsTable,
} from "@workspace/db";
import {
  ListBundlesResponse,
  ListAdminBundlesResponse,
  CreateBundleBody,
  PurchaseBundleBody,
} from "@workspace/api-zod";
import { requireWalletOwnership } from "../middleware/requireAuth";

const router: IRouter = Router();

function parseId(raw: unknown): number | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function loadBundlesWithTraits(bundleRows: (typeof traitBundlesTable.$inferSelect)[]) {
  if (bundleRows.length === 0) return [];

  const items = await db
    .select({
      bundleId: bundleItemsTable.bundleId,
      trait: traitsTable,
    })
    .from(bundleItemsTable)
    .innerJoin(traitsTable, eq(bundleItemsTable.traitId, traitsTable.id))
    .where(
      inArray(
        bundleItemsTable.bundleId,
        bundleRows.map((b) => b.id),
      ),
    );

  return bundleRows.map((bundle) => ({
    ...bundle,
    traits: items.filter((i) => i.bundleId === bundle.id).map((i) => i.trait),
  }));
}

// ── GET /bundles (public, active only) ────────────────────────────────────────

router.get("/bundles", async (_req, res): Promise<void> => {
  const bundleRows = await db
    .select()
    .from(traitBundlesTable)
    .where(eq(traitBundlesTable.isActive, true))
    .orderBy(traitBundlesTable.id);

  const bundles = await loadBundlesWithTraits(bundleRows);

  res.json(ListBundlesResponse.parse({ bundles }));
});

// ── POST /bundles/:bundleId/purchase ──────────────────────────────────────────

router.post(
  "/bundles/:bundleId/purchase",
  requireWalletOwnership(),
  async (req, res): Promise<void> => {
    const bundleId = parseId(req.params.bundleId);
    if (!bundleId) {
      res.status(400).json({ error: "Invalid bundle id" });
      return;
    }

    const body = PurchaseBundleBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const walletAddress = body.data.walletAddress.toLowerCase();
    const { txHash } = body.data;

    const [bundle] = await db
      .select()
      .from(traitBundlesTable)
      .where(eq(traitBundlesTable.id, bundleId));

    if (!bundle || !bundle.isActive) {
      res.status(404).json({ error: "Bundle not found" });
      return;
    }

    if (bundle.totalSupply !== -1 && bundle.remainingSupply < 1) {
      res.status(409).json({ error: "Bundle sold out" });
      return;
    }

    const items = await db
      .select({ traitId: bundleItemsTable.traitId, quantity: bundleItemsTable.quantity })
      .from(bundleItemsTable)
      .where(eq(bundleItemsTable.bundleId, bundleId));

    if (items.length === 0) {
      res.status(400).json({ error: "Bundle has no traits" });
      return;
    }

    if (bundle.totalSupply !== -1) {
      await db
        .update(traitBundlesTable)
        .set({ remainingSupply: bundle.remainingSupply - 1 })
        .where(eq(traitBundlesTable.id, bundleId));
    }

    await db.insert(bundlePurchasesTable).values({
      walletAddress,
      bundleId,
      txHash: txHash ?? null,
    });

    const inserted = await db
      .insert(lockerItemsTable)
      .values(
        items.map((item) => ({
          traitId: item.traitId,
          walletAddress,
          quantity: item.quantity,
          txHash: txHash ?? null,
          equippedToTokenId: null,
        })),
      )
      .returning({ id: lockerItemsTable.id });

    res.status(201).json({
      bundleId,
      walletAddress,
      lockerItemIds: inserted.map((i) => i.id),
    });
  },
);

// ── Admin: bundle CRUD ─────────────────────────────────────────────────────────

router.get("/admin/bundles", async (_req, res): Promise<void> => {
  const bundleRows = await db
    .select()
    .from(traitBundlesTable)
    .orderBy(desc(traitBundlesTable.createdAt));

  const bundles = await loadBundlesWithTraits(bundleRows);

  res.json(ListAdminBundlesResponse.parse({ bundles }));
});

router.post("/admin/bundles", async (req, res): Promise<void> => {
  const body = CreateBundleBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  if (body.data.traitIds.length === 0) {
    res.status(400).json({ error: "Bundle must include at least one trait" });
    return;
  }

  let priceWei: string;
  try {
    priceWei = ethers.parseEther(body.data.priceEth).toString();
  } catch {
    priceWei = "0";
  }

  const totalSupply = body.data.totalSupply ?? -1;

  const [bundle] = await db
    .insert(traitBundlesTable)
    .values({
      name: body.data.name,
      description: body.data.description ?? null,
      imageUrl: body.data.imageUrl ?? null,
      priceUsd: body.data.priceUsd,
      priceEth: body.data.priceEth,
      priceWei,
      totalSupply,
      remainingSupply: totalSupply,
      isActive: body.data.isActive ?? true,
    })
    .returning();

  await db.insert(bundleItemsTable).values(
    body.data.traitIds.map((traitId) => ({
      bundleId: bundle.id,
      traitId,
      quantity: 1,
    })),
  );

  const [full] = await loadBundlesWithTraits([bundle]);
  res.status(201).json(full);
});

router.put("/admin/bundles/:bundleId", async (req, res): Promise<void> => {
  const bundleId = parseId(req.params.bundleId);
  if (!bundleId) {
    res.status(400).json({ error: "Invalid bundle id" });
    return;
  }

  const body = CreateBundleBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  if (body.data.traitIds.length === 0) {
    res.status(400).json({ error: "Bundle must include at least one trait" });
    return;
  }

  const [current] = await db
    .select()
    .from(traitBundlesTable)
    .where(eq(traitBundlesTable.id, bundleId));

  if (!current) {
    res.status(404).json({ error: "Bundle not found" });
    return;
  }

  let priceWei: string;
  try {
    priceWei = ethers.parseEther(body.data.priceEth).toString();
  } catch {
    priceWei = "0";
  }

  const totalSupply = body.data.totalSupply ?? -1;
  const supplyDiff = totalSupply - current.totalSupply;
  const remainingSupply =
    totalSupply === -1 ? -1 : Math.max(0, current.remainingSupply + supplyDiff);

  const [bundle] = await db
    .update(traitBundlesTable)
    .set({
      name: body.data.name,
      description: body.data.description ?? null,
      imageUrl: body.data.imageUrl ?? null,
      priceUsd: body.data.priceUsd,
      priceEth: body.data.priceEth,
      priceWei,
      totalSupply,
      remainingSupply,
      isActive: body.data.isActive ?? true,
    })
    .where(eq(traitBundlesTable.id, bundleId))
    .returning();

  await db.delete(bundleItemsTable).where(eq(bundleItemsTable.bundleId, bundleId));
  await db.insert(bundleItemsTable).values(
    body.data.traitIds.map((traitId) => ({
      bundleId,
      traitId,
      quantity: 1,
    })),
  );

  const [full] = await loadBundlesWithTraits([bundle]);
  res.json(full);
});

router.delete("/admin/bundles/:bundleId", async (req, res): Promise<void> => {
  const bundleId = parseId(req.params.bundleId);
  if (!bundleId) {
    res.status(400).json({ error: "Invalid bundle id" });
    return;
  }

  await db.delete(traitBundlesTable).where(eq(traitBundlesTable.id, bundleId));
  res.json({ success: true });
});

export default router;
