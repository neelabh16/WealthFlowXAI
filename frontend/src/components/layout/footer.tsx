"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

const footerLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/advisor", label: "AI Advisor" },
  { href: "/goals", label: "Goals" },
] satisfies Array<{ href: Route; label: string }>;

export function Footer() {
  const pathname = usePathname();
  const showMarketingFooter = pathname === "/" || pathname === "/login" || pathname === "/signup";

  if (!showMarketingFooter) {
    return null;
  }

  return (
    <footer className="border-t border-[color:var(--border)] bg-[color:var(--footer-bg)]">
      <div className="grid-shell py-10">
        <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-end">
          <div>
            <p className="eyebrow">Built for modern wealth creation</p>
            <h2 className="mt-3 font-display text-3xl text-[color:var(--text-strong)] sm:text-4xl">
              Clean decisions, calmer dashboards, and automation that feels human.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
              WealthFlow X AI blends goal planning, AI guidance, analytics, and smart finance controls into one polished experience.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 md:justify-end">
            {footerLinks.map((link) => (
              <Link key={link.href} href={link.href} className="button-ghost">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
