import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

export const storeSettingsTable = pgTable("store_settings", {
  id: serial("id").primaryKey(),
  buyingFeePercent: text("buying_fee_percent").notNull().default("0"),
  buyingFeeWallet: text("buying_fee_wallet"),
  sellingFeePercent: text("selling_fee_percent").notNull().default("0"),
  sellingFeeWallet: text("selling_fee_wallet"),
  marketplaceListingFeePercent: text("marketplace_listing_fee_percent").notNull().default("0"),
  marketplaceListingFeeWallet: text("marketplace_listing_fee_wallet"),
  layerOrder: text("layer_order").default('["Background","Body","Clothes","Mouth","Eyes","Headgear"]'),
  storeName: text("store_name").default("Wegen Trait Store"),
  storeTagline: text("store_tagline").default("Customize your Wegen NFT with unique traits"),
  storeOpen: boolean("store_open").default(true),
  announcementBanner: text("announcement_banner"),
  maxTraitsPerOrder: integer("max_traits_per_order").default(10),
  contractAddress: text("contract_address"),
  collectionWallet: text("collection_wallet"),
  networkName: text("network_name").default("mainnet"),
  twitterUrl: text("twitter_url"),
  discordUrl: text("discord_url"),
  websiteUrl: text("website_url"),
  contactEmail: text("contact_email"),
  maintenanceMode: boolean("maintenance_mode").default(false),
  maintenanceWhitelist: text("maintenance_whitelist").default("[]"),
  ineligibleNfts: text("ineligible_nfts").default("[]"),
  updateAuthorityKeyCiphertext: text("update_authority_key_ciphertext"),
  dailyGameEnabled: boolean("daily_game_enabled").default(true),
  dailyGameOverrides: text("daily_game_overrides").default("{}"),
  celebrationGifUrl: text("celebration_gif_url"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type StoreSettings = typeof storeSettingsTable.$inferSelect;
