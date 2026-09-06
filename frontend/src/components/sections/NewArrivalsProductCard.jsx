"use client";

import Link from 'next/link';
import { useState } from "react";

import { motion } from "framer-motion";
import { formatBDT } from "@/utils/currency";
import OrderModal from "@/components/ui/OrderModal";
import { useAuth } from "@/hooks/useAuth";

export default function NewArrivalsProductCard({ product, index }) {
  const [showModal, setShowModal] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const hasDiscount = product.discountPercentage > 0;
  const discountedPrice = hasDiscount
    ? (product.price * (1 - product.discountPercentage / 100)).toFixed(2)
    : null;
  const isOutOfStock = product.stock === 0;

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
            transition: { delay: i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
          }),
        }}
        className="shrink-0 w-37.5 sm:w-45"
      >
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Link href={`/product/${product._id}`} className="block">
            <div className="relative aspect-3/4 overflow-hidden bg-muted">
              <img
                src={product.thumbnail || product.images?.[0] || null}
                alt={product.title}
                className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                loading="lazy"
              />
              {hasDiscount && (
                <div className="absolute left-0 top-4 z-10 rounded-r bg-foreground px-2 py-1 text-[10px] font-bold text-background">
                  -{Math.round(product.discountPercentage)}%
                </div>
              )}
              {isOutOfStock && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                  <span className="rounded bg-foreground px-2 py-1 text-[10px] font-semibold text-background">
                    Out of Stock
                  </span>
                </div>
              )}
            </div>
          </Link>

          <div className="p-2">
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-bold text-foreground">
                {formatBDT(hasDiscount ? discountedPrice : product.price)}
              </span>
              {hasDiscount && (
                <span className="text-[10px] text-muted-foreground line-through">
                  {formatBDT(product.price)}
                </span>
              )}
            </div>
          </div>

          {!isAdmin && (
            <div className="px-2 pb-2">
              <button
                disabled={isOutOfStock}
                onClick={() => setShowModal(true)}
                className="w-full rounded bg-foreground py-1.5 text-[11px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
              >
                {isOutOfStock ? "Unavailable" : "অর্ডার করুন"}
              </button>
            </div>
          )}
        </div>
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
