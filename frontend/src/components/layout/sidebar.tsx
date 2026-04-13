"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Bot, ChartPie, CircleDollarSign, Goal, LayoutDashboard, LogOut, ShieldCheck, Wallet } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: Wallet },
  { href: "/portfolio", label: "Portfolio", icon: CircleDollarSign },
  { href: "/goals", label: "Goals", icon: Goal },
  { href: "/advisor", label: "AI Advisor", icon: Bot },
  { href: "/analytics", label: "Analytics", icon: ChartPie },
  { href: "/notifications", label: "Notifications", icon: Bell },
] satisfies Array<{ href: Route; label: string; icon: typeof LayoutDashboard }>;

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <aside className="glass-card sticky top-24 hidden max-h-[calc(100vh-7rem)] w-72 flex-col overflow-y-auto p-5 lg:flex">
      <div className="flex min-h-full flex-col">
        <div className="mb-10">
          <p className="font-display text-2xl text-[color:var(--text-strong)]">WEALTHFLOW X AI</p>
          <p className="mt-2 text-sm text-muted">Intelligent wealth operating system</p>
        </div>
        <nav className="space-y-2">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn("flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition", pathname === item.href ? "bg-[color:var(--surface-strong)] text-[color:var(--text-strong)]" : "text-muted hover:bg-[color:var(--surface-strong)] hover:text-[color:var(--text-strong)]")}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto pt-6">
          <div className="space-y-4 rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-4">
            <div className="mb-3 flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-[color:var(--brand)]" />
              <div>
                <p className="font-semibold text-[color:var(--text-strong)]">{user?.first_name ? `${user.first_name} ${user.last_name}`.trim() : "Investor Pro"}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-subtle">{user?.role ?? "user"}</p>
              </div>
            </div>
            <p className="text-sm text-muted">Your trust loop is real progress: stronger buffers, funded goals, and long-term rewards.</p>
            <button
              type="button"
              onClick={() => {
                logout();
                router.push("/");
              }}
              className="button-ghost w-full justify-center"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
