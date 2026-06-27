import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, wegenNftsTable, lockerItemsTable, traitsTable, transactionsTable } from "@workspace/db";
import {
  GetUserNftsParams,
  GetUserNftsResponse,
  ApplyTraitParams,
  ApplyTraitBody,
  ApplyTraitResponse,
  RemoveTraitParams,
  RemoveTraitBody,
  RemoveTraitResponse,
  ConfirmTraitsParams,
  ConfirmTraitsBody,
  ConfirmTraitsResponse,
} from "@workspace/api-zod";
import { requireWalletOwnership } from "../middleware/requireAuth";

const router: IRouter = Router();

async function getNftWithTraits(tokenId: number) {
  const [nft] = await db
    .select()
    .from(wegenNftsTable)
    .where(eq(wegenNftsTable.tokenId, tokenId));

  if (!nft) return null;

  const equipped = await db
    .select({
      lockerItemId: lockerItemsTable.id,
      category: traitsTable.category,
      trait: {
        id: traitsTable.id,
        name: traitsTable.name,
        category: traitsTable.category,
        description: traitsTable.description,
        imageUrl: traitsTable.imageUrl,
        priceEth: traitsTable.priceEth,
        priceWei: traitsTable.priceWei,
        totalSupply: traitsTable.totalSupply,
        remainingSupply: traitsTable.remainingSupply,
        isActive: traitsTable.isActive,
        rarity: traitsTable.rarity,
        createdAt: traitsTable.createdAt,
      },
    })
    .from(lockerItemsTable)
    .innerJoin(traitsTable, eq(lockerItemsTable.traitId, traitsTable.id))
    .where(eq(lockerItemsTable.equippedToTokenId, tokenId));

  return { ...nft, equippedTraits: equipped };
}

router.get("/nfts/:walletAddress", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.walletAddress)
    ? req.params.walletAddress[0]
    : req.params.walletAddress;
  const params = GetUserNftsParams.safeParse({ walletAddress: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const nfts = await db
    .select()
    .from(wegenNftsTable)
    .where(eq(wegenNftsTable.walletAddress, params.data.walletAddress));

  const nftsWithTraits = await Promise.all(
    nfts.map((nft) => getNftWithTraits(nft.tokenId)),
  );

  const filtered = nftsWithTraits.filter(Boolean) as NonNullable<
    Awaited<ReturnType<typeof getNftWithTraits>>
  >[];

  res.json(GetUserNftsResponse.parse({ nfts: filtered, total: filtered.length }));
});

router.post("/nfts/:tokenId/apply-trait", requireWalletOwnership(), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.tokenId)
    ? req.params.tokenId[0]
    : req.params.tokenId;
  const pathParams = ApplyTraitParams.safeParse({ tokenId: rawId });
  if (!pathParams.success) {
    res.status(400).json({ error: pathParams.error.message });
    return;
  }

  const body = ApplyTraitBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { lockerItemId, walletAddress } = body.data;
  const tokenId = pathParams.data.tokenId;

  const [lockerItem] = await db
    .select()
    .from(lockerItemsTable)
    .where(
      and(
        eq(lockerItemsTable.id, lockerItemId),
        eq(lockerItemsTable.walletAddress, walletAddress),
      ),
    );

  if (!lockerItem) {
    res.status(400).json({ error: "Locker item not found or not owned by this wallet" });
    return;
  }

  if (lockerItem.equippedToTokenId !== null) {
    res.status(400).json({ error: "Trait is already equipped to an NFT" });
    return;
  }

  const [trait] = await db
    .select()
    .from(traitsTable)
    .where(eq(traitsTable.id, lockerItem.traitId));

  if (!trait) {
    res.status(400).json({ error: "Trait not found" });
    return;
  }

  // Check for an existing trait in the same category on this NFT
  const existingEquipped = await db
    .select({
      lockerItemId: lockerItemsTable.id,
    })
    .from(lockerItemsTable)
    .innerJoin(traitsTable, eq(lockerItemsTable.traitId, traitsTable.id))
    .where(
      and(
        eq(lockerItemsTable.equippedToTokenId, tokenId),
        eq(traitsTable.category, trait.category),
      ),
    );

  // If a trait of the same category is already equipped, auto-return it to the locker
  if (existingEquipped.length > 0) {
    await db
      .update(lockerItemsTable)
      .set({ equippedToTokenId: null })
      .where(eq(lockerItemsTable.id, existingEquipped[0].lockerItemId));
  }

  const [updatedItem] = await db
    .update(lockerItemsTable)
    .set({ equippedToTokenId: tokenId })
    .where(eq(lockerItemsTable.id, lockerItemId))
    .returning();

  await db.insert(transactionsTable).values({
    type: "trade",
    traitId: trait.id,
    traitName: trait.name,
    traitCategory: trait.category,
    traitImageUrl: trait.imageUrl ?? null,
    walletAddress,
    ethAmount: trait.priceEth,
    txHash: null,
    tokenId,
  });

  const nft = await getNftWithTraits(tokenId);
  if (!nft) {
    res.status(404).json({ error: "NFT not found" });
    return;
  }

  const itemWithTrait = { ...updatedItem, trait };

  res.json(ApplyTraitResponse.parse({ success: true, nft, lockerItem: itemWithTrait }));
});

router.post("/nfts/:tokenId/remove-trait", requireWalletOwnership(), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.tokenId)
    ? req.params.tokenId[0]
    : req.params.tokenId;
  const pathParams = RemoveTraitParams.safeParse({ tokenId: rawId });
  if (!pathParams.success) {
    res.status(400).json({ error: pathParams.error.message });
    return;
  }

  const body = RemoveTraitBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { category, walletAddress } = body.data;
  const tokenId = pathParams.data.tokenId;

  const equippedRows = await db
    .select({
      lockerItem: lockerItemsTable,
      trait: traitsTable,
    })
    .from(lockerItemsTable)
    .innerJoin(traitsTable, eq(lockerItemsTable.traitId, traitsTable.id))
    .where(
      and(
        eq(lockerItemsTable.equippedToTokenId, tokenId),
        eq(lockerItemsTable.walletAddress, walletAddress),
        eq(traitsTable.category, category),
      ),
    );

  if (equippedRows.length === 0) {
    res.status(400).json({ error: "No equipped trait found for that category" });
    return;
  }

  const { lockerItem, trait } = equippedRows[0];

  const [updatedItem] = await db
    .update(lockerItemsTable)
    .set({ equippedToTokenId: null })
    .where(eq(lockerItemsTable.id, lockerItem.id))
    .returning();

  const nft = await getNftWithTraits(tokenId);
  if (!nft) {
    res.status(404).json({ error: "NFT not found" });
    return;
  }

  const itemWithTrait = { ...updatedItem, trait };

  res.json(RemoveTraitResponse.parse({ success: true, nft, lockerItem: itemWithTrait }));
});

router.post("/nfts/:tokenId/confirm-traits", requireWalletOwnership(), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.tokenId)
    ? req.params.tokenId[0]
    : req.params.tokenId;
  const pathParams = ConfirmTraitsParams.safeParse({ tokenId: rawId });
  if (!pathParams.success) {
    res.status(400).json({ error: pathParams.error.message });
    return;
  }

  const body = ConfirmTraitsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { walletAddress } = body.data;
  const tokenId = pathParams.data.tokenId;

  const [nft] = await db
    .select()
    .from(wegenNftsTable)
    .where(eq(wegenNftsTable.tokenId, tokenId));

  if (!nft) {
    res.status(404).json({ error: "NFT not found" });
    return;
  }

  if (nft.walletAddress !== walletAddress) {
    res.status(403).json({ error: "Wallet does not own this NFT" });
    return;
  }

  const equippedRows = await db
    .select({
      category: traitsTable.category,
      name: traitsTable.name,
    })
    .from(lockerItemsTable)
    .innerJoin(traitsTable, eq(lockerItemsTable.traitId, traitsTable.id))
    .where(eq(lockerItemsTable.equippedToTokenId, tokenId));

  if (equippedRows.length === 0) {
    res.status(400).json({ error: "No traits equipped to this NFT" });
    return;
  }

  // Generate a simulated on-chain tx hash (replace with real contract call when ready)
  const txHash =
    "0x" +
    Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join("");

  // Optional variant pack from body (not in Zod schema — read directly)
  const variantPack =
    typeof req.body.variantPack === "string" && req.body.variantPack.length > 0
      ? req.body.variantPack
      : null;

  // Record the metadata confirmation on the NFT row
  await db
    .update(wegenNftsTable)
    .set({
      metadataTxHash: txHash,
      metadataUpdatedAt: new Date(),
      ...(variantPack !== undefined ? { variantPack } : {}),
    })
    .where(eq(wegenNftsTable.tokenId, tokenId));

  res.json(
    ConfirmTraitsResponse.parse({
      success: true,
      txHash,
      tokenId,
      traitsApplied: equippedRows,
    }),
  );
});

export default router;
