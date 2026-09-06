"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSettings } from "../services/settings.api";

import { getApiUrl } from "../utils/getApiUrl";

const useSettings = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const logo = data?.logo || null;

  useEffect(() => {
    if (logo && typeof document !== "undefined") {
      let link = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "shortcut icon";
        document.head.appendChild(link);
      }
      const apiUrl = getApiUrl();
      link.href = `${apiUrl}/settings/logo`;
    }
  }, [logo]);

  return {
    siteName: data?.siteName || "Zayan Classic",
    logo,
    contactEmail: data?.contactEmail || "",
    contactPhone: data?.contactPhone || "",
    address: data?.address || "",
    googleMapLink: data?.googleMapLink || "",
    facebookUrl: data?.facebookUrl || "",
    instagramUrl: data?.instagramUrl || "",
    tiktokUrl: data?.tiktokUrl || "",
    youtubeUrl: data?.youtubeUrl || "",
    isLoading,
  };
};

export default useSettings;
