"use client";

import Link from 'next/link';
import { useState } from "react";

import { motion } from "framer-motion";
import { Trophy, Flame, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatBDT } from "@/utils/currency";
import OrderModal from "@/components/ui/OrderModal";
import { useAuth } from "@/hooks/useAuth";

function StockBar({ stock, maxStock }) {
  if (stock === 0) return null;
  const ref = maxStock || 100;
  const percentage = Math.min((stock / ref) * 100, 100);
  const isLow = percentage <= 25;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className={`text-[11px] ${stock <= 5 ? "font-medium text-foreground" : "text-muted-foreground"}`}>
          {stock <= 5 ? `${stock} left` : `${stock} in stock`}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {Math.round(percentage)}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
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
  const isAdmin = user?.role === "admin";
  const hasDiscount = product.discountPercentage > 0;
  const discountedPrice = hasDiscount
    ? (product.price * (1 - product.discountPercentage / 100)).toFixed(2)
    : null;
  const isOutOfStock = product.stock === 0;

  const effectiveBadge = badge !== undefined ? badge : product.badge;

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
            transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
          }),
        }}
      >
        <Link href={`/product/${product._id}`} className="group block h-full">
          <div className={`flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${badgeConfig[effectiveBadge]?.ring ?? ""}`}>
            <div className="relative aspect-square overflow-hidden bg-muted">
              <img
                src={product.thumbnail || product.images?.[0] || undefined}
                alt={product.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
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

            <div className="flex flex-1 flex-col gap-2 p-4">
              {product.brand && (
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {product.brand}
                </p>
              )}

              <h3 className="line-clamp-2 text-sm font-semibold text-foreground sm:text-base">
                {product.title}
              </h3>

              <div className="mt-auto flex items-baseline gap-2">
                <span className="text-lg font-bold text-foreground">
                  {formatBDT(hasDiscount ? discountedPrice : product.price)}
                </span>
                {hasDiscount && (
                  <span className="text-sm text-muted-foreground line-through">
                    {formatBDT(product.price)}
                  </span>
                )}
              </div>

              <StockBar stock={product.stock} maxStock={100} />
            </div>

            {!isAdmin && (
              <div className="p-4 pt-0">
                <button
                  disabled={isOutOfStock}
                  onClick={(e) => {
                    e.preventDefault();
                    setShowModal(true);
                  }}
                  className="w-full rounded-lg bg-foreground py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
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
