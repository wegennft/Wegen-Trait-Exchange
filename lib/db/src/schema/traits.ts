import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  boolean,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const traitsTable = pgTable("traits", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  mediaType: text("media_type").default("image"),
  priceEth: text("price_eth").notNull(),
  priceWei: text("price_wei").notNull(),
  totalSupply: integer("total_supply").notNull(),
  remainingSupply: integer("remaining_supply").notNull(),
  theme: text("theme"),
  dropName: text("drop_name"),
  isActive: boolean("is_active").notNull().default(true),
  rarity: text("rarity").notNull().default("common"),
  nftCollection: text("nft_collection").notNull().default("wegens"),
  payoutSplits: jsonb("payout_splits").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const rarityTiersTable = pgTable("rarity_tiers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nftCollection: text("nft_collection").notNull().default("wegens"),
  rank: integer("rank").notNull().default(0),
  color: text("color").default("#888888"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  unique("rarity_tiers_name_collection_unique").on(table.name, table.nftCollection),
]);

export const insertTraitSchema = createInsertSchema(traitsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTrait = z.infer<typeof insertTraitSchema>;
export type Trait = typeof traitsTable.$inferSelect;
export type RarityTier = typeof rarityTiersTable.$inferSelect;
