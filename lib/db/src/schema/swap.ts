import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { lockerItemsTable } from "./locker";
import { traitsTable } from "./traits";

export const swapListingsTable = pgTable("swap_listings", {
  id: serial("id").primaryKey(),
  posterWallet: text("poster_wallet").notNull(),
  lookingFor: text("looking_for").notNull(),
  status: text("status").notNull().default("open"),
  acceptedByWallet: text("accepted_by_wallet"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const swapListingItemsTable = pgTable("swap_listing_items", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id")
    .notNull()
    .references(() => swapListingsTable.id, { onDelete: "cascade" }),
  lockerItemId: integer("locker_item_id")
    .notNull()
    .references(() => lockerItemsTable.id),
  traitId: integer("trait_id")
    .notNull()
    .references(() => traitsTable.id),
  traitName: text("trait_name").notNull(),
  traitCategory: text("trait_category").notNull(),
  traitImageUrl: text("trait_image_url"),
});

export type SwapListing = typeof swapListingsTable.$inferSelect;
export type SwapListingItem = typeof swapListingItemsTable.$inferSelect;
