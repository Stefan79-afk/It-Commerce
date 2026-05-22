import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { CartItem } from '../types/orders';

const STORAGE_KEY = 'itcommerce_cart';

function loadFromStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage(items: CartItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export interface CartContextValue {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [items, setItems] = useState<CartItem[]>(loadFromStorage);

  const updateItems = useCallback((updater: (prev: CartItem[]) => CartItem[]) => {
    setItems((prev) => {
      const next = updater(prev);
      saveToStorage(next);
      return next;
    });
  }, []);

  const addItem = useCallback(
    (item: Omit<CartItem, 'quantity'>) => {
      updateItems((prev) => {
        const existing = prev.find((i) => i.productId === item.productId);
        if (existing) {
          return prev.map((i) =>
            i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i,
          );
        }
        return [...prev, { ...item, quantity: 1 }];
      });
    },
    [updateItems],
  );

  const removeItem = useCallback(
    (productId: string) => {
      updateItems((prev) => prev.filter((i) => i.productId !== productId));
    },
    [updateItems],
  );

  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (quantity <= 0) {
        updateItems((prev) => prev.filter((i) => i.productId !== productId));
      } else {
        updateItems((prev) =>
          prev.map((i) => (i.productId === productId ? { ...i, quantity } : i)),
        );
      }
    },
    [updateItems],
  );

  const clearCart = useCallback(() => {
    updateItems(() => []);
  }, [updateItems]);

  const totalItems = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
  const totalPrice = useMemo(
    () => items.reduce((sum, i) => sum + i.priceAtPurchase * i.quantity, 0),
    [items],
  );

  const value = useMemo<CartContextValue>(
    () => ({ items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice }),
    [items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
