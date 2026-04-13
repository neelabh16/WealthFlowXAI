"use client";

import { DailyCheckIn } from "@/components/finance/daily-check-in";
import { PortfolioDonut } from "@/components/charts/donut-chart";
import { WealthLineChart } from "@/components/charts/line-chart";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/shared/card";
import { QueryState } from "@/components/shared/query-state";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { formatCurrency, formatPercent, titleCase } from "@/lib/formatters";
import type { DashboardResponse } from "@/types";

export default function DashboardPageClient() {
  const { data, error, loading, refetch } = useAuthedQuery<DashboardResponse>("/finance/dashboard/");

  const summaryCards = data
    ? [
        { title: "Growth Score", value: `${Math.round(data.summary.growth_score)}/100`, delta: `${Math.round(data.summary.budgeting_score)} budgeting score` },
        {
          title: "Cashback Replacement Value",
          value: formatCurrency(data.summary.redirected_value),
          delta: `${data.summary.redirected_event_count} spend-to-wealth actions`,
          breakdown: `Invest ${formatCurrency(data.summary.redirected_investment_value)} · Save ${formatCurrency(data.summary.redirected_savings_value)} · Goals ${formatCurrency(data.summary.redirected_goal_value)}`,
        },
        { title: "Portfolio Value", value: formatCurrency(data.summary.portfolio_value), delta: `${data.summary.milestones_unlocked} milestones unlocked` },
        { title: "Monthly Surplus", value: formatCurrency(data.summary.monthly_savings), delta: `${data.summary.emergency_months} emergency months` },
      ]
    : [];

  return (
    <AppShell title="Financial Command Center" subtitle="A live operating view of your wealth, behavior, risk posture, and AI automations.">
      {loading ? <QueryState title="Loading dashboard" message="Pulling your live growth score, empowerment actions, and smart saving triggers." /> : null}
      {error ? <QueryState title="Dashboard unavailable" message={error} /> : null}
      {!data ? null : (
        <>
          <DailyCheckIn onSubmitted={refetch} />

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <Card key={card.title}>
                <p className="text-sm text-subtle">{card.title}</p>
                <p className="mt-4 font-display text-3xl text-[color:var(--text-strong)]">{card.value}</p>
                <p className="mt-2 text-sm text-[color:var(--brand)]">{card.delta}</p>
                {"breakdown" in card ? <p className="mt-2 text-xs leading-6 text-muted">{card.breakdown}</p> : null}
              </Card>
            ))}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
            <Card>
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-sm text-subtle">Financial growth score</p>
                  <h2 className="font-display text-2xl text-[color:var(--text-strong)]">Behavior compounds into wealth</h2>
                </div>
                <p className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-3 py-1 text-xs text-[color:var(--brand)]">
                  Goal velocity {formatPercent(data.summary.goal_velocity)}
                </p>
              </div>
              <WealthLineChart data={data.empowerment_allocations.map((item, index) => ({ label: `T${index + 1}`, value: Number(item.redirected_amount) }))} />
            </Card>
            <Card>
              <p className="text-sm text-subtle">Portfolio Mix</p>
              <h2 className="font-display text-2xl text-[color:var(--text-strong)]">Autonomous allocation engine</h2>
              <PortfolioDonut data={data.portfolio_mix.map((item) => ({ label: titleCase(item.name), value: item.value }))} />
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <Card>
              <p className="text-sm text-subtle">Auto micro-invest replacement</p>
              <div className="mt-4 space-y-4">
                {data.empowerment_allocations.map((allocation) => (
                  <div key={allocation.id} className="surface-panel flex items-center justify-between px-4 py-4">
                    <div>
                      <p className="font-semibold text-[color:var(--text-strong)]">{allocation.transaction_merchant}</p>
                      <p className="text-sm text-subtle">{allocation.strategy_name}</p>
                      {allocation.metadata?.selection_reason ? <p className="mt-2 max-w-md text-xs leading-6 text-muted">{allocation.metadata.selection_reason}</p> : null}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-[color:var(--text-strong)]">{formatCurrency(allocation.redirected_amount)}</p>
                      <p className="text-sm text-[color:var(--brand)]">
                        {formatCurrency(allocation.investment_amount)} invest / {formatCurrency(allocation.goal_boost_amount)} goal
                      </p>
                      {allocation.metadata?.strategy_options && allocation.metadata.strategy_options.length > 1 ? (
                        <p className="mt-2 text-xs text-muted">Backups: {allocation.metadata.strategy_options.slice(1).map((option) => option.title).join(", ")}</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <p className="text-sm text-subtle">Smart saving triggers</p>
              <div className="mt-4 space-y-4">
                {data.smart_saving_triggers.map((trigger) => (
                  <div key={trigger.id} className="surface-card p-4 text-sm leading-7 text-[color:var(--text-strong)]">
                    <p className="font-semibold">{trigger.title}</p>
                    <p className="mt-2 text-muted">{trigger.description}</p>
                    <p className="mt-3 text-[color:var(--brand)]">
                      Save {formatCurrency(trigger.recommended_amount)} now, impact {formatCurrency(trigger.monthly_impact)} monthly
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <Card>
              <p className="text-sm text-subtle">Gamified wealth milestones</p>
              <div className="mt-4 space-y-4">
                {data.wealth_milestones.map((milestone) => (
                  <div key={milestone.id} className="surface-panel p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-[color:var(--text-strong)]">{milestone.title}</p>
                        <p className="mt-1 text-sm text-muted">{milestone.description}</p>
                      </div>
                      <span className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs uppercase tracking-[0.2em] text-[color:var(--brand)]">
                        {milestone.status}
                      </span>
                    </div>
                    <div className="mt-4 h-3 rounded-full bg-[color:var(--surface-strong)]">
                      <div className="h-3 rounded-full bg-gradient-to-r from-mint to-ocean" style={{ width: `${Math.min(milestone.progress_percentage, 100)}%` }} />
                    </div>
                    <p className="mt-3 text-sm text-muted">{milestone.celebration_copy || `Current progress ${formatPercent(milestone.progress_percentage)}`}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <p className="text-sm text-subtle">Why retention becomes intrinsic</p>
              <div className="mt-4 space-y-4">
                {data.growth_snapshot.summary.drivers?.map((driver) => (
                  <div key={driver} className="surface-card p-4 text-sm leading-7 text-[color:var(--text-strong)]">
                    {driver}
                  </div>
                ))}
                <div className="surface-panel p-4">
                  <p className="font-semibold text-[color:var(--text-strong)]">Live behavioral loop</p>
                  <p className="mt-2 text-sm text-muted">
                    Spend events now create investment allocation, emergency savings, goal progress, and visible score movement instead of one-off cashback.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </AppShell>
  );
}
