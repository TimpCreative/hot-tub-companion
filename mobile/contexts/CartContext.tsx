import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import * as cartApi from '../services/cart';
import type { Cart } from '../services/cart';

function extractErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && e !== null && 'error' in e) {
    const err = (e as { error?: { message?: string } }).error;
    if (typeof err?.message === 'string') return err.message;
  }
  return 'Something went wrong';
}

export type CartCheckoutDeps = {
  presentCheckout: (url: string) => void;
  /** Register for checkout completed; return unsubscribe. */
  subscribeCheckoutCompleted: (handler: () => void) => () => void;
};

type CartContextValue = {
  cart: Cart | null;
  loading: boolean;
  error: string | null;
  refreshCart: () => Promise<void>;
  addToCart: (productId: string, quantity?: number) => Promise<void>;
  setLineQuantity: (lineId: string, quantity: number) => Promise<void>;
  removeLine: (lineId: string) => Promise<void>;
  openCheckout: () => Promise<void>;
  totalQuantity: number;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

type CartProviderCoreProps = {
  children: React.ReactNode;
  checkout: CartCheckoutDeps;
};

/**
 * Cart state + API. Checkout presentation is injected (native sheet vs Linking).
 */
export function CartProviderCore({ children, checkout }: CartProviderCoreProps) {
  const { user, loading: authLoading } = useAuth();
  const { presentCheckout, subscribeCheckoutCompleted } = checkout;
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshCart = useCallback(async () => {
    if (!user || authLoading) {
      setCart(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const c = await cartApi.fetchCart();
      setCart(c);
    } catch (e: unknown) {
      setError(extractErrorMessage(e));
      setCart(null);
    } finally {
      setLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    void refreshCart();
  }, [refreshCart]);

  useEffect(() => {
    return subscribeCheckoutCompleted(() => {
      void refreshCart();
    });
  }, [subscribeCheckoutCompleted, refreshCart]);

  const addToCart = useCallback(async (productId: string, quantity = 1) => {
    setError(null);
    const next = await cartApi.addCartItem(productId, quantity);
    setCart(next);
  }, []);

  const setLineQuantity = useCallback(async (lineId: string, quantity: number) => {
    setError(null);
    const next = await cartApi.updateCartLine(lineId, quantity);
    setCart(next);
  }, []);

  const removeLine = useCallback(async (lineId: string) => {
    setError(null);
    const next = await cartApi.removeCartLine(lineId);
    setCart(next);
  }, []);

  const openCheckout = useCallback(async () => {
    setError(null);
    const url = await cartApi.fetchCheckoutUrl();
    presentCheckout(url);
  }, [presentCheckout]);

  const value = useMemo(
    (): CartContextValue => ({
      cart,
      loading,
      error,
      refreshCart,
      addToCart,
      setLineQuantity,
      removeLine,
      openCheckout,
      totalQuantity: cart?.totalQuantity ?? 0,
    }),
    [cart, loading, error, refreshCart, addToCart, setLineQuantity, removeLine, openCheckout]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within CartProvider');
  }
  return ctx;
}
