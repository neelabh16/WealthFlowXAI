"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { Card } from "@/components/shared/card";
import { apiRequest } from "@/lib/api";
import { formatCurrency } from "@/lib/formatters";
import type { DailyCheckInResponse } from "@/types";

const paymentChannels = [
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "bank", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "manual", label: "Manual" },
];

export function DailyCheckIn({ onSubmitted }: { onSubmitted?: () => Promise<void> | void }) {
  const { session } = useAuth();
  const [form, setForm] = useState({
    merchant: "",
    description: "",
    payment_channel: "upi",
    spending_amount: "",
    savings_amount: "",
    cashback_amount: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DailyCheckInResponse | null>(null);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session?.accessToken) {
      setError("Please log in again before submitting your check-in.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = await apiRequest<DailyCheckInResponse>("/finance/daily-check-in/", {
        method: "POST",
        token: session.accessToken,
        body: {
          merchant: form.merchant,
          description: form.description,
          payment_channel: form.payment_channel,
          spending_amount: form.spending_amount || "0",
          savings_amount: form.savings_amount || "0",
          cashback_amount: form.cashback_amount || "0",
        },
      });

      setResult(payload);
      setForm({
        merchant: "",
        description: "",
        payment_channel: form.payment_channel,
        spending_amount: "",
        savings_amount: "",
        cashback_amount: "",
      });
      await onSubmitted?.();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to save the daily check-in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="lg:col-span-2">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-subtle">Daily money check-in</p>
          <h2 className="font-display text-2xl text-[color:var(--text-strong)]">Log spending, savings, and UPI cashback in one move</h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">
            This is the control center that keeps the dashboard honest. Spending updates budgeting insights, savings strengthens your reserve, and real cashback or round-ups can be routed into wealth buckets.
          </p>
        </div>
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-3 text-sm text-muted">
          Only funded sweeps change portfolio, savings, or goal balances.
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-5">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <label className="field-label xl:col-span-2">
            Merchant or app
            <input className="input-field" placeholder="Swiggy, Amazon, GPay, etc." value={form.merchant} onChange={(event) => updateField("merchant", event.target.value)} />
          </label>
          <label className="field-label">
            Spending today
            <input className="input-field" type="number" min="0" step="0.01" placeholder="0" value={form.spending_amount} onChange={(event) => updateField("spending_amount", event.target.value)} />
          </label>
          <label className="field-label">
            Saved today
            <input className="input-field" type="number" min="0" step="0.01" placeholder="0" value={form.savings_amount} onChange={(event) => updateField("savings_amount", event.target.value)} />
          </label>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <label className="field-label">
            Cashback received
            <input className="input-field" type="number" min="0" step="0.01" placeholder="0" value={form.cashback_amount} onChange={(event) => updateField("cashback_amount", event.target.value)} />
          </label>
          <label className="field-label">
            Payment channel
            <select className="input-field" value={form.payment_channel} onChange={(event) => updateField("payment_channel", event.target.value)}>
              {paymentChannels.map((channel) => (
                <option key={channel.value} value={channel.value}>
                  {channel.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label md:col-span-2 xl:col-span-2">
            Notes
            <input className="input-field" placeholder="Optional context for the transaction or reward" value={form.description} onChange={(event) => updateField("description", event.target.value)} />
          </label>
        </div>

        {error ? <p className="rounded-2xl border border-[color:var(--danger-soft)] bg-[color:var(--danger-bg)] px-4 py-3 text-sm text-[color:var(--danger-text)]">{error}</p> : null}

        {result ? (
          <div className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-5">
            <p className="font-semibold text-[color:var(--text-strong)]">{result.message}</p>
            <p className="mt-2 text-sm text-muted">Growth score now at {Math.round(result.growth_score)}/100.</p>
            {result.latest_strategy ? <p className="mt-2 text-sm text-[color:var(--brand)]">Latest spend strategy: {result.latest_strategy}</p> : null}
            {result.spend_sweep ? (
              <div className="mt-4 space-y-2 text-sm">
                <p className="font-semibold text-[color:var(--text-strong)]">
                  Spend sweep {result.spend_sweep.status === "funded" || result.spend_sweep.status === "mock_funded" ? "funded" : "planned"}:
                  {" "}
                  {formatCurrency(result.spend_sweep.amount)} into {result.spend_sweep.strategy_name}
                </p>
                <p className="text-muted">{result.spend_sweep.selection_reason}</p>
                <p className="text-[color:var(--brand)]">
                  Invest {formatCurrency(result.spend_sweep.investment_amount)} · Save {formatCurrency(result.spend_sweep.savings_amount)} · Goals {formatCurrency(result.spend_sweep.goal_amount)}
                </p>
              </div>
            ) : null}
            {result.cashback_conversion ? (
              <div className="mt-4 space-y-2 text-sm">
                <p className="font-semibold text-[color:var(--text-strong)]">
                  Cashback {result.cashback_conversion.status === "funded" || result.cashback_conversion.status === "mock_funded" ? "funded" : "planned"}:
                  {" "}
                  {formatCurrency(result.cashback_conversion.amount)} into {result.cashback_conversion.strategy_name}
                </p>
                <p className="text-muted">{result.cashback_conversion.selection_reason}</p>
                <p className="text-[color:var(--brand)]">
                  Invest {formatCurrency(result.cashback_conversion.investment_amount)} · Save {formatCurrency(result.cashback_conversion.savings_amount)} · Goals {formatCurrency(result.cashback_conversion.goal_amount)}
                </p>
                {result.cashback_conversion.fallback_options.length ? (
                  <p className="text-[color:var(--brand)]">Fallback routes ready: {result.cashback_conversion.fallback_options.join(", ")}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">Use this once a day and the dashboard, analytics, goals, and portfolio will stay grounded in real spending, savings, cashback, and funded sweep inputs.</p>
          <button type="submit" disabled={submitting} className="button-primary">
            {submitting ? "Saving check-in..." : "Save daily check-in"}
          </button>
        </div>
      </form>
    </Card>
  );
}
