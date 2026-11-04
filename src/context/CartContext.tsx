'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { Product, CartItem } from '@/types';
import { calculatePromoPreview, PromoPreview } from '@/lib/formatters';

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, quantity?: number) => { success: boolean; message?: string };
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
  cartSubtotal: number;
  promoPreview: PromoPreview;
  hasOverStockItems: boolean;
  overStockItems: CartItem[];
  isInitialized: boolean;
}

const CART_STORAGE_KEY = 'voltedge_cart_v1';

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Hydrate from localStorage once mounted
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }
    } catch {
      // Ignore localStorage parse error
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Persist to localStorage on change (only after initialized)
  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore storage write error
    }
  }, [items, isInitialized]);

  const addItem = (product: Product, quantityToAdd: number = 1): { success: boolean; message?: string } => {
    if (product.stock_quantity <= 0) {
      return {
        success: false,
        message: `${product.name} is currently out of stock and cannot be added.`,
      };
    }

    let warningMessage: string | undefined;

    setItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.product.id === product.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        const newQty = updated[existingIndex].quantity + quantityToAdd;
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty,
        };

        if (newQty > product.stock_quantity) {
          warningMessage = `Notice: Order quantity (${newQty}) exceeds current stock (${product.stock_quantity}). Order will be subject to availability review.`;
        }

        return updated;
      } else {
        if (quantityToAdd > product.stock_quantity) {
          warningMessage = `Notice: Order quantity (${quantityToAdd}) exceeds current stock (${product.stock_quantity}). Order will be subject to availability review.`;
        }
        return [...prev, { product, quantity: quantityToAdd }];
      }
    });

    return { success: true, message: warningMessage };
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const cartSubtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [items]
  );

  const promoPreview = useMemo(
    () => calculatePromoPreview(cartSubtotal),
    [cartSubtotal]
  );

  const overStockItems = useMemo(
    () => items.filter((item) => item.quantity > item.product.stock_quantity),
    [items]
  );

  const hasOverStockItems = overStockItems.length > 0;

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        itemCount,
        cartSubtotal,
        promoPreview,
        hasOverStockItems,
        overStockItems,
        isInitialized,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
