import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  boolean,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rarityEnum = pgEnum("rarity", [
  "common",
  "uncommon",
  "rare",
  "legendary",
]);

export const traitsTable = pgTable("traits", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  priceEth: text("price_eth").notNull(),
  priceWei: text("price_wei").notNull(),
  totalSupply: integer("total_supply").notNull(),
  remainingSupply: integer("remaining_supply").notNull(),
  theme: text("theme"),
  isActive: boolean("is_active").notNull().default(true),
  rarity: rarityEnum("rarity").notNull().default("common"),
  payoutSplits: jsonb("payout_splits").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertTraitSchema = createInsertSchema(traitsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTrait = z.infer<typeof insertTraitSchema>;
export type Trait = typeof traitsTable.$inferSelect;
