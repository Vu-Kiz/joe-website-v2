import React, { createContext, useContext, useState } from "react";
import type { MarketListing } from "../../api/market";

export type CartItem = {
  listing: MarketListing;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  add: (listing: MarketListing, qty: number) => void;
  remove: (listingId: number) => void;
  updateQty: (listingId: number, qty: number) => void;
  clear: () => void;
  totalItems: number;
};

const CartContext = createContext<CartContextValue | null>(null);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  function add(listing: MarketListing, qty: number) {
    setItems((prev) => {
      const existing = prev.find((i) => i.listing.id === listing.id);
      if (existing) {
        return prev.map((i) =>
          i.listing.id === listing.id
            ? { ...i, quantity: Math.min(i.listing.quantity_available, i.quantity + qty) }
            : i
        );
      }
      return [...prev, { listing, quantity: qty }];
    });
  }

  function remove(listingId: number) {
    setItems((prev) => prev.filter((i) => i.listing.id !== listingId));
  }

  function updateQty(listingId: number, qty: number) {
    setItems((prev) =>
      prev.map((i) =>
        i.listing.id === listingId
          ? { ...i, quantity: Math.min(i.listing.quantity_available, Math.max(1, qty)) }
          : i
      )
    );
  }

  function clear() {
    setItems([]);
  }

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, add, remove, updateQty, clear, totalItems }}>
      {children}
    </CartContext.Provider>
  );
};

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
