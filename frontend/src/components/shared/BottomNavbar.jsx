"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  LayoutGrid,
  ShoppingCart,
  Package,
  User,
  X,
  Sparkles,
  LayoutDashboard,
  ShoppingBag,
  Tags,
  SlidersHorizontal,
  Image as ImageIcon,
  Settings,
  Home,
  ChevronRight,
  ChevronDown,
  LogOut,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getCategories } from "@/services/category.api";
import useCart from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";

export default function BottomNavbar() {
  const pathname = usePathname();
  const { cartCount } = useCart();
  const { user, logout } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [adminMoreOpen, setAdminMoreOpen] = useState(false);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState({});

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close open drawers on route change
  useEffect(() => {
    setCategoriesOpen(false);
    setAdminMoreOpen(false);
  }, [pathname]);

  const toggleExpand = (catId) => {
    setExpandedCategoryIds((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  if (!mounted) return null;

  const isAdminRoute = pathname?.startsWith("/dashboard");
  const isAdminUser = user?.role === "admin";

  // ---------------------------------------------------------------------------
  // 1. ADMIN BOTTOM NAVBAR ITEMS
  // ---------------------------------------------------------------------------
  const adminNavItems = [
    {
      id: "admin-dashboard",
      label: "Overview",
      icon: LayoutDashboard,
      href: "/dashboard",
      isActive: pathname === "/dashboard",
    },
    {
      id: "admin-products",
      label: "Products",
      icon: ShoppingBag,
      href: "/dashboard/products",
      isActive: pathname.startsWith("/dashboard/products"),
    },
    {
      id: "admin-orders",
      label: "Orders",
      icon: ShoppingCart,
      href: "/dashboard/orders",
      isActive: pathname.startsWith("/dashboard/orders"),
    },
    {
      id: "admin-categories",
      label: "Categories",
      icon: Tags,
      href: "/dashboard/categories",
      isActive: pathname.startsWith("/dashboard/categories"),
    },
    {
      id: "admin-more",
      label: "More",
      icon: SlidersHorizontal,
      onClick: () => setAdminMoreOpen(!adminMoreOpen),
      isActive:
        adminMoreOpen ||
        pathname.startsWith("/dashboard/banners") ||
        pathname.startsWith("/dashboard/settings") ||
        pathname.startsWith("/dashboard/profile"),
    },
  ];

  // ---------------------------------------------------------------------------
  // 2. CUSTOMER BOTTOM NAVBAR ITEMS
  // ---------------------------------------------------------------------------
  const customerNavItems = [
    {
      id: "home",
      label: "Home",
      icon: House,
      href: "/",
      isActive: pathname === "/",
    },
    {
      id: "categories",
      label: "Categories",
      icon: LayoutGrid,
      onClick: () => setCategoriesOpen(!categoriesOpen),
      isActive: categoriesOpen || pathname === "/products",
    },
    {
      id: "cart",
      label: "Cart",
      icon: ShoppingCart,
      badge: cartCount > 0 ? cartCount : null,
      onClick: () => {
        window.dispatchEvent(new Event("open-cart-drawer"));
      },
      isActive: pathname === "/cart",
    },
    {
      id: "orders",
      label: "My Orders",
      icon: Package,
      href: "/orders",
      isActive: pathname === "/orders",
    },
    {
      id: "account",
      label: isAdminUser ? "Admin" : user ? "Account" : "Login",
      icon: User,
      href: isAdminUser ? "/dashboard" : user ? "/profile" : "/login",
      isActive:
        pathname === "/profile" ||
        pathname === "/login" ||
        (pathname?.startsWith("/dashboard") && !isAdminRoute),
    },
  ];

  const currentNavItems = isAdminRoute ? adminNavItems : customerNavItems;

  return (
    <>
      {/* ----------------------------------------------------------------------- */}
      {/* CUSTOMER CATEGORIES SIDEBAR DRAWER (STRICTLY CATEGORIES & SUBCATEGORIES)  */}
      {/* ----------------------------------------------------------------------- */}
      {!isAdminRoute && categoriesOpen && (
        <div
          className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={() => setCategoriesOpen(false)}
        >
          <aside
            className="fixed inset-y-0 left-0 z-[9999] flex w-80 max-w-[85vw] flex-col bg-card shadow-2xl border-r border-border/80 animate-in slide-in-from-left-full duration-300 ease-out"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-border/80 p-4 bg-muted/30">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <LayoutGrid className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Categories</h3>
                  <p className="text-[10px] text-muted-foreground">Browse categories & subcategories</p>
                </div>
              </div>
              <button
                onClick={() => setCategoriesOpen(false)}
                className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Pure Categories List with Subcategories Accordion */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {Array.isArray(categories) &&
                categories.map((cat) => {
                  const catKey = cat._id || cat.slug || cat.name;
                  const hasChildren = Array.isArray(cat.children) && cat.children.length > 0;
                  const isExpanded = !!expandedCategoryIds[catKey];

                  return (
                    <div
                      key={catKey}
                      className="rounded-xl border border-border/70 overflow-hidden bg-background/50 transition-all hover:border-primary/40"
                    >
                      {/* Parent Category Row */}
                      <div className="flex items-center justify-between p-2.5">
                        <Link
                          href={`/products?category=${encodeURIComponent(cat.slug || cat.name)}`}
                          onClick={() => setCategoriesOpen(false)}
                          className="flex items-center gap-3 min-w-0 flex-1 group"
                        >
                          {cat.image ? (
                            <img
                              src={cat.image}
                              alt={cat.name}
                              className="size-10 rounded-xl object-cover border border-border/60 shrink-0"
                            />
                          ) : (
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                              <Sparkles className="size-4" />
                            </div>
                          )}
                          <span className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                            {cat.name}
                          </span>
                        </Link>

                        {/* Expand / Collapse Subcategories Button */}
                        {hasChildren && (
                          <button
                            onClick={() => toggleExpand(catKey)}
                            className="flex size-8 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors ml-1 cursor-pointer shrink-0"
                            title="Toggle subcategories"
                          >
                            <ChevronDown
                              className={`size-4 transition-transform duration-200 ${
                                isExpanded ? "rotate-180 text-primary" : ""
                              }`}
                            />
                          </button>
                        )}
                      </div>

                      {/* Subcategories Accordion List */}
                      {hasChildren && isExpanded && (
                        <div className="border-t border-border/60 bg-muted/30 p-2 pl-4 space-y-1 animate-in slide-in-from-top-2 duration-150">
                          <Link
                            href={`/products?category=${encodeURIComponent(cat.slug || cat.name)}`}
                            onClick={() => setCategoriesOpen(false)}
                            className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-bold text-primary hover:bg-primary/10 transition-colors"
                          >
                            <span>All {cat.name}</span>
                            <ChevronRight className="size-3.5" />
                          </Link>

                          {cat.children.map((child, idx) => {
                            const childName = typeof child === "object" ? child.name || child.slug : child;
                            const childSlug = typeof child === "object" ? child.slug || child.name : child;
                            const childImage = typeof child === "object" ? child.image : null;

                            return (
                              <Link
                                key={idx}
                                href={`/products?category=${encodeURIComponent(childSlug)}`}
                                onClick={() => setCategoriesOpen(false)}
                                className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-foreground hover:bg-muted hover:text-primary transition-colors"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {childImage ? (
                                    <img
                                      src={childImage}
                                      alt={childName}
                                      className="size-6 rounded-md object-cover border border-border/40 shrink-0"
                                    />
                                  ) : (
                                    <span className="size-1.5 rounded-full bg-primary/70 shrink-0 ml-1" />
                                  )}
                                  <span className="truncate">{childName}</span>
                                </div>
                                <ChevronRight className="size-3 text-muted-foreground/60 shrink-0" />
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </aside>
        </div>
      )}

      {/* ----------------------------------------------------------------------- */}
      {/* ADMIN MORE QUICK SIDEBAR DRAWER (SLIDES IN FROM LEFT)                   */}
      {/* ----------------------------------------------------------------------- */}
      {isAdminRoute && adminMoreOpen && (
        <div
          className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={() => setAdminMoreOpen(false)}
        >
          <aside
            className="fixed inset-y-0 left-0 z-[9999] flex w-80 max-w-[85vw] flex-col bg-card shadow-2xl border-r border-border/80 animate-in slide-in-from-left-full duration-300 ease-out"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-border/80 p-4 bg-muted/30">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <SlidersHorizontal className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Admin Menu</h3>
                  <p className="text-[10px] text-muted-foreground">Quick management options</p>
                </div>
              </div>
              <button
                onClick={() => setAdminMoreOpen(false)}
                className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <Link
                href="/dashboard/banners"
                onClick={() => setAdminMoreOpen(false)}
                className="group flex items-center justify-between rounded-xl border border-border/80 bg-background/60 p-3 transition-all hover:border-primary/50 hover:bg-muted/40"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ImageIcon className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Banners & Sliders</p>
                    <p className="text-[10px] text-muted-foreground">Manage homepage sliders</p>
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground/70 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                href="/dashboard/settings"
                onClick={() => setAdminMoreOpen(false)}
                className="group flex items-center justify-between rounded-xl border border-border/80 bg-background/60 p-3 transition-all hover:border-primary/50 hover:bg-muted/40"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Settings className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Store Settings</p>
                    <p className="text-[10px] text-muted-foreground">General configuration</p>
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground/70 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                href="/dashboard/profile"
                onClick={() => setAdminMoreOpen(false)}
                className="group flex items-center justify-between rounded-xl border border-border/80 bg-background/60 p-3 transition-all hover:border-primary/50 hover:bg-muted/40"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <User className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Admin Profile</p>
                    <p className="text-[10px] text-muted-foreground">Account details</p>
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground/70 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                href="/"
                onClick={() => setAdminMoreOpen(false)}
                className="group flex items-center justify-between rounded-xl border border-border/80 bg-background/60 p-3 transition-all hover:border-emerald-500/50 hover:bg-muted/40"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                    <Home className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Store Front</p>
                    <p className="text-[10px] text-muted-foreground">Visit live store</p>
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground/70 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            {/* Admin Footer */}
            {user && (
              <div className="p-4 border-t border-border bg-muted/20">
                <button
                  onClick={async () => {
                    setAdminMoreOpen(false);
                    await logout();
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 py-2.5 text-xs font-bold text-red-500 hover:bg-red-500/20 transition-colors cursor-pointer"
                >
                  <LogOut className="size-4" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* ----------------------------------------------------------------------- */}
      {/* ULTRA-PREMIUM FIXED BOTTOM NAVBAR FOR MOBILE & TABLET                    */}
      {/* ----------------------------------------------------------------------- */}
      <nav
        aria-label="Bottom Navigation"
        className="fixed bottom-0 left-0 right-0 z-[9990] block border-t border-border/80 bg-background/95 backdrop-blur-xl shadow-[0_-8px_30px_rgba(0,0,0,0.1)] lg:hidden"
      >
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-around px-2 sm:px-6">
          {currentNavItems.map((item) => {
            const Icon = item.icon;
            const content = (
              <div className="relative flex flex-col items-center justify-center py-1 transition-all">
                {/* Icon Container with active pill highlight */}
                <div
                  className={`relative flex items-center justify-center rounded-full px-3 py-1 transition-all duration-300 ${
                    item.isActive
                      ? "bg-primary/15 text-primary scale-105 shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="size-5 shrink-0 transition-transform" />
                  {item.badge !== null && item.badge !== undefined && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-extrabold text-primary-foreground shadow-sm animate-in zoom-in-75">
                      {item.badge}
                    </span>
                  )}
                </div>

                {/* Text Label */}
                <span
                  className={`mt-0.5 text-[10px] sm:text-[11px] font-semibold tracking-tight transition-colors ${
                    item.isActive
                      ? "font-bold text-primary"
                      : "text-muted-foreground group-hover:text-foreground"
                  }`}
                >
                  {item.label}
                </span>

                {/* Active Indicator Line */}
                {item.isActive && (
                  <span className="absolute -bottom-1 h-1 w-5 rounded-full bg-primary animate-in zoom-in-50 duration-200" />
                )}
              </div>
            );

            if (item.onClick) {
              return (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className="group flex flex-1 flex-col items-center justify-center py-1 cursor-pointer outline-none active:scale-95 transition-transform"
                >
                  {content}
                </button>
              );
            }

            return (
              <Link
                key={item.id}
                href={item.href}
                className="group flex flex-1 flex-col items-center justify-center py-1 outline-none active:scale-95 transition-transform"
              >
                {content}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
