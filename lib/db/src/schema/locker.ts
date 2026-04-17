import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { traitsTable } from "./traits";

export const lockerItemsTable = pgTable("locker_items", {
  id: serial("id").primaryKey(),
  traitId: integer("trait_id")
    .notNull()
    .references(() => traitsTable.id),
  walletAddress: text("wallet_address").notNull(),
  quantity: integer("quantity").notNull().default(1),
  equippedToTokenId: integer("equipped_to_token_id"),
  txHash: text("tx_hash"),
  purchasedAt: timestamp("purchased_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertLockerItemSchema = createInsertSchema(lockerItemsTable).omit(
  {
    id: true,
    purchasedAt: true,
  },
);
export type InsertLockerItem = z.infer<typeof insertLockerItemSchema>;
export type LockerItem = typeof lockerItemsTable.$inferSelect;
