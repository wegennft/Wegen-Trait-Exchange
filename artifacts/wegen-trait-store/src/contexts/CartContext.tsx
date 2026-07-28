import { createContext, useContext, useState, type ReactNode } from "react";
import type { Trait, Bundle } from "@workspace/api-client-react";

// ── Discriminated cart item union ──────────────────────────────────────────────

export type CartItem =
  | { kind: "trait"; item: Trait }
  | { kind: "bundle"; item: Bundle };

export function traitKey(id: number): string {
  return `trait-${id}`;
}
export function bundleKey(id: number): string {
  return `bundle-${id}`;
}
function itemKey(ci: CartItem): string {
  return ci.kind === "trait" ? traitKey(ci.item.id) : bundleKey(ci.item.id);
}

// ── Context definition ────────────────────────────────────────────────────────

interface CartContextValue {
  items: Map<string, CartItem>;
  addItem: (ci: CartItem) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;
  hasItem: (key: string) => boolean;
  count: number;
  totalUsd: number;
  totalEth: number;
}

const CartContext = createContext<CartContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Map<string, CartItem>>(new Map());

  const addItem = (ci: CartItem) => {
    const key = itemKey(ci);
    setItems((prev) => {
      if (prev.has(key)) return prev; // idempotent
      const next = new Map(prev);
      next.set(key, ci);
      return next;
    });
  };

  const removeItem = (key: string) => {
    setItems((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  };

  const clearCart = () => setItems(new Map());

  const hasItem = (key: string) => items.has(key);

  const count = items.size;

  const totalUsd = Array.from(items.values()).reduce(
    (sum, ci) => sum + parseFloat(ci.item.priceUsd || "0"),
    0,
  );

  const totalEth = Array.from(items.values()).reduce(
    (sum, ci) => sum + parseFloat(ci.item.priceEth || "0"),
    0,
  );

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, clearCart, hasItem, count, totalUsd, totalEth }}
    >
      {children}
    </CartContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
