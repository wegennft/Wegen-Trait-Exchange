import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { traitsTable } from "./traits";

export const txTypeEnum = pgEnum("tx_type", ["buy", "sell", "trade"]);

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  type: txTypeEnum("type").notNull(),
  traitId: integer("trait_id")
    .notNull()
    .references(() => traitsTable.id),
  traitName: text("trait_name").notNull(),
  traitCategory: text("trait_category").notNull(),
  traitImageUrl: text("trait_image_url"),
  walletAddress: text("wallet_address").notNull(),
  ethAmount: text("eth_amount").notNull(),
  txHash: text("tx_hash"),
  tokenId: integer("token_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Transaction = typeof transactionsTable.$inferSelect;
