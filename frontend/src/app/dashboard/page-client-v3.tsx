"use client";

import { DailyCheckIn } from "@/components/finance/daily-check-in";
import { WealthSweepControlV2 } from "@/components/finance/wealth-sweep-control-v2";
import { PortfolioDonut } from "@/components/charts/donut-chart";
import { WealthLineChart } from "@/components/charts/line-chart";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/shared/card";
import { QueryState } from "@/components/shared/query-state";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { formatCurrency, formatPercent, titleCase } from "@/lib/formatters";
import type { DashboardResponse } from "@/types";

export default function DashboardPageClientV3() {
  const { data, error, loading, refetch } = useAuthedQuery<DashboardResponse>("/finance/dashboard/");

  const contributionByTransaction = new Map(
    (data?.wealth_contributions ?? [])
      .filter((item) => item.transaction)
      .map((item) => [item.transaction, item]),
  );

  const contributionSeries = data?.wealth_contributions.length
    ? data.wealth_contributions
        .slice()
        .reverse()
        .map((item, index) => ({
          label: `C${index + 1}`,
          value: Number(item.funded_amount !== "0.00" ? item.funded_amount : item.planned_amount),
        }))
    : data?.empowerment_allocations
        .slice()
        .reverse()
        .map((item, index) => ({
          label: `S${index + 1}`,
          value: Number(item.round_up_amount),
        })) ?? [];

  const summaryCards = data
    ? [
        {
          title: "Growth Score",
          value: `${Math.round(data.summary.growth_score)}/100`,
          delta: `${Math.round(data.summary.budgeting_score)} budgeting score`,
        },
        {
          title: "Funded Wealth From Spend",
          value: formatCurrency(data.summary.redirected_value),
          delta: `${data.summary.redirected_event_count} funded sweep actions`,
          breakdown: `Invest ${formatCurrency(data.summary.redirected_investment_value)} / Save ${formatCurrency(data.summary.redirected_savings_value)} / Goals ${formatCurrency(data.summary.redirected_goal_value)}`,
        },
        {
          title: "Pending Sweeps",
          value: formatCurrency(data.summary.pending_contribution_value),
          delta: `${data.summary.pending_contribution_count} waiting for funding`,
        },
        {
          title: "Monthly Surplus",
          value: formatCurrency(data.summary.monthly_savings),
          delta: `${data.summary.emergency_months} emergency months`,
        },
      ]
    : [];

  return (
    <AppShell
      title="Financial Command Center"
      subtitle="Track real round-ups, real cashback routing, budgeting signals, and the growth loop that replaces one-off rewards."
    >
      {loading ? <QueryState title="Loading dashboard" message="Pulling your funded contributions, latest strategy suggestions, and saving triggers." /> : null}
      {error ? <QueryState title="Dashboard unavailable" message={error} /> : null}
      {!data ? null : (
        <>
          <DailyCheckIn onSubmitted={refetch} />

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <Card key={card.title} className="h-full min-h-[172px]">
                <p className="text-sm text-subtle">{card.title}</p>
                <p className="mt-4 font-display text-3xl text-[color:var(--text-strong)]">{card.value}</p>
                <p className="mt-2 text-sm text-[color:var(--brand)]">{card.delta}</p>
                {"breakdown" in card ? <p className="mt-2 text-xs leading-6 text-muted">{card.breakdown}</p> : null}
              </Card>
            ))}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
            <Card className="h-full">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-subtle">Real wealth routing</p>
                  <h2 className="font-display text-2xl text-[color:var(--text-strong)]">Funded sweeps over time</h2>
                </div>
                <p className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-3 py-1 text-xs text-[color:var(--brand)]">
                  Goal velocity {formatPercent(data.summary.goal_velocity)}
                </p>
              </div>
              <WealthLineChart data={contributionSeries} />
            </Card>

            <Card className="h-full">
              <p className="text-sm text-subtle">Portfolio Mix</p>
              <h2 className="font-display text-2xl text-[color:var(--text-strong)]">Where funded money is currently parked</h2>
              <PortfolioDonut data={data.portfolio_mix.map((item) => ({ label: titleCase(item.name), value: item.value }))} />
              <p className="mt-4 text-sm leading-7 text-muted">
                Portfolio value only moves when contributions are funded. Strategy recommendations alone do not change balances.
              </p>
            </Card>
          </div>

          <div className="mt-6">
            <WealthSweepControlV2 rule={data.sweep_rule} contributions={data.wealth_contributions} onChanged={refetch} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.92fr]">
            <Card className="h-full">
              <p className="text-sm text-subtle">Spend strategy recommendations</p>
              <p className="mt-2 text-sm leading-7 text-muted">
                These are advisory routes for your latest expenses. They explain the best next move, but your actual balances only change after the matching sweep is funded.
              </p>
              <div className="mt-4 space-y-4">
                {data.empowerment_allocations.length ? (
                  data.empowerment_allocations.map((allocation) => {
                    const contribution = contributionByTransaction.get(allocation.transaction);
                    const candidateAmount = contribution
                      ? contribution.funded_amount !== "0.00"
                        ? contribution.funded_amount
                        : contribution.planned_amount
                      : allocation.round_up_amount;
                    const hasRealSweep = Number(candidateAmount) > 0;

                    return (
                      <div key={allocation.id} className="surface-panel flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <p className="font-semibold text-[color:var(--text-strong)]">{allocation.transaction_merchant}</p>
                          <p className="text-sm text-subtle">{allocation.strategy_name}</p>
                          {allocation.metadata?.selection_reason ? <p className="mt-2 max-w-md text-xs leading-6 text-muted">{allocation.metadata.selection_reason}</p> : null}
                        </div>
                        <div className="text-left lg:max-w-[15rem] lg:text-right">
                          <p className="font-semibold text-[color:var(--text-strong)]">{hasRealSweep ? formatCurrency(candidateAmount) : "No sweep"}</p>
                          <p className="text-sm text-[color:var(--brand)]">
                            {hasRealSweep
                              ? contribution
                                ? `${contribution.status === "mock_funded" ? "Funded" : contribution.status === "funded" ? "Funded" : "Real"} ${contribution.source_type.replace("_", " ")}`
                                : "Real sweep candidate from this spend"
                              : "No real sweep captured for this older spend"}
                          </p>
                          <p className="mt-2 text-xs leading-6 text-muted">
                            Suggested split: {formatCurrency(allocation.investment_amount)} invest / {formatCurrency(allocation.savings_amount)} save / {formatCurrency(allocation.goal_boost_amount)} goals
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="surface-panel px-4 py-5 text-sm text-muted">
                    No advisory routes yet. Log a transaction and the app will suggest the best wealth path for it.
                  </div>
                )}
              </div>
            </Card>

            <Card className="h-full">
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
            <Card className="h-full">
              <p className="text-sm text-subtle">Wealth milestones</p>
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

            <Card className="h-full">
              <p className="text-sm text-subtle">Why retention becomes intrinsic</p>
              <div className="mt-4 space-y-4">
                {data.growth_snapshot.summary.drivers?.map((driver) => (
                  <div key={driver} className="surface-card p-4 text-sm leading-7 text-[color:var(--text-strong)]">
                    {driver}
                  </div>
                ))}
                <div className="surface-panel p-4">
                  <p className="font-semibold text-[color:var(--text-strong)]">Live trust loop</p>
                  <p className="mt-2 text-sm leading-7 text-muted">
                    Spending reveals where money leaks. Round-ups and real cashback fund investments, emergency savings, and goals. The habit loop becomes visible wealth progress instead of temporary cashback.
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
