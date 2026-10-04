"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AuthProvider from "@/context/AuthProvider";
import { CartProvider } from "@/context/CartContext";
import { ThemeProvider } from "@/context/ThemeProvider";
import { Toaster } from "react-hot-toast";
import { HelmetProvider } from "react-helmet-async";
import useSettings from "@/hooks/useSettings";
import MetaPixel from "@/components/MetaPixel";

import { Suspense } from "react";
import NavigationProgressBar from "@/components/NavigationProgressBar";

function DynamicFaviconUpdater() {
  useSettings();
  return null;
}

export default function Providers({ children }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <HelmetProvider>
      <AuthProvider>
        <ThemeProvider>
          <CartProvider>
            <QueryClientProvider client={queryClient}>
              <Suspense fallback={null}>
                <NavigationProgressBar />
              </Suspense>
              <DynamicFaviconUpdater />
              <MetaPixel />
              {children}
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 3000,
                  style: {
                    borderRadius: "10px",
                    background: "#1a1a1a",
                    color: "#fff",
                  },
                  success: {
                    iconTheme: {
                      primary: "#fff",
                      secondary: "#1a1a1a",
                    },
                  },
                  error: {
                    iconTheme: {
                      primary: "#fff",
                      secondary: "#1a1a1a",
                    },
                  },
                }}
              />
            </QueryClientProvider>
          </CartProvider>
        </ThemeProvider>
      </AuthProvider>
    </HelmetProvider>
  );
}
