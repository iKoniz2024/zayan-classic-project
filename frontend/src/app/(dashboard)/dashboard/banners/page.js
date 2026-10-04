import { Suspense } from "react";
import AdminBanners from "@/views/Dashboard/AdminBanners";

export const metadata = {
  title: "Admin Banners",
};

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-sm text-muted-foreground">Loading...</div>}>
      <AdminBanners />
    </Suspense>
  );
}
