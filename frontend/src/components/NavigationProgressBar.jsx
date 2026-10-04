"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);

  const finishProgress = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setProgress(100);
    const timer = setTimeout(() => {
      setLoading(false);
      setProgress(0);
    }, 300);
    return timer;
  };

  // Complete progress bar smoothly on route change completion
  useEffect(() => {
    if (loading) {
      const timer = finishProgress();
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams]);

  // Intercept click on links to start instant visual progress
  useEffect(() => {
    const handleAnchorClick = (e) => {
      const target = e.target.closest("a");
      if (!target) return;

      // Ignore if user clicked a button (e.g. Order Now, Modal buttons, Add to Cart)
      const clickedButton = e.target.closest("button, [role='button'], input[type='submit'], [data-no-progress]");
      if (clickedButton || e.defaultPrevented) return;

      const href = target.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("javascript:") ||
        href.startsWith("tel:") ||
        href.startsWith("mailto:")
      ) {
        return;
      }

      // Check if external or blank target
      if (target.target === "_blank" || target.hasAttribute("download")) return;

      // Ignore if clicking the exact same URL page
      try {
        const targetUrl = new URL(target.href, window.location.origin);
        const currentUrl = new URL(window.location.href);
        if (targetUrl.href === currentUrl.href) {
          return;
        }
      } catch {
        // Continue if URL parsing fails
      }

      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      // Start progress immediately
      setLoading(true);
      setProgress(35);

      intervalRef.current = setInterval(() => {
        setProgress((prev) => (prev < 85 ? prev + 10 : prev));
      }, 120);

      // Safety fallback: Auto-complete progress if no route change occurs after 2s
      timeoutRef.current = setTimeout(() => {
        finishProgress();
      }, 2000);
    };

    document.addEventListener("click", handleAnchorClick, true);
    return () => {
      document.removeEventListener("click", handleAnchorClick, true);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!loading && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[9999] h-1 pointer-events-none overflow-hidden bg-transparent"
    >
      <div
        className="h-full bg-primary transition-all duration-300 ease-out shadow-[0_0_8px_rgba(0,0,0,0.4)]"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
        }}
      />
    </div>
  );
}
