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

export const legendsTable = pgTable("legends", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nftCollection: text("nft_collection").notNull().default("wegens"),
  tokenId: integer("token_id"),
  imageUrl: text("image_url"),
  mediaType: text("media_type").notNull().default("image"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const legendVariantsTable = pgTable("legend_variants", {
  id: serial("id").primaryKey(),
  legendId: integer("legend_id").notNull().references(() => legendsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  imageUrl: text("image_url"),
  mediaType: text("media_type").notNull().default("image"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLegendSchema = createInsertSchema(legendsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLegend = z.infer<typeof insertLegendSchema>;
export type Legend = typeof legendsTable.$inferSelect;
export type LegendVariant = typeof legendVariantsTable.$inferSelect;
