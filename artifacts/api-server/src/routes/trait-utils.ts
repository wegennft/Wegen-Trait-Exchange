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
