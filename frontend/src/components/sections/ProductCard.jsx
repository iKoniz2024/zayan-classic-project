"use client";

import Link from 'next/link';
import { useState } from "react";

import { motion } from "framer-motion";
import { Trophy, Flame, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatBDT } from "@/utils/currency";
import OrderModal from "@/components/ui/OrderModal";
import { useQueryClient } from "@tanstack/react-query";
import { getProductById } from "@/services/product.api";
import { useAuth } from "@/hooks/useAuth";

function StockBar({ stock, maxStock }) {
  if (stock === 0) return null;
  const ref = maxStock || 100;
  const percentage = Math.min((stock / ref) * 100, 100);
  const isLow = percentage <= 25;

  return (
    <div className="space-y-0.5 w-full">
      <div className="flex items-center justify-end sm:justify-between text-[11px] text-muted-foreground gap-1">
        <span className={stock <= 5 ? "font-medium text-foreground whitespace-nowrap" : "whitespace-nowrap"}>
          {stock <= 5 ? `${stock} left` : `${stock} in stock`}
        </span>
        <span className="hidden sm:inline">
          {Math.round(percentage)}%
        </span>
      </div>
      <div className="hidden sm:block h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isLow ? "bg-foreground" : "bg-primary"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

const badgeConfig = {
  "best-seller": {
    label: "Best Seller",
    icon: Trophy,
    className: "bg-foreground text-background",
    ring: "ring-2 ring-foreground/30",
  },
  "top-rated": {
    label: "Top Rated",
    icon: Star,
    className: "bg-foreground text-background",
    ring: "ring-2 ring-foreground/30",
  },
  popular: {
    label: "Popular",
    icon: Flame,
    className: "bg-foreground text-background",
    ring: "ring-2 ring-foreground/30",
  },
};

export default function ProductCard({ product, index, badge }) {
  const [showModal, setShowModal] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin";
  const hasDiscount = product.discountPercentage > 0;
  const discountedPrice = hasDiscount
    ? (product.price * (1 - product.discountPercentage / 100)).toFixed(2)
    : null;
  const isOutOfStock = product.stock === 0;

  const effectiveBadge = badge !== undefined ? badge : product.badge;

  const handlePrefetch = () => {
    if (product?._id) {
      queryClient.prefetchQuery({
        queryKey: ["product", product._id],
        queryFn: () => getProductById(product._id),
      });
    }
  };

  return (
    <>
      <motion.div
        custom={index}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-40px" }}
        variants={{
          hidden: { opacity: 0, y: 20 },
          visible: (i) => ({
            opacity: 1,
            y: 0,
            transition: { delay: Math.min(i * 0.015, 0.08), duration: 0.15, ease: "easeOut" },
          }),
        }}
      >
        <Link
          href={`/product/${product._id}`}
          className="group block h-full"
          onMouseEnter={handlePrefetch}
          onTouchStart={handlePrefetch}
        >
          <div className={`flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${badgeConfig[effectiveBadge]?.ring ?? ""}`}>
            <div className="relative aspect-square overflow-hidden bg-muted">
              <img
                src={product.thumbnail || product.images?.[0] || undefined}
                alt={product.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
                decoding="async"
              />

              {hasDiscount && (
                <div className="absolute left-3 top-3 z-10">
                  <Badge variant="destructive" className="text-[11px] font-semibold">
                    -{Math.round(product.discountPercentage)}%
                  </Badge>
                </div>
              )}

              {effectiveBadge && badgeConfig[effectiveBadge] && (
                <div className={`absolute top-3 z-20 ${hasDiscount ? "left-13" : "left-3"}`}>
                  <Badge className={`gap-1 text-[11px] font-semibold ${badgeConfig[effectiveBadge].className}`}>
                    {(() => { const Icon = badgeConfig[effectiveBadge].icon; return <Icon className="size-3" />; })()}
                    {badgeConfig[effectiveBadge].label}
                  </Badge>
                </div>
              )}

              {product.stock <= 5 && product.stock > 0 && (
                <div className="absolute right-3 top-3 z-10">
                  <Badge variant="secondary" className="text-[11px] font-semibold">
                    Only {product.stock} left
                  </Badge>
                </div>
              )}

              {isOutOfStock && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                  <Badge variant="destructive" className="text-xs font-semibold">
                    Out of Stock
                  </Badge>
                </div>
              )}
            </div>

            <div className="flex flex-1 flex-col p-2 sm:p-3">
              {product.brand && (
                <p className="hidden sm:block text-[10px] sm:text-xs font-medium uppercase tracking-wider text-muted-foreground truncate mb-0.5 sm:mb-1">
                  {product.brand}
                </p>
              )}

              <h3 className="line-clamp-2 text-xs font-semibold text-foreground sm:text-sm leading-tight">
                {product.title}
              </h3>

              <div className="mt-auto pt-1.5 sm:pt-2 flex items-end justify-between gap-1.5">
                <div className="flex flex-col justify-end">
                  <span className="text-xs sm:text-base font-bold text-foreground leading-tight">
                    {formatBDT(hasDiscount ? discountedPrice : product.price)}
                  </span>
                  {hasDiscount && (
                    <span className="text-[10px] sm:text-xs text-muted-foreground line-through leading-tight">
                      {formatBDT(product.price)}
                    </span>
                  )}
                </div>

                <div className="flex flex-col items-end justify-end text-right min-w-0">
                  <StockBar stock={product.stock} maxStock={100} />
                </div>
              </div>
            </div>

            {!isAdmin && (
              <div className="p-2 pt-0 sm:p-3 sm:pt-0 mt-auto">
                <button
                  disabled={isOutOfStock}
                  onClick={(e) => {
                    e.preventDefault();
                    setShowModal(true);
                  }}
                  className="w-full rounded-md sm:rounded-lg bg-foreground py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-background transition-all hover:bg-foreground/90 active:scale-[0.97] disabled:opacity-50 cursor-pointer"
                >
                  {isOutOfStock ? "Unavailable" : "অর্ডার করুন"}
                </button>
              </div>
            )}
          </div>
        </Link>
      </motion.div>

      {!isAdmin && (
        <OrderModal
          product={product}
          open={showModal}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
