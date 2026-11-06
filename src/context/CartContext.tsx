'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import { Product, CartItem } from '@/types';
import { calculatePromoPreview, PromoPreview } from '@/lib/formatters';
import { useAuth } from '@/context/AuthContext';

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
  cartSyncError: string | null;
}

const CART_STORAGE_KEY = 'voltedge_cart_v1';

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, accessToken, loading: authLoading } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [cartOwnerUserId, setCartOwnerUserId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [cartSyncError, setCartSyncError] = useState<string | null>(null);
  const syncedUserId = useRef<string | null>(null);
  const lastAccountUserId = useRef<string | null>(null);
  const itemsRef = useRef<CartItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Browser storage is only available after hydration, so this state sync belongs here.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setItems(
          Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed?.items)
              ? parsed.items
              : []
        );
        setCartOwnerUserId(
          Array.isArray(parsed) || typeof parsed?.userId !== 'string'
            ? null
            : parsed.userId
        );
      }
    } catch {
      // Start with an empty cart when browser storage is unavailable or invalid.
    } finally {
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    if (!isInitialized || !user) {
      syncedUserId.current = null;
      return;
    }

    if (syncedUserId.current === user.id) return;

    const switchingAccounts =
      (lastAccountUserId.current !== null && lastAccountUserId.current !== user.id) ||
      (cartOwnerUserId !== null && cartOwnerUserId !== user.id);

    let active = true;
    void (async () => {
      const token = await accessToken();
      if (!token) throw new Error('Your sign-in session has expired. Sign in again to sync your cart.');

      const response = await fetch('/api/customer/cart', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to load your saved cart.');
      }

      if (!active) return;
      if (Array.isArray(data.items) && data.items.length > 0) {
        setItems(data.items as CartItem[]);
      } else {
        const localItems = switchingAccounts ? [] : itemsRef.current;
        const saveResponse = await fetch('/api/customer/cart', {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            items: localItems.map(({ product, quantity }) => ({
              product_id: product.id,
              quantity,
            })),
          }),
        });
        const saveData = await saveResponse.json();
        if (!saveResponse.ok || !saveData.success) {
          throw new Error(saveData.message || 'Unable to save your cart.');
        }
        if (switchingAccounts) setItems([]);
      }
      setCartOwnerUserId(user.id);
      lastAccountUserId.current = user.id;
      syncedUserId.current = user.id;
      setCartSyncError(null);
    })().catch((error: unknown) => {
      if (active) {
        if (switchingAccounts) {
          itemsRef.current = [];
          setItems([]);
          lastAccountUserId.current = user.id;
        }
        setCartSyncError(error instanceof Error ? error.message : 'Unable to sync your cart.');
      }
    });

    return () => {
      active = false;
    };
  }, [accessToken, cartOwnerUserId, isInitialized, user]);

  // Persist to localStorage on change (only after initialized)
  useEffect(() => {
    if (!isInitialized) return;

    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ userId: cartOwnerUserId, items }));
    } catch {
      // Ignore storage write error
    }
  }, [cartOwnerUserId, isInitialized, items]);

  useEffect(() => {
    if (authLoading || user || cartOwnerUserId === null) return;
    // The account cart is persisted server-side; do not expose it after sign-out.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems([]);
    setCartOwnerUserId(null);
  }, [authLoading, cartOwnerUserId, user]);

  useEffect(() => {
    if (!isInitialized || !user || syncedUserId.current !== user.id) return;
    let active = true;
    const timeout = window.setTimeout(() => {
      void (async () => {
        const token = await accessToken();
        if (!token) return;
        const response = await fetch('/api/customer/cart', {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            items: items.map(({ product, quantity }) => ({
              product_id: product.id,
              quantity,
            })),
          }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Unable to save your cart.');
        }
        if (active) setCartSyncError(null);
      })().catch((error: unknown) => {
        if (active) {
          setCartSyncError(error instanceof Error ? error.message : 'Unable to save your cart.');
        }
      });
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [accessToken, isInitialized, items, user]);

  const addItem = (product: Product, quantityToAdd: number = 1): { success: boolean; message?: string } => {
    if (product.stock_quantity <= 0) {
      return {
        success: false,
        message: `${product.name} is currently out of stock and cannot be added.`,
      };
    }

    const existing = items.find((item) => item.product.id === product.id);
    if (quantityToAdd <= 0 || (existing?.quantity || 0) + quantityToAdd > product.stock_quantity) {
      return {
        success: false,
        message: `Only ${Math.max(0, product.stock_quantity - (existing?.quantity || 0))} more unit(s) of ${product.name} can be added based on current stock.`,
      };
    }

    setItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.product.id === product.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        const newQty = updated[existingIndex].quantity + quantityToAdd;
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty,
        };

        return updated;
      } else {
        return [...prev, { product, quantity: quantityToAdd }];
      }
    });

    return { success: true };
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

  const visibleItems = useMemo(() => {
    if (cartOwnerUserId !== null && (!user || cartOwnerUserId !== user.id)) return [];
    return items;
  }, [cartOwnerUserId, items, user]);

  const itemCount = useMemo(
    () => visibleItems.reduce((sum, item) => sum + item.quantity, 0),
    [visibleItems]
  );

  const cartSubtotal = useMemo(
    () => visibleItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [visibleItems]
  );

  const promoPreview = useMemo(
    () => calculatePromoPreview(cartSubtotal),
    [cartSubtotal]
  );

  const overStockItems = useMemo(
    () => visibleItems.filter((item) => item.quantity > item.product.stock_quantity),
    [visibleItems]
  );

  const hasOverStockItems = overStockItems.length > 0;

  return (
    <CartContext.Provider
      value={{
        items: visibleItems,
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
        cartSyncError,
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
