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
import { traitsTable } from "./traits";

export const traitBundlesTable = pgTable("trait_bundles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  priceUsd: text("price_usd").notNull().default("0"),
  priceEth: text("price_eth").notNull(),
  priceWei: text("price_wei").notNull(),
  totalSupply: integer("total_supply").notNull().default(-1),
  remainingSupply: integer("remaining_supply").notNull().default(-1),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const bundleItemsTable = pgTable("bundle_items", {
  id: serial("id").primaryKey(),
  bundleId: integer("bundle_id")
    .notNull()
    .references(() => traitBundlesTable.id, { onDelete: "cascade" }),
  traitId: integer("trait_id")
    .notNull()
    .references(() => traitsTable.id),
  quantity: integer("quantity").notNull().default(1),
});

export const bundlePurchasesTable = pgTable("bundle_purchases", {
  id: serial("id").primaryKey(),
  walletAddress: text("wallet_address").notNull(),
  bundleId: integer("bundle_id")
    .notNull()
    .references(() => traitBundlesTable.id),
  txHash: text("tx_hash"),
  purchasedAt: timestamp("purchased_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertTraitBundleSchema = createInsertSchema(
  traitBundlesTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTraitBundle = z.infer<typeof insertTraitBundleSchema>;
export type TraitBundle = typeof traitBundlesTable.$inferSelect;
export type BundleItem = typeof bundleItemsTable.$inferSelect;
export type BundlePurchase = typeof bundlePurchasesTable.$inferSelect;
