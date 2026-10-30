import Home from "@/views/Home/Home";
import { getApiUrl } from "@/utils/getApiUrl";

export const metadata = {
  title: "Home",
};

export const revalidate = 300;

async function fetchWithTimeout(url, revalidateSec, timeoutMs = 6000) {
  try {
    const res = await fetch(url, {
      next: { revalidate: revalidateSec },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.ok) return await res.json();
  } catch (err) {
    // Non-blocking fallback
  }
  return null;
}

async function fetchHomeData() {
  const baseUrl = getApiUrl();

  const [
    categoriesData,
    newArrivalsData,
    bestSellingData,
    flashSaleData,
    bannersData,
  ] = await Promise.all([
    fetchWithTimeout(`${baseUrl}/categories`, 300),
    fetchWithTimeout(`${baseUrl}/products/new-arrivals`, 300),
    fetchWithTimeout(`${baseUrl}/products/best-sellers`, 300),
    fetchWithTimeout(`${baseUrl}/products/flash-sale`, 300),
    fetchWithTimeout(`${baseUrl}/banners`, 300),
  ]);

  return {
    categoriesData: categoriesData || [],
    newArrivalsData: newArrivalsData || { products: [] },
    bestSellingData: bestSellingData || { products: [] },
    flashSaleData: flashSaleData || { products: [] },
    bannersData: bannersData || [],
  };
}

export default async function Page() {
  const initialData = await fetchHomeData();

  return <Home initialData={initialData} />;
}
