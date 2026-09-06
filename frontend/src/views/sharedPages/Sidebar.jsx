"use client";

import Link from 'next/link';

import { usePathname } from 'next/navigation';
import useSettings from "@/hooks/useSettings";
import { LayoutDashboard, ShoppingBag, Tags, Image as ImageIcon, ShoppingCart, Settings, User, Home } from "lucide-react";

export default function Sidebar({ open, onClose }) {
  const { siteName, logo } = useSettings();
  const pathname = usePathname();
  
  const menuItems = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "Products",
      path: "/dashboard/products",
      icon: ShoppingBag,
    },
    {
      name: "Categories",
      path: "/dashboard/categories",
      icon: Tags,
    },
    {
      name: "Banners",
      path: "/dashboard/banners",
      icon: ImageIcon,
    },
    {
      name: "Orders",
      path: "/dashboard/orders",
      icon: ShoppingCart,
    },
    {
      name: "Settings",
      path: "/dashboard/settings",
      icon: Settings,
    },
    {
      name: "Profile",
      path: "/dashboard/profile",
      icon: User,
    },
    {
      name: "Home",
      path: "/",
      icon: Home,
    },
  ];

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r bg-card p-5 transition-transform duration-200 lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <img src={logo} alt={siteName} className="mb-6 h-16 w-auto dark:invert" />

        <nav className="space-y-1">
          {menuItems.map((item) => {
            const isActive = item.path === "/dashboard" 
              ? pathname === "/dashboard" 
              : pathname.startsWith(item.path);

            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className={`size-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
