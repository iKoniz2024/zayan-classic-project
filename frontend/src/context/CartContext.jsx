"use client";

import { useState, useCallback } from "react";
import { CartContext } from "./cartContextValue";
import { getLocalCartCount } from "@/utils/localCart";

export function CartProvider({ children }) {
  const [cartCount, setCartCount] = useState(() => getLocalCartCount());

  const refetchCartCount = useCallback((count) => {
    setCartCount(count);
  }, []);

  return (
    <CartContext.Provider value={{ cartCount, refetchCartCount }}>
      {children}
    </CartContext.Provider>
  );
}
