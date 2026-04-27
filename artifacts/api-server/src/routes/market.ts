import { Router, type IRouter } from "express";
import { eq, and, ne, inArray, desc } from "drizzle-orm";
import {
  db,
  marketListingsTable,
  lockerItemsTable,
  traitsTable,
  transactionsTable,
} from "@workspace/db";

const router: IRouter = Router();

function getNftCollection(req: import("express").Request): string {
  const c = (req.query.nftCollection ?? req.body?.nftCollection) as string | undefined;
  if (c === "wegenettes") return "wegenettes";
  return "wegens";
}

// ── GET /market/listings ──────────────────────────────────────────────────────

router.get("/market/listings", async (req, res): Promise<void> => {
  const nftCollection = getNftCollection(req);
  const status = (req.query["status"] as string) ?? "active";
  const seller = req.query["seller"] as string | undefined;

  const conditions: ReturnType<typeof eq>[] = [eq(marketListingsTable.nftCollection, nftCollection)];
  if (status !== "all") conditions.push(eq(marketListingsTable.status, status));
  if (seller) conditions.push(eq(marketListingsTable.sellerWallet, seller.toLowerCase()));

  const listings = await db
    .select()
    .from(marketListingsTable)
    .where(and(...conditions))
    .orderBy(desc(marketListingsTable.createdAt));

  res.json({ listings, total: listings.length });
});

// ── POST /market/listings ─────────────────────────────────────────────────────

router.post("/market/listings", async (req, res): Promise<void> => {
  const nftCollection = getNftCollection(req);
  const { sellerWallet, lockerItemId, priceEth } = req.body as {
    sellerWallet: string;
    lockerItemId: number;
    priceEth: string;
  };

  if (!sellerWallet || !lockerItemId || !priceEth) {
    res.status(400).json({ error: "sellerWallet, lockerItemId, and priceEth are required" });
    return;
  }

  if (isNaN(parseFloat(priceEth)) || parseFloat(priceEth) <= 0) {
    res.status(400).json({ error: "priceEth must be a positive number" });
    return;
  }

  const [lockerRow] = await db
    .select({ li: lockerItemsTable, t: traitsTable })
    .from(lockerItemsTable)
    .innerJoin(traitsTable, eq(lockerItemsTable.traitId, traitsTable.id))
    .where(
      and(
        eq(lockerItemsTable.id, lockerItemId),
        eq(lockerItemsTable.walletAddress, sellerWallet.toLowerCase()),
        eq(traitsTable.nftCollection, nftCollection),
      ),
    );

  if (!lockerRow) {
    res.status(404).json({ error: "Locker item not found or not owned by you" });
    return;
  }

  if (lockerRow.li.equippedToTokenId !== null) {
    res.status(400).json({ error: "Unequip the trait from your NFT before listing it" });
    return;
  }

  const [existing] = await db
    .select({ id: marketListingsTable.id })
    .from(marketListingsTable)
    .where(
      and(
        eq(marketListingsTable.lockerItemId, lockerItemId),
        eq(marketListingsTable.status, "active"),
      ),
    );

  if (existing) {
    res.status(409).json({ error: "This trait is already listed on the market" });
    return;
  }

  const [listing] = await db
    .insert(marketListingsTable)
    .values({
      sellerWallet: sellerWallet.toLowerCase(),
      lockerItemId: lockerRow.li.id,
      traitId: lockerRow.t.id,
      traitName: lockerRow.t.name,
      traitCategory: lockerRow.t.category,
      traitImageUrl: lockerRow.t.imageUrl ?? null,
      priceEth,
      status: "active",
      nftCollection,
    })
    .returning();

  res.status(201).json(listing);
});

// ── DELETE /market/listings/:id ───────────────────────────────────────────────

router.delete("/market/listings/:id", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const { walletAddress } = req.body as { walletAddress: string };

  const [listing] = await db
    .select()
    .from(marketListingsTable)
    .where(eq(marketListingsTable.id, id));

  if (!listing) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  if (listing.sellerWallet !== walletAddress?.toLowerCase()) {
    res.status(403).json({ error: "Only the seller can cancel this listing" });
    return;
  }
  if (listing.status !== "active") {
    res.status(400).json({ error: "Listing is not active" });
    return;
  }

  await db
    .update(marketListingsTable)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(marketListingsTable.id, id));

  res.json({ success: true });
});

// ── POST /market/listings/:id/buy ─────────────────────────────────────────────

router.post("/market/listings/:id/buy", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const { buyerWallet } = req.body as { buyerWallet: string };

  if (!buyerWallet) {
    res.status(400).json({ error: "buyerWallet is required" });
    return;
  }

  const [listing] = await db
    .select()
    .from(marketListingsTable)
    .where(eq(marketListingsTable.id, id));

  if (!listing) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  if (listing.status !== "active") {
    res.status(400).json({ error: "This listing is no longer available" });
    return;
  }
  if (listing.sellerWallet === buyerWallet.toLowerCase()) {
    res.status(400).json({ error: "You cannot buy your own listing" });
    return;
  }

  await db
    .update(lockerItemsTable)
    .set({ walletAddress: buyerWallet.toLowerCase(), equippedToTokenId: null })
    .where(eq(lockerItemsTable.id, listing.lockerItemId));

  await db
    .update(marketListingsTable)
    .set({ status: "sold", buyerWallet: buyerWallet.toLowerCase(), updatedAt: new Date() })
    .where(eq(marketListingsTable.id, id));

  await db.insert(transactionsTable).values({
    type: "sale",
    traitId: listing.traitId,
    traitName: listing.traitName,
    traitCategory: listing.traitCategory,
    traitImageUrl: listing.traitImageUrl ?? null,
    walletAddress: buyerWallet.toLowerCase(),
    ethAmount: listing.priceEth,
    txHash: null,
    tokenId: null,
    nftCollection: listing.nftCollection,
  });

  await db.insert(transactionsTable).values({
    type: "sale",
    traitId: listing.traitId,
    traitName: listing.traitName,
    traitCategory: listing.traitCategory,
    traitImageUrl: listing.traitImageUrl ?? null,
    walletAddress: listing.sellerWallet,
    ethAmount: listing.priceEth,
    txHash: null,
    tokenId: null,
    nftCollection: listing.nftCollection,
  });

  res.json({ success: true, priceEth: listing.priceEth });
});

export default router;
