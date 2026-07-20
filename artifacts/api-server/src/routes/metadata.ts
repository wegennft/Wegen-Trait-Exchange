import { Router } from "express";
import {
  db,
  wegenNftsTable,
  lockerItemsTable,
  traitsTable,
  traitVariantsTable,
  storeSettingsTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import sharp from "sharp";

const router = Router();

const DEFAULT_LAYER_ORDER = [
  "Background",
  "Body",
  "Clothes",
  "Mouth",
  "Eyes",
  "Headgear",
];

async function getLayerOrder(collection: string): Promise<string[]> {
  const settings = await db.query.storeSettingsTable.findFirst({
    where: eq(storeSettingsTable.nftCollection, collection),
  });
  if (settings?.layerOrder) {
    try {
      return JSON.parse(settings.layerOrder) as string[];
    } catch {
      /* fall through */
    }
  }
  return DEFAULT_LAYER_ORDER;
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// GET /api/metadata/:collection/:tokenId  →  ERC-721 JSON
router.get(
  "/metadata/:collection/:tokenId",
  async (req, res): Promise<void> => {
    const { collection, tokenId: tokenIdStr } = req.params;
    const tokenId = parseInt(tokenIdStr, 10);
    if (isNaN(tokenId)) {
      res.status(400).json({ error: "Invalid token ID" });
      return;
    }

    const nft = await db.query.wegenNftsTable.findFirst({
      where: eq(wegenNftsTable.tokenId, tokenId),
    });
    if (!nft) {
      res.status(404).json({ error: "NFT not found" });
      return;
    }

    const equippedRows = await db
      .select({ category: traitsTable.category, name: traitsTable.name })
      .from(lockerItemsTable)
      .innerJoin(traitsTable, eq(lockerItemsTable.traitId, traitsTable.id))
      .where(eq(lockerItemsTable.equippedToTokenId, tokenId));

    const attributes: { trait_type: string; value: string }[] =
      equippedRows.map((r) => ({ trait_type: r.category, value: r.name }));

    if (nft.variantPack) {
      attributes.push({ trait_type: "Skin", value: nft.variantPack });
    }

    const proto = req.headers["x-forwarded-proto"] ?? req.protocol;
    const host = req.headers["x-forwarded-host"] ?? req.get("host");
    const baseUrl = `${proto}://${host}`;

    const collectionLabel =
      collection === "wegenettes" ? "Wegenette" : "Wegen";
    const metadata = {
      name: nft.name,
      description: `A ${collectionLabel} NFT with a custom trait loadout.`,
      image: `${baseUrl}/api/metadata/${collection}/${tokenId}/image`,
      external_url: `${baseUrl}/nfts`,
      attributes,
    };

    res.setHeader("Content-Type", "application/json");
    res.json(metadata);
  },
);

// GET /api/metadata/:collection/:tokenId/image  →  composited PNG
router.get(
  "/metadata/:collection/:tokenId/image",
  async (req, res): Promise<void> => {
    const { collection, tokenId: tokenIdStr } = req.params;
    const tokenId = parseInt(tokenIdStr, 10);

    if (isNaN(tokenId)) {
      res.status(400).send("Invalid token ID");
      return;
    }

    try {
      const [nft, equippedRows] = await Promise.all([
        db.query.wegenNftsTable.findFirst({
          where: eq(wegenNftsTable.tokenId, tokenId),
        }),
        db
          .select({
            traitId: traitsTable.id,
            category: traitsTable.category,
            imageUrl: traitsTable.imageUrl,
          })
          .from(lockerItemsTable)
          .innerJoin(traitsTable, eq(lockerItemsTable.traitId, traitsTable.id))
          .where(eq(lockerItemsTable.equippedToTokenId, tokenId)),
      ]);

      const layerOrder = await getLayerOrder(collection);
      // ?variant= allows preview mode (e.g. from My Wegens page) before SOC
      const variantPack =
        (typeof req.query.variant === "string" && req.query.variant)
          ? req.query.variant
          : (nft?.variantPack ?? null);

      // Build variant image map if a variant pack is selected
      const variantImageMap = new Map<number, string>();
      if (variantPack && equippedRows.length > 0) {
        const traitIds = equippedRows.map((r) => r.traitId);
        const variants = await db
          .select({ traitId: traitVariantsTable.traitId, imageUrl: traitVariantsTable.imageUrl })
          .from(traitVariantsTable)
          .where(
            and(
              eq(traitVariantsTable.name, variantPack),
              inArray(traitVariantsTable.traitId, traitIds),
            ),
          );
        for (const v of variants) {
          if (v.imageUrl) variantImageMap.set(v.traitId, v.imageUrl);
        }
      }

      // Sort equipped items back→front for compositing.
      // layerOrder[0] = frontmost (topmost) layer, last entry = backmost.
      // Sort DESCENDING so the backmost layer (highest index) comes first as base.
      const sorted = [...equippedRows].sort((a, b) => {
        const ai = layerOrder.indexOf(a.category);
        const bi = layerOrder.indexOf(b.category);
        return (bi === -1 ? 1000 : bi) - (ai === -1 ? 1000 : ai);
      });

      // Resolve each layer's image URL (use variant if available)
      const proto = req.headers["x-forwarded-proto"] ?? req.protocol;
      const host = req.headers["x-forwarded-host"] ?? req.get("host");
      const baseUrl = `${proto}://${host}`;

      const layerUrls: string[] = [];
      for (const item of sorted) {
        const rawUrl =
          (variantImageMap.get(item.traitId) ?? item.imageUrl) || null;
        if (!rawUrl) continue;
        layerUrls.push(
          rawUrl.startsWith("http") ? rawUrl : `${baseUrl}${rawUrl}`,
        );
      }

      // Placeholder when no layers resolved
      const makePlaceholder = async () => {
        return sharp({
          create: {
            width: 1000,
            height: 1000,
            channels: 4,
            background: { r: 26, g: 5, b: 51, alpha: 1 },
          },
        })
          .png()
          .toBuffer();
      };

      if (layerUrls.length === 0) {
        const buf = await makePlaceholder();
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Cache-Control", "public, max-age=60");
        res.send(buf);
        return;
      }

      // Fetch all images in parallel
      const buffers = await Promise.all(layerUrls.map(fetchImageBuffer));
      const validBuffers = buffers.filter((b): b is Buffer => b !== null);

      if (validBuffers.length === 0) {
        const buf = await makePlaceholder();
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Cache-Control", "public, max-age=60");
        res.send(buf);
        return;
      }

      // Resize each layer to 1000x1000 then composite
      const resized = await Promise.all(
        validBuffers.map((b) =>
          sharp(b)
            .resize(1000, 1000, {
              fit: "cover",
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .ensureAlpha()
            .png()
            .toBuffer(),
        ),
      );

      const [base, ...rest] = resized;
      const composited = await sharp(base)
        .composite(rest.map((buf) => ({ input: buf, blend: "over" as const })))
        .png()
        .toBuffer();

      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=60");
      res.send(composited);
    } catch (err) {
      req.log?.error({ err }, "Failed to composite metadata image");
      res.status(500).send("Failed to generate image");
    }
  },
);

export default router;
