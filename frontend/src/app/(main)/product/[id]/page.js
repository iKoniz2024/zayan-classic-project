import ProductDetails from "@/views/Products/ProductDetails";
import { getApiUrl } from "@/utils/getApiUrl";

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const { id } = await params;
  try {
    const baseUrl = getApiUrl();
    const res = await fetch(`${baseUrl}/products/${id}`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const p = await res.json();
      return {
        title: p?.title ? `${p.title} | Zayan Classic` : "Product Details | Zayan Classic",
        description: p?.description?.slice(0, 160) || "Explore premium products at Zayan Classic",
      };
    }
  } catch {}
  return { title: "Product Details | Zayan Classic" };
}

async function fetchProduct(id) {
  try {
    const baseUrl = getApiUrl();
    const res = await fetch(`${baseUrl}/products/${id}`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) return await res.json();
  } catch (err) {
    console.error("Failed to fetch product on server:", err.message);
  }
  return null;
}

export default async function Page({ params }) {
  const { id } = await params;
  const initialProduct = await fetchProduct(id);
  return <ProductDetails initialProduct={initialProduct} id={id} />;
}
