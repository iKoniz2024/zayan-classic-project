"use client";

import { useRouter } from 'next/navigation';
import { useState } from "react";
import { X, Minus, Plus, ShoppingCart } from "lucide-react";

import toast from "react-hot-toast";
import { useAddToCart } from "@/hooks/useAddToCart";
import { formatBDT } from "@/utils/currency";

const FASHION_CATEGORIES = [
  "shirt", "t-shirt", "polo", "panjabi", "blazer", "waistcoat",
  "pant", "jeans", "trouser", "jacket", "hoodie", "sweater",
  "high-neck", "coat", "vest", "shorts", "suit",
  "shoe", "sneaker", "boot", "sandal", "slipper",
  "dress", "kurti", "saree", "salwar", "lehenga",
];

export default function OrderModal({ product, open, onClose }) {
  const router = useRouter();
  const { addToCart } = useAddToCart();
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedColor, setSelectedColor] = useState(() => product?.colors?.[0] || null);
  const [activeDisplayImage, setActiveDisplayImage] = useState(() => product?.colors?.[0]?.image || null);
  const [quantity, setQuantity] = useState(1);

  if (!open || !product) return null;

  const hasDiscount = product.discountPercentage > 0;
  const discountedPrice = hasDiscount
    ? (product.price * (1 - product.discountPercentage / 100)).toFixed(2)
    : null;
  const isOutOfStock = product.stock === 0;

  const cat = product.category;
  const productCategory = typeof cat === "string"
    ? cat.toLowerCase().trim()
    : typeof cat === "object" && cat?.slug
      ? cat.slug.toLowerCase().trim()
      : typeof cat === "object" && cat?.name
        ? cat.name.toLowerCase().trim()
        : "";
  const isFashion = FASHION_CATEGORIES.some(fc => productCategory.includes(fc));

  const handleAddToCart = async () => {
    if (isFashion && product.sizes?.length > 0 && !selectedSize) {
      toast.error("Please select a size");
      return;
    }
    if (product.colors?.length > 0 && !selectedColor) {
      toast.error("Please select a color");
      return;
    }
    await addToCart(
      product,
      quantity,
      selectedSize || "",
      selectedColor?.name || "",
      selectedColor?.image || ""
    );
    onClose();
    router.push("/cart");
  };

  const previewImage = activeDisplayImage || product.thumbnail || product.images?.[0] || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="text-lg font-semibold text-foreground">Choose Options</h3>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-col gap-6 p-6 sm:flex-row">
          <div className="shrink-0">
            <div className="size-40 overflow-hidden rounded-xl border border-border bg-muted sm:size-48">
              <img
                src={previewImage}
                alt={product.title}
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-4">
            <div>
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

            {product.colors?.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">
                  Choose Color : <span className="font-normal text-muted-foreground">{selectedColor?.name}</span>
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
                        className={`flex items-center gap-2 rounded-lg border-2 p-1.5 transition-all ${
                          isSelected
                            ? "border-foreground bg-muted/40 ring-1 ring-foreground"
                            : "border-border hover:border-foreground/50 bg-background"
                        }`}
                      >
                        <div className="size-8 overflow-hidden rounded border border-border bg-muted shrink-0">
                          <img
                            src={colorObj.image || product.thumbnail}
                            alt={colorObj.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <span className="pr-1.5 text-xs font-semibold text-foreground">
                          {colorObj.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {isFashion && product.sizes?.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">Choose Size</p>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                        selectedSize === size
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-foreground hover:border-foreground/50"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Choose Quantity</p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="flex size-10 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-muted"
                >
                  <Minus className="size-4" />
                </button>
                <span className="flex size-10 items-center justify-center rounded-lg border border-border text-sm font-medium">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="flex size-10 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-muted"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Close
          </button>
          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            className="flex items-center gap-2 rounded-lg bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
          >
            <ShoppingCart className="size-4" />
            Add to cart
          </button>
        </div>
      </div>
    </div>
  );
}
