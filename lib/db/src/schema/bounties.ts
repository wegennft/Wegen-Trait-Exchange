import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  pgEnum,
  date,
  index,
} from "drizzle-orm/pg-core";

export const pointTxTypeEnum = pgEnum("point_tx_type", [
  "purchase",
  "confirm_traits",
  "sandbox_bounty",
  "redeem",
  "admin_airdrop",
]);

export const walletPointsTable = pgTable("wallet_points", {
  walletAddress: text("wallet_address").primaryKey(),
  totalPoints: integer("total_points").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const pointTransactionsTable = pgTable(
  "point_transactions",
  {
    id: serial("id").primaryKey(),
    walletAddress: text("wallet_address").notNull(),
    type: pointTxTypeEnum("type").notNull(),
    points: integer("points").notNull(),
    description: text("description"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("pt_wallet_idx").on(t.walletAddress)],
);

export const bountyTraitsTable = pgTable("bounty_traits", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  pointCost: integer("point_cost").notNull().default(100),
  totalSupply: integer("total_supply").notNull().default(-1),
  remainingSupply: integer("remaining_supply").notNull().default(-1),
  isActive: integer("is_active").notNull().default(1),
  sourceTraitId: integer("source_trait_id"),
  sourceTraitIds: text("source_trait_ids"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const bountyPurchasesTable = pgTable(
  "bounty_purchases",
  {
    id: serial("id").primaryKey(),
    walletAddress: text("wallet_address").notNull(),
    bountyTraitId: integer("bounty_trait_id")
      .notNull()
      .references(() => bountyTraitsTable.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("bp_wallet_idx").on(t.walletAddress)],
);

export const dailyBountyCompletionsTable = pgTable(
  "daily_bounty_completions",
  {
    id: serial("id").primaryKey(),
    walletAddress: text("wallet_address").notNull(),
    completedDate: date("completed_date").notNull(),
    nftCollection: text("nft_collection").notNull().default("wegens"),
    count: integer("count").notNull().default(0),
  },
  (t) => [index("dbc_wallet_date_col_idx").on(t.walletAddress, t.completedDate, t.nftCollection)],
);

export const bountyBundlesTable = pgTable("bounty_bundles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  pointCost: integer("point_cost").notNull().default(100),
  totalSupply: integer("total_supply").notNull().default(-1),
  remainingSupply: integer("remaining_supply").notNull().default(-1),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bountyBundleItemsTable = pgTable("bounty_bundle_items", {
  id: serial("id").primaryKey(),
  bundleId: integer("bundle_id")
    .notNull()
    .references(() => bountyBundlesTable.id, { onDelete: "cascade" }),
  bountyTraitId: integer("bounty_trait_id")
    .notNull()
    .references(() => bountyTraitsTable.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(1),
});

export type WalletPoints = typeof walletPointsTable.$inferSelect;
export type BountyTrait = typeof bountyTraitsTable.$inferSelect;
export type BountyPurchase = typeof bountyPurchasesTable.$inferSelect;
export type BountyBundle = typeof bountyBundlesTable.$inferSelect;
export type BountyBundleItem = typeof bountyBundleItemsTable.$inferSelect;
