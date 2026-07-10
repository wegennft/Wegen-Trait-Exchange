import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Point packs are purchased with ETH, pegged to a fixed USD value set by admins.
// Purchases credit the shared `wallet_points` balance (see bounties.ts schema) —
// there is only one "We Smackz" balance shown across the whole app. The
// `storePointsTable` below is legacy/unused (superseded by wallet_points) and
// kept only so existing rows aren't silently dropped; `storePointPurchasesTable`
// remains the purchase receipt/history log for point-pack buys.

export const pointPacksTable = pgTable("point_packs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  usdValue: text("usd_value").notNull(),
  pointsGranted: integer("points_granted").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const storePointsTable = pgTable("store_points", {
  walletAddress: text("wallet_address").primaryKey(),
  totalPoints: integer("total_points").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const storePointPurchasesTable = pgTable("store_point_purchases", {
  id: serial("id").primaryKey(),
  walletAddress: text("wallet_address").notNull(),
  pointPackId: integer("point_pack_id")
    .notNull()
    .references(() => pointPacksTable.id),
  pointsGranted: integer("points_granted").notNull(),
  usdValue: text("usd_value").notNull(),
  ethAmount: text("eth_amount").notNull(),
  ethPriceAtPurchase: text("eth_price_at_purchase").notNull(),
  txHash: text("tx_hash"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertPointPackSchema = createInsertSchema(pointPacksTable).omit(
  {
    id: true,
    createdAt: true,
    updatedAt: true,
  },
);
export type InsertPointPack = z.infer<typeof insertPointPackSchema>;
export type PointPack = typeof pointPacksTable.$inferSelect;
export type StorePoints = typeof storePointsTable.$inferSelect;
export type StorePointPurchase = typeof storePointPurchasesTable.$inferSelect;
