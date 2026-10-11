"use client";

import { motion } from "framer-motion";

export default function FeatureCard({ feature, index }) {
  const Icon = feature.icon;

  return (
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
          transition: { delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
        }),
      }}
    >
      <div className="group flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card p-4 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg sm:gap-4 sm:p-8">
        <div className="flex size-11 items-center justify-center rounded-xl bg-muted transition-transform duration-300 group-hover:scale-110 sm:size-14 sm:rounded-2xl">
          <Icon className="size-5 text-foreground sm:size-7" strokeWidth={1.5} />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground sm:text-lg">
            {feature.title}
          </h3>
          <p className="hidden mt-2 text-sm leading-relaxed text-muted-foreground sm:block">
            {feature.description}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
