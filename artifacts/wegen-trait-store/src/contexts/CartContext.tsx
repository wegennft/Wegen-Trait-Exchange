import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
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

// ── localStorage persistence helpers ─────────────────────────────────────────

const STORAGE_KEY = "wegen-cart-v1";

type SerializedCart = Array<[string, CartItem]>;

function isValidCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.kind !== "trait" && v.kind !== "bundle") return false;
  if (!v.item || typeof v.item !== "object") return false;
  const item = v.item as Record<string, unknown>;
  return typeof item.id === "number";
}

function loadFromStorage(): Map<string, CartItem> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Map();
    const entries = (parsed as SerializedCart).filter(
      ([key, ci]) => typeof key === "string" && isValidCartItem(ci),
    );
    return new Map(entries);
  } catch {
    return new Map();
  }
}

function saveToStorage(items: Map<string, CartItem>): void {
  try {
    const serialized: SerializedCart = Array.from(items.entries());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch {
    // Storage quota exceeded or private browsing — silently ignore
  }
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
  // Cart sheet open/close — shared so any page can open checkout
  cartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Map<string, CartItem>>(() => loadFromStorage());
  const [cartOpen, setCartOpen] = useState(false);

  // Persist to localStorage whenever the cart changes
  useEffect(() => {
    saveToStorage(items);
  }, [items]);

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

  const openCart = () => setCartOpen(true);
  const closeCart = () => setCartOpen(false);

  return (
    <CartContext.Provider
      value={{
        items, addItem, removeItem, clearCart, hasItem,
        count, totalUsd, totalEth,
        cartOpen, openCart, closeCart,
      }}
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
