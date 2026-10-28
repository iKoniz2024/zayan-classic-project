"use client";

import { useRouter } from 'next/navigation';
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Minus, Plus, ShoppingCart } from "lucide-react";

import toast from "react-hot-toast";
import { useAddToCart } from "@/hooks/useAddToCart";
import { setDirectOrder } from "@/utils/localCart";
import { formatBDT } from "@/utils/currency";

export default function OrderModal({ product, open, onClose }) {
  const router = useRouter();
  const { addToCart } = useAddToCart();
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [activeDisplayImage, setActiveDisplayImage] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open && product) {
      setSelectedSize(null);
      setSelectedColor(product?.colors?.[0] || null);
      setActiveDisplayImage(product?.colors?.[0]?.image || null);
      setQuantity(1);
    }
  }, [open, product]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!mounted || !open || !product) return null;

  const hasDiscount = product.discountPercentage > 0;
  const discountedPrice = hasDiscount
    ? (product.price * (1 - product.discountPercentage / 100)).toFixed(2)
    : null;
  const isOutOfStock = product.stock === 0;

  const validateSelection = () => {
    if (product.sizes?.length > 0 && !selectedSize) {
      toast.error("Please select a size");
      return false;
    }
    if (product.colors?.length > 0 && !selectedColor) {
      toast.error("Please select a color");
      return false;
    }
    return true;
  };

  const handleAddToCart = async () => {
    if (isAddingToCart || isOrdering) return;
    if (!validateSelection()) return;

    setIsAddingToCart(true);
    try {
      await addToCart(
        product,
        quantity,
        selectedSize || "",
        selectedColor?.name || "",
        selectedColor?.image || "",
        { openDrawer: true }
      );
      onClose();
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleBuyNow = () => {
    if (isAddingToCart || isOrdering) return;
    if (!validateSelection()) return;

    setIsOrdering(true);
    try {
      const finalPrice = product.discountPercentage > 0
        ? Number((product.price * (1 - product.discountPercentage / 100)).toFixed(2))
        : Number(product.price || 0);

      const orderItem = {
        productId: product._id,
        title: product.title,
        thumbnail: selectedColor?.image || product.thumbnail || product.images?.[0] || null,
        colorImage: selectedColor?.image || null,
        price: finalPrice,
        stock: product.stock ?? 0,
        category: typeof product.category === "string"
          ? product.category
          : product.category?.name || product.category?.slug || "",
        quantity,
        size: selectedSize || "",
        color: selectedColor?.name || "",
      };

      setDirectOrder(orderItem);
      onClose();
      router.push("/checkout?direct=1");
    } finally {
      setIsOrdering(false);
    }
  };

  const previewImage = activeDisplayImage || product.thumbnail || product.images?.[0] || null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-lg sm:max-w-2xl max-h-[85vh] sm:max-h-[88vh] rounded-2xl bg-background shadow-2xl border border-border overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header with Title and Corner X Button */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background px-4 py-3 sm:px-6 sm:py-3.5">
          <h3 className="text-base sm:text-lg font-bold text-foreground">Choose Options</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 sm:size-9 items-center justify-center rounded-full bg-muted text-foreground transition-all hover:bg-muted/80 active:scale-95 cursor-pointer"
            aria-label="Close"
          >
            <X className="size-4 sm:size-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
          <div className="flex flex-col gap-4 sm:gap-6 sm:flex-row">
            {/* Image Preview & Compact Header for Mobile */}
            <div className="flex items-center gap-3 sm:block sm:shrink-0">
              <div className="size-20 sm:size-44 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                <img
                  src={previewImage}
                  alt={product.title}
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Mobile Title & Price beside image */}
              <div className="sm:hidden flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">
                  {product.title}
                </h4>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-base font-bold text-foreground">
                    {formatBDT(hasDiscount ? discountedPrice : product.price)}
                  </span>
                  {hasDiscount && (
                    <span className="text-xs text-muted-foreground line-through">
                      {formatBDT(product.price)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Desktop Details & Options */}
            <div className="flex flex-1 flex-col gap-4 min-w-0">
              {/* Desktop Title & Price */}
              <div className="hidden sm:block">
                <h4 className="text-base font-semibold text-foreground sm:text-lg">
                  {product.title}
                </h4>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-lg font-bold text-foreground">
                    {formatBDT(hasDiscount ? discountedPrice : product.price)}
                  </span>
                  {hasDiscount && (
                    <span className="text-sm text-muted-foreground line-through">
                      {formatBDT(product.price)}
                    </span>
                  )}
                </div>
              </div>

              {/* Colors */}
              {product.colors?.length > 0 && (
                <div>
                  <p className="mb-2 text-xs sm:text-sm font-bold text-foreground">
                    Choose Color : <span className="font-normal text-muted-foreground">{selectedColor?.name || "Select color"}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {product.colors.map((colorObj, index) => {
                      const isSelected = selectedColor?.name === colorObj.name;
                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            setSelectedColor(colorObj);
                            if (colorObj.image) {
                              setActiveDisplayImage(colorObj.image);
                            }
                          }}
                          className={`flex items-center gap-1.5 sm:gap-2 rounded-lg border-2 p-1 sm:p-1.5 transition-all cursor-pointer active:scale-95 ${
                            isSelected
                              ? "border-foreground bg-muted/40 ring-1 ring-foreground"
                              : "border-border hover:border-foreground/50 bg-background"
                          }`}
                        >
                          <div className="size-7 sm:size-8 overflow-hidden rounded border border-border bg-muted shrink-0">
                            <img
                              src={colorObj.image || product.thumbnail}
                              alt={colorObj.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <span className="pr-1 text-xs font-semibold text-foreground">
                            {colorObj.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sizes */}
              {product.sizes?.length > 0 && (
                <div>
                  <p className="mb-2 text-xs sm:text-sm font-bold text-foreground">Choose Size</p>
                  <div className="flex flex-wrap gap-2">
                    {product.sizes.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setSelectedSize(size)}
                        className={`rounded-lg border px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer active:scale-95 ${
                          selectedSize === size
                            ? "border-foreground bg-foreground text-background"
                            : "border-border text-foreground hover:border-foreground/50 bg-background"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div>
                <p className="mb-2 text-xs sm:text-sm font-bold text-foreground">Choose Quantity</p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="flex size-9 sm:size-10 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-muted active:scale-95 cursor-pointer"
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="flex size-9 sm:size-10 items-center justify-center rounded-lg border border-border text-xs sm:text-sm font-bold">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className="flex size-9 sm:size-10 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-muted active:scale-95 cursor-pointer"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Action Footer */}
        <div className="sticky bottom-0 z-20 grid grid-cols-2 gap-2.5 sm:gap-4 border-t border-border bg-background p-3 sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={isOutOfStock || isAddingToCart || isOrdering}
            className="flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl border-2 border-foreground/20 px-3 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-foreground transition-all hover:bg-muted active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            <ShoppingCart className="size-4 shrink-0" />
            <span>{isAddingToCart ? "Adding..." : "Add to Cart"}</span>
          </button>
          <button
            type="button"
            onClick={handleBuyNow}
            disabled={isOutOfStock || isAddingToCart || isOrdering}
            className="flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl bg-foreground px-3 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-background transition-all hover:bg-foreground/90 active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-sm"
          >
            <span>{isOrdering ? "অপেক্ষা করুন..." : "অর্ডার করুন"}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
