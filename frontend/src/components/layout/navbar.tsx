"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useAuth } from "@/components/providers/auth-provider";
import { cn } from "@/lib/utils";

const primaryLinks = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/advisor", label: "Advisor" },
  { href: "/analytics", label: "Analytics" },
] satisfies Array<{ href: Route; label: string }>;

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { hydrated, isAuthenticated, logout, user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setMobileOpen(false);
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--border)] bg-[color:var(--nav-bg)]/90 backdrop-blur-xl">
      <div className="grid-shell py-4">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--brand)] text-[color:var(--brand-contrast)] shadow-[0_12px_30px_rgba(30,89,255,0.25)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-xl tracking-tight">WealthFlow X AI</p>
              <p className="text-xs text-muted">Smart money operating system</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 lg:flex">
            {primaryLinks.map((link) => (
              <Link key={link.href} href={link.href} className={cn("nav-link", pathname === link.href && "nav-link-active")}>
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <ThemeToggle />
            {hydrated && isAuthenticated ? (
              <>
                <div className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm text-muted">
                  {user?.first_name ? `Hi, ${user.first_name}` : user?.email}
                </div>
                <button type="button" onClick={handleLogout} className="button-ghost">
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="button-ghost">
                  Log in
                </Link>
                <Link href="/signup" className="button-primary">
                  Sign up
                </Link>
              </>
            )}
          </div>

          <button type="button" onClick={() => setMobileOpen((value) => !value)} className="button-secondary lg:hidden" aria-label="Toggle navigation">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen ? (
          <div className="mt-4 space-y-3 rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface-elevated)] p-4 lg:hidden">
            <nav className="flex flex-col gap-2">
              {primaryLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn("nav-link justify-start", pathname === link.href && "nav-link-active")}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="flex flex-col gap-2 border-t border-[color:var(--border)] pt-3">
              <ThemeToggle className="justify-center" />
              {hydrated && isAuthenticated ? (
                <>
                  <div className="rounded-2xl border border-[color:var(--border)] px-4 py-3 text-sm text-muted">
                    Signed in as {user?.email}
                  </div>
                  <button type="button" onClick={handleLogout} className="button-ghost justify-center">
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="button-ghost justify-center" onClick={() => setMobileOpen(false)}>
                    Log in
                  </Link>
                  <Link href="/signup" className="button-primary justify-center" onClick={() => setMobileOpen(false)}>
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
