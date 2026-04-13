"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <main className="grid-shell flex flex-col gap-6 py-6 lg:flex-row lg:py-8">
        <Sidebar />
        <section className="min-w-0 flex-1 pb-8">
          <Topbar title={title} subtitle={subtitle} />
          {children}
        </section>
      </main>
    </AuthGuard>
  );
}
