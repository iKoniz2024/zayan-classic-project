"use client";

import Link from 'next/link';
import { useState } from "react";

import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { formatBDT } from "@/utils/currency";
import OrderModal from "@/components/ui/OrderModal";
import { useAuth } from "@/hooks/useAuth";

function StockBar({ stock, maxStock }) {
  const percentage = maxStock > 0 ? Math.min((stock / maxStock) * 100, 100) : 0;
  const isLow = percentage <= 25;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {stock} left
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

export default function FlashSaleProductCard({ product, index, maxStock }) {
  const [showModal, setShowModal] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const hasDiscount = product.discountPercentage > 0;
  const discountedPrice = hasDiscount
    ? (product.price * (1 - product.discountPercentage / 100)).toFixed(2)
    : null;

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
        <Link
          href={`/product/${product._id}`}
          className="group block h-full"
        >
          <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
            <div className="relative overflow-hidden bg-muted aspect-square">
              <img
                src={product.thumbnail || product.images?.[0] || undefined}
                alt={product.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
              />

              {hasDiscount && (
                <div className="absolute left-3 top-3 z-10">
                  <Badge variant="destructive" className="animate-pulse text-[11px] font-semibold">
                    {Math.round(product.discountPercentage)}% OFF
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

              {product.stock === 0 && (
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

              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-foreground">
                  {formatBDT(hasDiscount ? discountedPrice : product.price)}
                </span>
                {hasDiscount && (
                  <span className="text-sm text-muted-foreground line-through">
                    {formatBDT(product.price)}
                  </span>
                )}
              </div>

              {product.stock > 0 && (
                <StockBar stock={product.stock} maxStock={maxStock} />
              )}
            </div>

            {!isAdmin && (
              <div className="p-4 pt-0 mt-auto">
                <button
                  disabled={product.stock === 0}
                  onClick={(e) => {
                    e.preventDefault();
                    setShowModal(true);
                  }}
                  className="w-full rounded-lg bg-foreground py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
                >
                  {product.stock === 0 ? "Unavailable" : "অর্ডার করুন"}
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
