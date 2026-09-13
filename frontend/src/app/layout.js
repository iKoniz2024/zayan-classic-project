import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { getApiUrl } from "@/utils/getApiUrl";

export async function generateMetadata() {
  const defaultMetadata = {
    title: {
      default: "Zayan Classic | Premium Fashion & Clothing",
      template: "%s | Zayan Classic",
    },
    description: "Discover the latest trends in fashion with Zayan Classic.",
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://zayanclassic.com"),
    alternates: {
      canonical: "/",
    },
  };

  try {
    const apiUrl = getApiUrl();
    const res = await fetch(`${apiUrl}/settings`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });
    
    if (res.ok) {
      const data = await res.json();
      defaultMetadata.icons = {
        icon: `${apiUrl}/settings/logo`,
        shortcut: `${apiUrl}/settings/logo`,
        apple: `${apiUrl}/settings/logo`,
      };
      if (data?.siteName) {
        defaultMetadata.title = {
          default: `${data.siteName} | Premium Fashion & Clothing`,
          template: `%s | ${data.siteName}`,
        };
      }
    }
  } catch (error) {
    console.warn("Could not fetch metadata settings: backend is offline or unreachable.");
  }

  return defaultMetadata;
}

import Providers from "@/components/Providers";
import MainLayout from "@/layouts/MainLayout";

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
