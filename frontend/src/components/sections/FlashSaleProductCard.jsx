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
    <div className="space-y-0.5 w-full">
      <div className="flex items-center justify-end sm:justify-between text-[11px] text-muted-foreground gap-1">
        <span className="whitespace-nowrap">
          {stock} left
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
                  <StockBar stock={product.stock} maxStock={maxStock || 100} />
                </div>
              </div>
            </div>

            {!isAdmin && (
              <div className="p-2 pt-0 sm:p-3 sm:pt-0 mt-auto">
                <button
                  disabled={product.stock === 0}
                  onClick={(e) => {
                    e.preventDefault();
                    setShowModal(true);
                  }}
                  className="w-full rounded-md sm:rounded-lg bg-foreground py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50 cursor-pointer"
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
