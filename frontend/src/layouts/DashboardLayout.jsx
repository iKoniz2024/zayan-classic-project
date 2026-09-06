"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/views/sharedPages/Sidebar";
import { useRouter } from "next/navigation";
import { Sun, Moon, Menu } from "lucide-react";
import useTheme from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";

export default function DashboardLayout({ children }) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex h-screen flex-col bg-muted/20">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex size-9 items-center justify-center rounded-md border transition-colors hover:bg-muted lg:hidden"
          title="Open menu"
        >
          <Menu className="size-4" />
        </button>
        <div />
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="flex size-9 items-center justify-center rounded-md border transition-colors hover:bg-muted"
            title={mounted && theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {mounted && theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>

          {user && (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex size-9 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground transition-opacity hover:opacity-90"
              >
                {user?.name?.charAt(0).toUpperCase()}
              </button>

              {dropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setDropdownOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-xl border border-border bg-card p-1.5 shadow-lg">
                    <div className="px-3 py-2 border-b border-border mb-1">
                      <p className="text-sm font-semibold text-foreground truncate">{user?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        router.push("/dashboard/profile");
                      }}
                      className="flex w-full items-center rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                    >
                      Profile
                    </button>
                    <button
                      onClick={async () => {
                        setDropdownOpen(false);
                        await logout();
                        router.push("/login");
                      }}
                      className="flex w-full items-center rounded-md px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-900/10"
                    >
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
