/**
 * Shared utilities for trait attribute parsing used by
 * variant-preview-image and compose-preview route handlers.
 *
 * Extracted so they can be imported by unit tests without pulling in
 * the full Express router or DB dependencies.
 */

// Normalize on-chain trait_type names to DB category names.
// Any alias added here is automatically applied to both handlers.
export const CATEGORY_ALIASES: Record<string, string> = {
  "Skin": "Body",
  "Head & Hair": "Headgear",
  "HeadGear": "Headgear",
};

// Non-visual trait_type names that should never be composited as layers.
// Includes wegenette-specific metadata attributes (Golden Ticket, Team,
// Collab Edition) that appear as on-chain trait_types but have no
// corresponding visual layer.
export const NON_VISUAL_CATEGORIES = new Set([
  "origin", "seasoned wegen", "legend", "ultra rare",
  "migration #", "original name", "original mint", "original id",
  "golden ticket", "team", "collab edition",
]);

export interface ParsedAttr {
  category: string;
  name: string;
}

/**
 * Default back→front layer order used when no custom order is stored in
 * storeSettings. layerOrder[0] is FRONT (topmost), last entry is BACK.
 * Exported so callers and tests share the single source of truth.
 */
export const DEFAULT_LAYER_ORDER = [
  "Headgear",
  "Eyes",
  "Mouth",
  "Clothes",
  "Body",
  "Background",
];

/**
 * Sort trait items back→front for compositing.
 *
 * layerOrder[0] is the FRONT (topmost) layer; the last entry is BACK
 * (bottommost). Items are sorted so the highest index (furthest back)
 * appears first in the returned array — i.e. the base layer is element 0
 * and the topmost layer is the last element.
 *
 * Unknown categories (not present in layerOrder) are treated as if they
 * have the highest possible index (1000) so they are composited at the
 * very bottom, below all known layers.
 *
 * Falls back to DEFAULT_LAYER_ORDER when layerOrder is empty.
 *
 * @param items      Array of items to sort (not mutated).
 * @param getCategory  Extracts the category string from an item.
 * @param layerOrder   Ordered array of category names (front → back).
 */
export function sortByLayerOrder<T>(
  items: T[],
  getCategory: (item: T) => string,
  layerOrder: string[],
): T[] {
  const order = layerOrder.length > 0 ? layerOrder : DEFAULT_LAYER_ORDER;
  return [...items].sort((a, b) => {
    const ai = order.indexOf(getCategory(a));
    const bi = order.indexOf(getCategory(b));
    return (bi === -1 ? 1000 : bi) - (ai === -1 ? 1000 : ai);
  });
}

/**
 * Parse a pipe-delimited "Category:Value|..." string into structured pairs,
 * applying CATEGORY_ALIASES and discarding NON_VISUAL_CATEGORIES entries.
 *
 * Rules:
 * - Split only on the FIRST colon per segment (trait names may contain colons).
 * - Discard pairs where category or name is empty.
 * - Discard pairs where name is longer than 120 characters.
 * - Discard pairs whose category (after alias resolution) is a known
 *   non-visual type (case-insensitive).
 */
export function parseAttrs(attrsRaw: string): ParsedAttr[] {
  return attrsRaw
    .split("|")
    .map((s) => {
      const idx = s.indexOf(":");
      if (idx === -1) return null;
      const rawCat = s.slice(0, idx).trim();
      const name = s.slice(idx + 1).trim();
      const category = CATEGORY_ALIASES[rawCat] ?? rawCat;
      return { category, name };
    })
    .filter((p): p is ParsedAttr =>
      p !== null &&
      p.category !== "" &&
      p.name !== "" &&
      p.name.length <= 120 &&
      !NON_VISUAL_CATEGORIES.has(p.category.toLowerCase()),
    );
}
