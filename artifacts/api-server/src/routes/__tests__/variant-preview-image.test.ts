/**
 * Unit tests for the trait attribute parsing logic used by
 * /traits/variant-preview-image (and /traits/compose-preview).
 *
 * These tests run purely against the exported utility functions and
 * require no database, network, or HTTP server.
 */

import { describe, it, expect } from "vitest";
import {
  CATEGORY_ALIASES,
  NON_VISUAL_CATEGORIES,
  parseAttrs,
  sortByLayerOrder,
  DEFAULT_LAYER_ORDER,
} from "../trait-utils.js";

// ── CATEGORY_ALIASES ──────────────────────────────────────────────────────────

describe("CATEGORY_ALIASES", () => {
  it("maps Skin → Body", () => {
    expect(CATEGORY_ALIASES["Skin"]).toBe("Body");
  });

  it("maps Head & Hair → Headgear", () => {
    expect(CATEGORY_ALIASES["Head & Hair"]).toBe("Headgear");
  });

  it("maps HeadGear → Headgear (capitalisation variant)", () => {
    expect(CATEGORY_ALIASES["HeadGear"]).toBe("Headgear");
  });
});

// ── NON_VISUAL_CATEGORIES ─────────────────────────────────────────────────────

describe("NON_VISUAL_CATEGORIES", () => {
  const nonVisual = [
    "golden ticket",
    "team",
    "collab edition",
    "origin",
    "seasoned wegen",
    "legend",
    "ultra rare",
    "migration #",
    "original name",
    "original mint",
    "original id",
  ];

  for (const cat of nonVisual) {
    it(`contains "${cat}"`, () => {
      expect(NON_VISUAL_CATEGORIES.has(cat)).toBe(true);
    });
  }

  it("does NOT contain visual categories like Body", () => {
    expect(NON_VISUAL_CATEGORIES.has("body")).toBe(false);
  });
});

// ── parseAttrs ────────────────────────────────────────────────────────────────

describe("parseAttrs", () => {
  // ── Basic happy path ──────────────────────────────────────────────────────

  it("parses a single visual pair", () => {
    const result = parseAttrs("Background:Don't Be Hating");
    expect(result).toEqual([{ category: "Background", name: "Don't Be Hating" }]);
  });

  it("parses multiple visual pairs separated by pipes", () => {
    const result = parseAttrs("Background:Blaze|Body:Brown|Headgear:Snapback");
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ category: "Background", name: "Blaze" });
    expect(result[1]).toEqual({ category: "Body", name: "Brown" });
    expect(result[2]).toEqual({ category: "Headgear", name: "Snapback" });
  });

  // ── CATEGORY_ALIASES path ─────────────────────────────────────────────────

  it("maps Skin → Body via CATEGORY_ALIASES", () => {
    const result = parseAttrs("Skin:Ice");
    expect(result).toEqual([{ category: "Body", name: "Ice" }]);
  });

  it("maps Head & Hair → Headgear via CATEGORY_ALIASES", () => {
    const result = parseAttrs("Head & Hair:Beanie");
    expect(result).toEqual([{ category: "Headgear", name: "Beanie" }]);
  });

  it("maps HeadGear → Headgear via CATEGORY_ALIASES (capitalisation variant)", () => {
    const result = parseAttrs("HeadGear:Baseball Cap");
    expect(result).toEqual([{ category: "Headgear", name: "Baseball Cap" }]);
  });

  // ── Non-visual wegenette special traits ───────────────────────────────────

  it("discards Golden Ticket (wegenette special on-chain trait)", () => {
    const result = parseAttrs("Background:Blaze|Golden Ticket:Yes");
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("Background");
  });

  it("discards Team (wegenette special on-chain trait)", () => {
    const result = parseAttrs("Body:Ice|Team:Alpha");
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("Body");
  });

  it("discards Collab Edition (wegenette special on-chain trait)", () => {
    const result = parseAttrs("Body:Ice|Collab Edition:Genesis");
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("Body");
  });

  it("discards all non-visual wegenette traits when mixed with visual ones", () => {
    const raw =
      "Background:Blaze|Golden Ticket:Yes|Team:Beta|Collab Edition:OG|Body:Brown|Headgear:Snapback";
    const result = parseAttrs(raw);
    const categories = result.map((p) => p.category);
    expect(categories).not.toContain("Golden Ticket");
    expect(categories).not.toContain("Team");
    expect(categories).not.toContain("Collab Edition");
    expect(categories).toContain("Background");
    expect(categories).toContain("Body");
    expect(categories).toContain("Headgear");
  });

  it("discards non-visual types case-insensitively (e.g. GOLDEN TICKET)", () => {
    const result = parseAttrs("GOLDEN TICKET:Yes|Body:Ice");
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("Body");
  });

  // ── Other non-visual wegen traits ─────────────────────────────────────────

  it("discards origin, seasoned wegen, legend, ultra rare wegen metadata traits", () => {
    const raw = "origin:OG|seasoned wegen:true|legend:true|ultra rare:1|Body:Brown";
    const result = parseAttrs(raw);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("Body");
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  it("returns empty array for empty string", () => {
    expect(parseAttrs("")).toEqual([]);
  });

  it("discards segments without a colon", () => {
    const result = parseAttrs("BackgroundBlaze|Body:Brown");
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("Body");
  });

  it("splits only on the FIRST colon (trait names may contain colons)", () => {
    const result = parseAttrs("Background:Blue:Gradient");
    expect(result).toEqual([{ category: "Background", name: "Blue:Gradient" }]);
  });

  it("discards pairs where name exceeds 120 characters", () => {
    const longName = "a".repeat(121);
    const result = parseAttrs(`Body:${longName}`);
    expect(result).toHaveLength(0);
  });

  it("accepts names exactly 120 characters long", () => {
    const name120 = "a".repeat(120);
    const result = parseAttrs(`Body:${name120}`);
    expect(result).toHaveLength(1);
  });

  it("discards pairs with an empty category", () => {
    const result = parseAttrs(":SomeName|Body:Brown");
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("Body");
  });

  it("discards pairs with an empty name", () => {
    const result = parseAttrs("Body:|Background:Blaze");
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("Background");
  });

  it("trims whitespace from category and name", () => {
    const result = parseAttrs(" Body : Brown ");
    expect(result).toEqual([{ category: "Body", name: "Brown" }]);
  });
});

// ── sortByLayerOrder ──────────────────────────────────────────────────────────

describe("sortByLayerOrder", () => {
  // Helper: sort plain strings using identity getter
  const sortStrings = (cats: string[], order: string[]) =>
    sortByLayerOrder(cats, (c) => c, order);

  // ── Known category order ──────────────────────────────────────────────────

  it("sorts back→front: Background first, Headgear last with default order", () => {
    const input = ["Headgear", "Eyes", "Background", "Body"];
    const result = sortStrings(input, DEFAULT_LAYER_ORDER);
    // back→front compositing order: Background (idx 5) → Body (4) → Eyes (1) → Headgear (0)
    expect(result).toEqual(["Background", "Body", "Eyes", "Headgear"]);
  });

  it("sorts all six default categories in correct back→front order", () => {
    const shuffled = ["Mouth", "Headgear", "Background", "Clothes", "Body", "Eyes"];
    const result = sortStrings(shuffled, DEFAULT_LAYER_ORDER);
    expect(result).toEqual(["Background", "Body", "Clothes", "Mouth", "Eyes", "Headgear"]);
  });

  it("works with a custom layer order", () => {
    const customOrder = ["Overlay", "Body", "Base"];
    const result = sortStrings(["Base", "Overlay", "Body"], customOrder);
    // Base (idx 2) → Body (1) → Overlay (0)
    expect(result).toEqual(["Base", "Body", "Overlay"]);
  });

  // ── Unknown categories sort last (highest sentinel = furthest back) ───────

  it("places unknown categories before all known layers (sentinel = 1000)", () => {
    // Unknown categories get index 1000 — sort as most-back, appear first in output
    const result = sortStrings(["Headgear", "Mystery"], DEFAULT_LAYER_ORDER);
    // Mystery (1000) appears before Headgear (0) in back→front order
    expect(result[0]).toBe("Mystery");
    expect(result[1]).toBe("Headgear");
  });

  it("places multiple unknown categories before known ones", () => {
    const result = sortStrings(["Eyes", "Unknown1", "Body", "Unknown2"], DEFAULT_LAYER_ORDER);
    const knownIdx = result.findIndex((c) => c === "Body" || c === "Eyes");
    const lastUnknownIdx = Math.max(result.indexOf("Unknown1"), result.indexOf("Unknown2"));
    // All unknowns appear before the known layers
    expect(lastUnknownIdx).toBeLessThan(knownIdx);
  });

  // ── Tie-breaking ──────────────────────────────────────────────────────────

  it("preserves relative order of items that share the same category name", () => {
    // Two items with the same category → stable relative order (JS sort is stable)
    const items = [
      { cat: "Body", val: "first" },
      { cat: "Body", val: "second" },
    ];
    const result = sortByLayerOrder(items, (i) => i.cat, DEFAULT_LAYER_ORDER);
    expect(result[0].val).toBe("first");
    expect(result[1].val).toBe("second");
  });

  it("does not change order when all categories have different indices", () => {
    // Already in back→front order
    const input = ["Background", "Body", "Headgear"];
    const result = sortStrings(input, DEFAULT_LAYER_ORDER);
    expect(result).toEqual(["Background", "Body", "Headgear"]);
  });

  // ── Empty order falls back to DEFAULT_LAYER_ORDER ─────────────────────────

  it("falls back to DEFAULT_LAYER_ORDER when an empty layerOrder is passed", () => {
    const input = ["Headgear", "Background", "Body"];
    const withEmpty = sortStrings(input, []);
    const withDefault = sortStrings(input, DEFAULT_LAYER_ORDER);
    expect(withEmpty).toEqual(withDefault);
  });

  it("DEFAULT_LAYER_ORDER has Headgear first (frontmost) and Background last (backmost)", () => {
    expect(DEFAULT_LAYER_ORDER[0]).toBe("Headgear");
    expect(DEFAULT_LAYER_ORDER[DEFAULT_LAYER_ORDER.length - 1]).toBe("Background");
  });

  // ── Works with object items ───────────────────────────────────────────────

  it("sorts trait objects by category using a getter function", () => {
    const traits = [
      { id: 1, category: "Headgear" },
      { id: 2, category: "Background" },
      { id: 3, category: "Body" },
    ];
    const result = sortByLayerOrder(traits, (t) => t.category, DEFAULT_LAYER_ORDER);
    expect(result.map((t) => t.category)).toEqual(["Background", "Body", "Headgear"]);
  });

  // ── Does not mutate the input array ──────────────────────────────────────

  it("does not mutate the original items array", () => {
    const input = ["Headgear", "Background"];
    const inputCopy = [...input];
    sortStrings(input, DEFAULT_LAYER_ORDER);
    expect(input).toEqual(inputCopy);
  });

  // ── Empty input ───────────────────────────────────────────────────────────

  it("returns empty array for empty input", () => {
    expect(sortStrings([], DEFAULT_LAYER_ORDER)).toEqual([]);
  });
});
