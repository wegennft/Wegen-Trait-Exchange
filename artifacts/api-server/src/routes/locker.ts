import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, lockerItemsTable, traitsTable, transactionsTable, storeSettingsTable } from "@workspace/db";
import { awardPoints } from "./bounties";
import {
  GetLockerParams,
  GetLockerResponse,
  PurchaseTraitParams,
  PurchaseTraitBody,
} from "@workspace/api-zod";
import { requireWalletOwnership } from "../middleware/requireAuth";
import { convertUsdToEth, EthPriceUnavailableError } from "../lib/ethPriceService";
import { verifyPaymentTx, networkNameToChainId } from "../utils/rpcClient.js";

const router: IRouter = Router();

function getNftCollection(req: import("express").Request): string {
  const c = (req.query.nftCollection ?? req.body?.nftCollection) as string | undefined;
  if (c === "wegenettes") return "wegenettes";
  return "wegens";
}

router.get("/locker/:walletAddress", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.walletAddress)
    ? req.params.walletAddress[0]
    : req.params.walletAddress;
  const params = GetLockerParams.safeParse({ walletAddress: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const nftCollection = getNftCollection(req);

  const items = await db
    .select({
      id: lockerItemsTable.id,
      traitId: lockerItemsTable.traitId,
      walletAddress: lockerItemsTable.walletAddress,
      quantity: lockerItemsTable.quantity,
      equippedToTokenId: lockerItemsTable.equippedToTokenId,
      txHash: lockerItemsTable.txHash,
      purchasedAt: lockerItemsTable.purchasedAt,
      trait: {
        id: traitsTable.id,
        name: traitsTable.name,
        category: traitsTable.category,
        theme: traitsTable.theme,
        description: traitsTable.description,
        imageUrl: traitsTable.imageUrl,
        mediaType: traitsTable.mediaType,
        priceUsd: traitsTable.priceUsd,
        priceEth: traitsTable.priceEth,
        priceWei: traitsTable.priceWei,
        totalSupply: traitsTable.totalSupply,
        remainingSupply: traitsTable.remainingSupply,
        isActive: traitsTable.isActive,
        rarity: traitsTable.rarity,
        nftCollection: traitsTable.nftCollection,
        payoutSplits: traitsTable.payoutSplits,
        createdAt: traitsTable.createdAt,
      },
    })
    .from(lockerItemsTable)
    .innerJoin(traitsTable, eq(lockerItemsTable.traitId, traitsTable.id))
    .where(
      and(
        eq(lockerItemsTable.walletAddress, params.data.walletAddress),
        eq(traitsTable.nftCollection, nftCollection),
      )
    )
    .orderBy(lockerItemsTable.purchasedAt);

  res.json(
    GetLockerResponse.parse({
      walletAddress: params.data.walletAddress,
      items,
      totalItems: items.length,
    }),
  );
});

router.post(
  "/locker/:walletAddress/purchase",
  requireWalletOwnership(),
  async (req, res): Promise<void> => {
    const rawWallet = Array.isArray(req.params.walletAddress)
      ? req.params.walletAddress[0]
      : req.params.walletAddress;
    const pathParams = PurchaseTraitParams.safeParse({
      walletAddress: rawWallet,
    });
    if (!pathParams.success) {
      res.status(400).json({ error: pathParams.error.message });
      return;
    }

    const body = PurchaseTraitBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const { traitId, txHash, quantity } = body.data;
    const walletAddress = pathParams.data.walletAddress;

    const [trait] = await db
      .select()
      .from(traitsTable)
      .where(eq(traitsTable.id, traitId));

    if (!trait) {
      res.status(400).json({ error: "Trait not found" });
      return;
    }

    if (!trait.isActive) {
      res.status(400).json({ error: "Trait is not active" });
      return;
    }

    const qty = quantity ?? 1;

    if (trait.remainingSupply < qty) {
      res.status(400).json({ error: "Insufficient supply" });
      return;
    }

    let ethAmount: string;
    let ethPriceAtPurchase: string;
    try {
      ({ ethAmount, ethPriceAtPurchase } = await convertUsdToEth(
        Number(trait.priceUsd) * qty,
      ));
    } catch (err) {
      if (err instanceof EthPriceUnavailableError) {
        res.status(503).json({ error: err.message });
        return;
      }
      throw err;
    }

    // ── On-chain payment verification ────────────────────────────────────────
    // If the client sent a real tx hash, verify it on-chain before crediting.
    // Skipped silently when RPC_URL / ALCHEMY_API_KEY is not configured (dev).
    if (txHash && txHash !== "null" && !txHash.startsWith("0xsimulated")) {
      const [settings] = await db
        .select({ collectionWallet: storeSettingsTable.collectionWallet, networkName: storeSettingsTable.networkName })
        .from(storeSettingsTable)
        .where(eq(storeSettingsTable.nftCollection, getNftCollection(req)))
        .limit(1);
      const paymentWallet = process.env.PAYMENT_WALLET_ADDRESS || settings?.collectionWallet;
      if (paymentWallet) {
        const chainId = networkNameToChainId(settings?.networkName ?? "mainnet");
        const { valid, reason } = await verifyPaymentTx(txHash, paymentWallet, chainId);
        if (!valid) {
          res.status(402).json({ error: reason ?? "Payment could not be verified on-chain." });
          return;
        }
      }
    }

    await db
      .update(traitsTable)
      .set({ remainingSupply: trait.remainingSupply - qty })
      .where(eq(traitsTable.id, traitId));

    const [lockerItem] = await db
      .insert(lockerItemsTable)
      .values({
        traitId,
        walletAddress,
        quantity: qty,
        txHash: txHash ?? null,
        equippedToTokenId: null,
      })
      .returning();

    await db.insert(transactionsTable).values({
      type: "buy",
      traitId: trait.id,
      traitName: trait.name,
      traitCategory: trait.category,
      traitImageUrl: trait.imageUrl ?? null,
      walletAddress,
      ethAmount,
      ethPriceAtPurchase,
      txHash: txHash ?? null,
      tokenId: null,
      nftCollection: trait.nftCollection,
    });

    // Award 150 points per unit purchased
    await awardPoints(walletAddress, 150 * qty, "purchase", `Purchased: ${trait.name} ×${qty}`).catch(() => {});

    const itemWithTrait = {
      ...lockerItem,
      trait: {
        ...trait,
        remainingSupply: trait.remainingSupply - qty,
      },
    };

    res.status(201).json(itemWithTrait);
  },
);

export default router;
