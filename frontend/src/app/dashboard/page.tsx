export { default } from "./page-client-v3"; /*

import { PortfolioDonut } from "@/components/charts/donut-chart";
import { WealthLineChart } from "@/components/charts/line-chart";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/shared/card";
import { QueryState } from "@/components/shared/query-state";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { formatCurrency, formatPercent, titleCase } from "@/lib/formatters";
import type { DashboardResponse } from "@/types";

export default function DashboardPage() {
  const { data, error, loading } = useAuthedQuery<DashboardResponse>("/finance/dashboard/");

  const summaryCards = data
    ? [
        { title: "Growth Score", value: `${Math.round(data.summary.growth_score)}/100`, delta: `${Math.round(data.summary.budgeting_score)} budgeting score` },
        { title: "Redirected Wealth", value: formatCurrency(data.summary.redirected_value), delta: `${data.summary.active_trigger_count} active saving triggers` },
        { title: "Portfolio Value", value: formatCurrency(data.summary.portfolio_value), delta: `${data.summary.milestones_unlocked} milestones unlocked` },
        { title: "Monthly Savings", value: formatCurrency(data.summary.monthly_savings), delta: `${data.summary.emergency_months} emergency months` },
      ]
    : [];

  return (
    <AppShell title="Financial Command Center" subtitle="A live operating view of your wealth, behavior, risk posture, and AI automations.">
      {loading ? <QueryState title="Loading dashboard" message="Pulling your live growth score, empowerment actions, and smart saving triggers." /> : null}
      {error ? <QueryState title="Dashboard unavailable" message={error} /> : null}
      {!data ? null : (
        <>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <Card key={card.title}>
              <p className="text-sm text-subtle">{card.title}</p>
              <p className="mt-4 font-display text-3xl text-[color:var(--text-strong)]">{card.value}</p>
              <p className="mt-2 text-sm text-[color:var(--brand)]">{card.delta}</p>
            </Card>
          ))}
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
          <Card>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-subtle">Savings Growth</p>
                <h2 className="font-display text-2xl text-[color:var(--text-strong)]">AI-predicted cash trajectory</h2>
              </div>
              <p className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-3 py-1 text-xs text-[color:var(--brand)]">+19% ahead of plan</p>
            </div>
            <WealthLineChart data={savingsTrend} />
          </Card>
          <Card>
            <p className="text-sm text-subtle">Portfolio Mix</p>
            <h2 className="font-display text-2xl text-[color:var(--text-strong)]">Autonomous allocation engine</h2>
            <PortfolioDonut data={portfolioMix} />
          </Card>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <Card>
            <p className="text-sm text-subtle">Recent transactions</p>
            <div className="mt-4 space-y-4">
              {transactionRows.map((row) => (
                <div key={row.merchant} className="surface-panel flex items-center justify-between px-4 py-4">
                  <div>
                    <p className="font-semibold text-[color:var(--text-strong)]">{row.merchant}</p>
                    <p className="text-sm text-subtle">{row.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[color:var(--text-strong)]">{row.amount}</p>
                    <p className="text-sm text-[color:var(--brand)]">{row.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <p className="text-sm text-subtle">AI highlights</p>
            <div className="mt-4 space-y-4">
              {[
                "Overspending alert: dining is 23% above your healthy range.",
                "Goal planner suggests raising your SIP by ₹3,500 to hit travel target sooner.",
                "Your money personality score is strongest on weekdays; weekends need tighter nudges.",
              ].map((item) => (
                <div key={item} className="surface-card p-4 text-sm leading-7 text-[color:var(--text-strong)]">
                  {item}
                </div>
              ))}
            </div>
          </Card>
        </div>
    </AppShell>
  );
} */
