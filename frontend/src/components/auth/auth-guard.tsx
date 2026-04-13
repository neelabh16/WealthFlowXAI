"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { hydrated, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!hydrated || isAuthenticated) {
      return;
    }

    router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [hydrated, isAuthenticated, pathname, router]);

  if (!hydrated || !isAuthenticated) {
    return (
      <div className="grid-shell py-20">
        <div className="glass-card mx-auto max-w-xl p-10 text-center">
          <p className="eyebrow justify-center">Secure area</p>
          <h1 className="mt-4 font-display text-3xl text-[color:var(--text-strong)]">Loading your account access…</h1>
          <p className="mt-3 text-sm text-muted">You’ll be redirected to log in if there isn’t an active session.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
