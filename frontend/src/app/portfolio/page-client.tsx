"use client";

import { FormEvent, useState } from "react";
import { PortfolioDonut } from "@/components/charts/donut-chart";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/components/providers/auth-provider";
import { Card } from "@/components/shared/card";
import { QueryState } from "@/components/shared/query-state";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { apiRequest } from "@/lib/api";
import { formatCurrency, formatPercent, titleCase } from "@/lib/formatters";
import type { DashboardResponse, InvestmentRecord } from "@/types";

export default function PortfolioPageClient() {
  const { session } = useAuth();
  const investments = useAuthedQuery<InvestmentRecord[]>("/finance/investments/");
  const dashboard = useAuthedQuery<DashboardResponse>("/finance/dashboard/");
  const loading = investments.loading || dashboard.loading;
  const error = investments.error || dashboard.error;
  const [form, setForm] = useState({
    asset_name: "",
    asset_type: "savings",
    allocated_amount: "",
    current_value: "",
    roi_percentage: "4",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleAddHolding = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session?.accessToken) {
      setSubmitError("Please log in again before adding an asset.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      await apiRequest("/finance/investments/", {
        method: "POST",
        token: session.accessToken,
        body: {
          ...form,
          current_value: form.current_value || form.allocated_amount,
        },
      });
      setForm({
        asset_name: "",
        asset_type: "savings",
        allocated_amount: "",
        current_value: "",
        roi_percentage: "4",
      });
      await Promise.all([investments.refetch(), dashboard.refetch()]);
    } catch (submissionError) {
      setSubmitError(submissionError instanceof Error ? submissionError.message : "Unable to add the investment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell title="Investment Portfolio" subtitle="Auto-invest redirection now fuels real portfolio buckets instead of passive cashback.">
      {loading ? <QueryState title="Loading portfolio" message="Aggregating your live investment positions and asset mix." /> : null}
      {error ? <QueryState title="Portfolio unavailable" message={error} /> : null}
      {!investments.data || !dashboard.data ? null : (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="grid gap-6">
            <Card>
              <p className="text-sm text-subtle">Allocation by asset</p>
              <PortfolioDonut data={dashboard.data.portfolio_mix.map((item) => ({ label: titleCase(item.name), value: item.value }))} />
            </Card>
            <Card>
              <p className="text-sm text-subtle">Add or top up an asset</p>
              <h2 className="mt-2 font-display text-2xl text-[color:var(--text-strong)]">Manual savings and long-term holdings belong here</h2>
              <form onSubmit={handleAddHolding} className="mt-5 grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="field-label md:col-span-2">
                    Asset name
                    <input className="input-field" value={form.asset_name} onChange={(event) => setForm((current) => ({ ...current, asset_name: event.target.value }))} placeholder="Emergency Shield Wallet, Nifty Index Basket..." required />
                  </label>
                  <label className="field-label">
                    Asset type
                    <select className="input-field" value={form.asset_type} onChange={(event) => setForm((current) => ({ ...current, asset_type: event.target.value }))}>
                      <option value="stock">Stock</option>
                      <option value="mutual_fund">Mutual fund</option>
                      <option value="savings">Savings</option>
                      <option value="esg">ESG</option>
                    </select>
                  </label>
                  <label className="field-label">
                    Allocated amount
                    <input className="input-field" type="number" min="0" step="0.01" value={form.allocated_amount} onChange={(event) => setForm((current) => ({ ...current, allocated_amount: event.target.value }))} required />
                  </label>
                  <label className="field-label">
                    Current value
                    <input className="input-field" type="number" min="0" step="0.01" value={form.current_value} onChange={(event) => setForm((current) => ({ ...current, current_value: event.target.value }))} />
                  </label>
                  <label className="field-label">
                    ROI %
                    <input className="input-field" type="number" step="0.1" value={form.roi_percentage} onChange={(event) => setForm((current) => ({ ...current, roi_percentage: event.target.value }))} />
                  </label>
                </div>
                {submitError ? <p className="rounded-2xl border border-[color:var(--danger-soft)] bg-[color:var(--danger-bg)] px-4 py-3 text-sm text-[color:var(--danger-text)]">{submitError}</p> : null}
                <div className="flex justify-end">
                  <button type="submit" disabled={submitting} className="button-primary">
                    {submitting ? "Saving asset..." : "Add asset"}
                  </button>
                </div>
              </form>
            </Card>
          </div>
          <Card>
            <div className="space-y-4">
              {investments.data.map((investment) => (
                <div key={investment.id} className="surface-panel p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[color:var(--text-strong)]">{investment.asset_name}</p>
                      <p className="text-sm text-subtle">{titleCase(investment.asset_type)}</p>
                    </div>
                    <p className="text-[color:var(--brand)]">{formatPercent(investment.roi_percentage)}</p>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <p className="text-sm text-muted">Allocated {formatCurrency(investment.allocated_amount)}</p>
                    <p className="text-sm text-muted">Current {formatCurrency(investment.current_value)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
