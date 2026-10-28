import Checkout from "@/views/Checkout/Checkout";
import { Suspense } from "react";

export const metadata = {
  title: "Checkout",
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Checkout />
    </Suspense>
  );
}
