import { Router, type IRouter } from "express";
import { eq, and, ne, inArray } from "drizzle-orm";
import {
  db,
  swapListingsTable,
  swapListingItemsTable,
  lockerItemsTable,
  traitsTable,
  transactionsTable,
} from "@workspace/db";

const router: IRouter = Router();

// ── Helpers ─────────────────────────────────────────────────────────────────

async function getListingWithItems(listingId: number) {
  const [listing] = await db
    .select()
    .from(swapListingsTable)
    .where(eq(swapListingsTable.id, listingId));

  if (!listing) return null;

  const items = await db
    .select()
    .from(swapListingItemsTable)
    .where(eq(swapListingItemsTable.listingId, listingId));

  return { ...listing, offeredItems: items };
}

// ── GET /swap/listings ───────────────────────────────────────────────────────

router.get("/swap/listings", async (req, res): Promise<void> => {
  const wallet = req.query["wallet"] as string | undefined;
  const status = (req.query["status"] as string) ?? "open";

  const conditions = [];
  if (status !== "all") conditions.push(eq(swapListingsTable.status, status));
  if (wallet) conditions.push(eq(swapListingsTable.posterWallet, wallet));

  const listings = await db
    .select()
    .from(swapListingsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(swapListingsTable.createdAt);

  const withItems = await Promise.all(
    listings.map(async (l) => {
      const items = await db
        .select()
        .from(swapListingItemsTable)
        .where(eq(swapListingItemsTable.listingId, l.id));
      return { ...l, offeredItems: items };
    }),
  );

  res.json({ listings: withItems, total: withItems.length });
});

// ── POST /swap/listings ──────────────────────────────────────────────────────

router.post("/swap/listings", async (req, res): Promise<void> => {
  const { posterWallet, lookingFor, lockerItemIds } = req.body as {
    posterWallet: string;
    lookingFor: string;
    lockerItemIds: number[];
  };

  if (!posterWallet || !lookingFor || !Array.isArray(lockerItemIds) || lockerItemIds.length === 0) {
    res.status(400).json({ error: "posterWallet, lookingFor, and at least one lockerItemId are required" });
    return;
  }

  const lockerItems = await db
    .select({ li: lockerItemsTable, t: traitsTable })
    .from(lockerItemsTable)
    .innerJoin(traitsTable, eq(lockerItemsTable.traitId, traitsTable.id))
    .where(
      and(
        inArray(lockerItemsTable.id, lockerItemIds),
        eq(lockerItemsTable.walletAddress, posterWallet),
      ),
    );

  if (lockerItems.length !== lockerItemIds.length) {
    res.status(400).json({ error: "Some locker items not found or not owned by this wallet" });
    return;
  }

  const anyEquipped = lockerItems.some(r => r.li.equippedToTokenId !== null);
  if (anyEquipped) {
    res.status(400).json({ error: "Cannot list an equipped trait — unequip it from your NFT first" });
    return;
  }

  const [listing] = await db
    .insert(swapListingsTable)
    .values({ posterWallet, lookingFor, status: "open" })
    .returning();

  await db.insert(swapListingItemsTable).values(
    lockerItems.map(r => ({
      listingId: listing.id,
      lockerItemId: r.li.id,
      traitId: r.t.id,
      traitName: r.t.name,
      traitCategory: r.t.category,
      traitImageUrl: r.t.imageUrl ?? null,
    })),
  );

  const result = await getListingWithItems(listing.id);
  res.status(201).json(result);
});

// ── DELETE /swap/listings/:id ────────────────────────────────────────────────

router.delete("/swap/listings/:id", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const { walletAddress } = req.body as { walletAddress: string };

  const [listing] = await db
    .select()
    .from(swapListingsTable)
    .where(eq(swapListingsTable.id, id));

  if (!listing) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  if (listing.posterWallet.toLowerCase() !== walletAddress?.toLowerCase()) {
    res.status(403).json({ error: "Only the poster can cancel this listing" });
    return;
  }
  if (listing.status !== "open") {
    res.status(400).json({ error: "Listing is not open" });
    return;
  }

  await db
    .update(swapListingsTable)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(swapListingsTable.id, id));

  res.json({ success: true });
});

// ── POST /swap/listings/:id/accept ───────────────────────────────────────────

router.post("/swap/listings/:id/accept", async (req, res): Promise<void> => {
  const listingId = Number(req.params["id"]);
  const { walletAddress, lockerItemIds } = req.body as {
    walletAddress: string;
    lockerItemIds: number[];
  };

  if (!walletAddress || !Array.isArray(lockerItemIds) || lockerItemIds.length === 0) {
    res.status(400).json({ error: "walletAddress and lockerItemIds are required" });
    return;
  }

  const [listing] = await db
    .select()
    .from(swapListingsTable)
    .where(eq(swapListingsTable.id, listingId));

  if (!listing) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  if (listing.status !== "open") {
    res.status(400).json({ error: "This swap is no longer available" });
    return;
  }
  if (listing.posterWallet.toLowerCase() === walletAddress.toLowerCase()) {
    res.status(400).json({ error: "You cannot accept your own swap listing" });
    return;
  }

  const listedItems = await db
    .select()
    .from(swapListingItemsTable)
    .where(eq(swapListingItemsTable.listingId, listingId));

  const posterLockerItemIds = listedItems.map(i => i.lockerItemId);

  const acceptorItems = await db
    .select({ li: lockerItemsTable, t: traitsTable })
    .from(lockerItemsTable)
    .innerJoin(traitsTable, eq(lockerItemsTable.traitId, traitsTable.id))
    .where(
      and(
        inArray(lockerItemsTable.id, lockerItemIds),
        eq(lockerItemsTable.walletAddress, walletAddress),
      ),
    );

  if (acceptorItems.length !== lockerItemIds.length) {
    res.status(400).json({ error: "Some of your locker items were not found" });
    return;
  }

  // Transfer: poster's items → acceptor's wallet
  if (posterLockerItemIds.length > 0) {
    await db
      .update(lockerItemsTable)
      .set({ walletAddress, equippedToTokenId: null })
      .where(inArray(lockerItemsTable.id, posterLockerItemIds));
  }

  // Transfer: acceptor's items → poster's wallet
  if (lockerItemIds.length > 0) {
    await db
      .update(lockerItemsTable)
      .set({ walletAddress: listing.posterWallet, equippedToTokenId: null })
      .where(inArray(lockerItemsTable.id, lockerItemIds));
  }

  // Mark listing accepted
  await db
    .update(swapListingsTable)
    .set({ status: "accepted", acceptedByWallet: walletAddress, updatedAt: new Date() })
    .where(eq(swapListingsTable.id, listingId));

  // Record transactions for both sides
  const posterTraits = await db
    .select()
    .from(traitsTable)
    .where(inArray(traitsTable.id, listedItems.map(i => i.traitId)));

  for (const t of posterTraits) {
    await db.insert(transactionsTable).values({
      type: "trade",
      traitId: t.id,
      traitName: t.name,
      traitCategory: t.category,
      traitImageUrl: t.imageUrl ?? null,
      walletAddress,
      ethAmount: t.priceEth,
      txHash: null,
      tokenId: null,
    });
  }

  for (const r of acceptorItems) {
    await db.insert(transactionsTable).values({
      type: "trade",
      traitId: r.t.id,
      traitName: r.t.name,
      traitCategory: r.t.category,
      traitImageUrl: r.t.imageUrl ?? null,
      walletAddress: listing.posterWallet,
      ethAmount: r.t.priceEth,
      txHash: null,
      tokenId: null,
    });
  }

  res.json({ success: true });
});

export default router;
