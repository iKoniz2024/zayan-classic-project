"use client";

import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import useCart from "./useCart";
import { addToLocalCart, getLocalCartCount } from "../utils/localCart";

export function useAddToCart() {
  const { refetchCartCount } = useCart();
  const queryClient = useQueryClient();

  const addToCart = async (product, quantity = 1, size = "", color = "", colorImage = "") => {
    try {
      addToLocalCart({
        productId: product._id,
        title: product.title,
        thumbnail: colorImage || product.thumbnail || product.images?.[0] || null,
        colorImage: colorImage || null,
        price: product.discountPercentage > 0
          ? (product.price * (1 - product.discountPercentage / 100)).toFixed(2)
          : product.price,
        stock: product.stock ?? 0,
        category: typeof product.category === "string"
          ? product.category
          : product.category?.name || product.category?.slug || "",
        quantity,
        size,
        color,
      });
      toast.success("Added to cart");
      refetchCartCount(getLocalCartCount());
      queryClient.invalidateQueries({ queryKey: ["localCart"] });
      window.dispatchEvent(new Event("cart-updated"));
    } catch {
      toast.error("Failed to add to cart");
    }
  };

  return { addToCart };
}
