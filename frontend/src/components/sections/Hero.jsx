"use client";

import Link from 'next/link';

import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, Navigation } from "swiper/modules";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getBanners } from "@/services/banner.api";

import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";

const heroStyles = `
  .hero-swiper .swiper-pagination-bullet {
    width: 10px;
    height: 10px;
    background: rgba(255, 255, 255, 0.4);
    opacity: 1;
    transition: all 0.3s;
  }
  .hero-swiper .swiper-pagination-bullet-active {
    background: #fff;
    width: 24px;
    border-radius: 5px;
  }
`;

export default function Hero({ initialData }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["banners"],
    queryFn: getBanners,
    initialData: () => {
      if (Array.isArray(initialData) && initialData.length > 0) return initialData;
      const cached = queryClient.getQueryData(["banners"]);
      if (Array.isArray(cached) && cached.length > 0) return cached;
      return undefined;
    },
    staleTime: 5 * 60 * 1000,
  });

  const banners = (data ?? []).filter((b) => b.isActive && (b.image || b.images?.length > 0));

  if (isLoading && banners.length === 0) {
    return (
      <section id="hero" className="relative overflow-hidden py-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-80 items-center justify-center sm:h-100 lg:h-125">
            <div className="size-8 animate-spin rounded-full border-4 border-foreground border-t-transparent" />
          </div>
        </div>
      </section>
    );
  }

  if (banners.length === 0) {
    return null;
  }

  return (
    <section id="hero" className="relative overflow-hidden py-4">
      <style>{heroStyles}</style>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Swiper
          modules={[Autoplay, Pagination, Navigation]}
          spaceBetween={0}
          slidesPerView={1}
          autoplay={{ delay: 4000, disableOnInteraction: false }}
          pagination={{ clickable: true }}
          navigation={{
            prevEl: ".hero-prev",
            nextEl: ".hero-next",
          }}
          loop={banners.length > 1}
          className="hero-swiper relative overflow-hidden rounded-2xl"
        >
          {banners.map((banner, index) => {
            const imageSrc = banner.image || banner.images?.[0];
            const content = (
              <div className="relative aspect-16/7 w-full overflow-hidden bg-muted sm:aspect-21/9">
                <img
                  src={imageSrc}
                  alt={banner.title || `Banner ${index + 1}`}
                  className="h-full w-full object-cover"
                  loading={index === 0 ? "eager" : "lazy"}
                  decoding="async"
                />
              </div>
            );

            return (
              <SwiperSlide key={banner._id || index}>
                {banner.link ? (
                  <Link href={banner.link} className="block w-full">
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </SwiperSlide>
            );
          })}

          {banners.length > 1 && (
            <>
              <button
                className="hero-prev absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/60 p-2 text-foreground backdrop-blur-xs transition hover:bg-background/90 cursor-pointer sm:left-4"
                aria-label="Previous banner"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                className="hero-next absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/60 p-2 text-foreground backdrop-blur-xs transition hover:bg-background/90 cursor-pointer sm:right-4"
                aria-label="Next banner"
              >
                <ChevronRight className="size-5" />
              </button>
            </>
          )}
        </Swiper>
      </div>
    </section>
  );
}
