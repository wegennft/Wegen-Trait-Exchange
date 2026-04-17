import {
  pgTable,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const wegenNftsTable = pgTable("wegen_nfts", {
  tokenId: integer("token_id").primaryKey(),
  walletAddress: text("wallet_address").notNull(),
  name: text("name").notNull(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertWegenNftSchema = createInsertSchema(wegenNftsTable).omit({
  createdAt: true,
});
export type InsertWegenNft = z.infer<typeof insertWegenNftSchema>;
export type WegenNft = typeof wegenNftsTable.$inferSelect;
