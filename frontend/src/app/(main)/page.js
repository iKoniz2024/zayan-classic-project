import Home from "@/views/Home/Home";
import { getApiUrl } from "@/utils/getApiUrl";

export const metadata = {
  title: "Home",
};

export const dynamic = 'force-dynamic';

async function fetchHomeData() {
  const baseUrl = getApiUrl();

  try {
    const [
      categoriesRes,
      newArrivalsRes,
      bestSellingRes,
      flashSaleRes,
      bannersRes
    ] = await Promise.all([
      fetch(`${baseUrl}/categories`, { next: { revalidate: 300 } }),
      fetch(`${baseUrl}/products/new-arrivals`, { cache: "no-store" }),
      fetch(`${baseUrl}/products/best-sellers`, { cache: "no-store" }),
      fetch(`${baseUrl}/products/flash-sale`, { cache: "no-store" }),
      fetch(`${baseUrl}/banners`, { next: { revalidate: 300 } }),
    ]);

    return {
      categoriesData: categoriesRes.ok ? await categoriesRes.json() : [],
      newArrivalsData: newArrivalsRes.ok ? await newArrivalsRes.json() : { products: [] },
      bestSellingData: bestSellingRes.ok ? await bestSellingRes.json() : { products: [] },
      flashSaleData: flashSaleRes.ok ? await flashSaleRes.json() : { products: [] },
      bannersData: bannersRes.ok ? await bannersRes.json() : [],
    };
  } catch (err) {
    console.error("Failed to fetch home page data:", err.message);
    return {
      categoriesData: [],
      newArrivalsData: { products: [] },
      bestSellingData: { products: [] },
      flashSaleData: { products: [] },
      bannersData: [],
    };
  }
}

export default async function Page() {
  const initialData = await fetchHomeData();

  return <Home initialData={initialData} />;
}
