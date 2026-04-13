"use client";

import type { Route } from "next";
import { useEffect, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { apiRequest } from "@/lib/api";
import type { InsightSearchResult } from "@/types";

export function Topbar({ title, subtitle }: { title: string; subtitle: string }) {
  const router = useRouter();
  const { user, session } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InsightSearchResult[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;

    if (!session?.accessToken || query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        const payload = await apiRequest<{ query: string; results: InsightSearchResult[] }>(`/ai/search-insights/?q=${encodeURIComponent(query)}`, {
          method: "GET",
          token: session.accessToken,
        });
        if (active) {
          setResults(payload.results);
          setOpen(true);
        }
      } catch {
        if (active) {
          setResults([]);
        }
      }
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [query, session?.accessToken]);

  return (
    <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.26em] text-subtle">{user?.preferred_currency ?? "INR"} profile</p>
        <h1 className="mt-2 font-display text-4xl text-[color:var(--text-strong)]">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">{subtitle}</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:justify-end">
        <div className="relative max-w-full">
          <div className="flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-2 text-sm text-muted">
            <Search className="h-4 w-4" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setOpen(true)}
              placeholder="Search insights"
              className="w-full min-w-0 bg-transparent text-sm text-[color:var(--text-strong)] outline-none placeholder:text-muted sm:w-52"
            />
          </div>
          {open && query.trim().length >= 2 ? (
            <div className="absolute right-0 z-30 mt-3 w-[min(22rem,calc(100vw-2rem))] rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface-elevated)] p-3 shadow-[0_20px_60px_rgba(0,0,0,0.24)]">
              {results.length ? (
                <div className="space-y-2">
                  {results.map((result, index) => (
                    <button
                      key={`${result.title}-${index}`}
                      type="button"
                      className="block w-full rounded-2xl border border-transparent bg-[color:var(--surface-strong)] px-4 py-3 text-left transition hover:border-[color:var(--border)]"
                      onClick={() => {
                        setOpen(false);
                        setQuery("");
                        router.push(result.route as Route);
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-[color:var(--text-strong)]">{result.title}</p>
                        <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--brand)]">{result.source_type}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{result.body}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl bg-[color:var(--surface-strong)] px-4 py-3 text-sm text-muted">No matching insights yet.</div>
              )}
            </div>
          ) : null}
        </div>
        <div className="whitespace-nowrap rounded-full border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-2 text-sm text-[color:var(--brand)]">
          <Sparkles className="mr-2 inline h-4 w-4" />
          AI Auto Pilot On
        </div>
      </div>
    </div>
  );
}
