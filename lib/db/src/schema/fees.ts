import {
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const storeSettingsTable = pgTable("store_settings", {
  id: serial("id").primaryKey(),
  buyingFeePercent: text("buying_fee_percent").notNull().default("0"),
  buyingFeeWallet: text("buying_fee_wallet"),
  sellingFeePercent: text("selling_fee_percent").notNull().default("0"),
  sellingFeeWallet: text("selling_fee_wallet"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type StoreSettings = typeof storeSettingsTable.$inferSelect;
