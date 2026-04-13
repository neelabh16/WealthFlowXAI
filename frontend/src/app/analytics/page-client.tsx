"use client";

import { WealthLineChart } from "@/components/charts/line-chart";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/shared/card";
import { QueryState } from "@/components/shared/query-state";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { formatCurrency, titleCase } from "@/lib/formatters";
import type { AnalyticsResponse } from "@/types";

export default function AnalyticsPageClient() {
  const { data, error, loading } = useAuthedQuery<AnalyticsResponse>("/finance/analytics/");

  return (
    <AppShell title="Analytics" subtitle="Live trends for spending, redirected wealth, category leaks, and growth-score drivers.">
      {loading ? <QueryState title="Loading analytics" message="Crunching spending trends, category signals, and growth history." /> : null}
      {error ? <QueryState title="Analytics unavailable" message={error} /> : null}
      {!data ? null : (
        <div className="grid gap-6">
          <Card>
            <p className="text-sm text-subtle">Spending vs redirected wealth</p>
            <div className="mt-4">
              <WealthLineChart data={data.monthly_spend.map((point) => ({ label: point.month, value: point.redirected || point.spend }))} />
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <Card>
              <p className="text-sm text-subtle">Category breakdown</p>
              <div className="mt-4 space-y-4">
                {data.category_breakdown.map((item) => (
                  <div key={item.category} className="surface-panel flex items-center justify-between p-4">
                    <p className="font-semibold text-[color:var(--text-strong)]">{titleCase(item.category)}</p>
                    <p className="text-[color:var(--brand)]">{formatCurrency(item.value)}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <p className="text-sm text-subtle">Growth insights</p>
              <div className="mt-4 space-y-4">
                {data.insights.map((insight) => (
                  <div key={insight} className="surface-card p-4 text-sm leading-7 text-[color:var(--text-strong)]">
                    {insight}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}
