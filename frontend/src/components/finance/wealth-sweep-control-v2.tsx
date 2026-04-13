"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { Card } from "@/components/shared/card";
import { apiRequest } from "@/lib/api";
import { formatCurrency, titleCase } from "@/lib/formatters";
import type { WealthContributionRecord, WealthSweepRuleRecord } from "@/types";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type CheckoutResponse = {
  mode: "funded" | "mock" | "manual" | "razorpay";
  status?: string;
  order?: {
    id: string;
    amount: number;
    currency: string;
  };
};

const sweepModeLabels: Record<WealthSweepRuleRecord["mode"], string> = {
  round_up: "Round up each spend",
  cashback_only: "Cashback only",
  hybrid: "Round-up + cashback",
  percent: "Percent of spend",
};

function contributionStatusLabel(status: WealthContributionRecord["status"]) {
  if (status === "mock_funded") {
    return "Funded locally";
  }
  return titleCase(status);
}

async function loadRazorpayScript() {
  if (typeof window === "undefined") {
    return false;
  }
  if (window.Razorpay) {
    return true;
  }

  return new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function WealthSweepControlV2({
  rule,
  contributions,
  onChanged,
}: {
  rule: WealthSweepRuleRecord;
  contributions: WealthContributionRecord[];
  onChanged?: () => Promise<void> | void;
}) {
  const { session, user } = useAuth();
  const [form, setForm] = useState({
    is_enabled: rule.is_enabled,
    mode: rule.mode,
    round_up_base: String(rule.round_up_base),
    spend_percent: rule.spend_percent,
    auto_fund_enabled: rule.auto_fund_enabled,
    redirect_cashback_enabled: rule.redirect_cashback_enabled,
    provider: rule.provider,
  });
  const [saving, setSaving] = useState(false);
  const [checkoutId, setCheckoutId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      is_enabled: rule.is_enabled,
      mode: rule.mode,
      round_up_base: String(rule.round_up_base),
      spend_percent: rule.spend_percent,
      auto_fund_enabled: rule.auto_fund_enabled,
      redirect_cashback_enabled: rule.redirect_cashback_enabled,
      provider: rule.provider,
    });
  }, [rule]);

  const pendingContributions = useMemo(
    () => contributions.filter((item) => item.status === "planned" || item.status === "pending"),
    [contributions],
  );

  const saveRule = async () => {
    if (!session?.accessToken) {
      setError("Please log in again before updating the sweep rule.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await apiRequest("/finance/sweep-rule/", {
        method: "PATCH",
        token: session.accessToken,
        body: {
          is_enabled: form.is_enabled,
          mode: form.mode,
          round_up_base: Number(form.round_up_base || 50),
          spend_percent: form.spend_percent || "0",
          auto_fund_enabled: form.auto_fund_enabled,
          redirect_cashback_enabled: form.redirect_cashback_enabled,
          provider: form.provider,
        },
      });
      setMessage("Sweep settings saved.");
      await onChanged?.();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save sweep settings.");
    } finally {
      setSaving(false);
    }
  };

  const fundContribution = async (contribution: WealthContributionRecord) => {
    if (!session?.accessToken) {
      setError("Please log in again before funding a sweep.");
      return;
    }

    setCheckoutId(contribution.id);
    setError(null);
    setMessage(null);

    try {
      const checkout = await apiRequest<CheckoutResponse>(`/finance/wealth-contributions/${contribution.id}/checkout/`, {
        method: "POST",
        token: session.accessToken,
      });

      if (checkout.mode === "mock" || checkout.mode === "funded" || checkout.mode === "manual") {
        setMessage(checkout.mode === "manual" ? "Contribution is marked pending for manual funding." : "Contribution funded successfully.");
        await onChanged?.();
        return;
      }

      if (!checkout.order?.id) {
        throw new Error("Payment order was not created.");
      }

      if (!rule.checkout_key) {
        throw new Error("Razorpay public key is not configured yet.");
      }

      const scriptReady = await loadRazorpayScript();
      if (!scriptReady || !window.Razorpay) {
        throw new Error("Unable to load Razorpay checkout.");
      }

      const razorpay = new window.Razorpay({
        key: rule.checkout_key,
        amount: checkout.order.amount,
        currency: checkout.order.currency,
        name: "WealthFlow X AI",
        description: `${titleCase(contribution.source_type)} sweep`,
        order_id: checkout.order.id,
        prefill: {
          name: `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim(),
          email: user?.email ?? "",
        },
        theme: {
          color: "#3DD9B2",
        },
        handler: async (response: Record<string, string>) => {
          await apiRequest(`/finance/wealth-contributions/verify/`, {
            method: "POST",
            token: session.accessToken,
            body: {
              contribution_id: contribution.id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            },
          });
          setMessage("Contribution funded successfully.");
          await onChanged?.();
        },
      });

      razorpay.open();
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Unable to process the contribution.");
    } finally {
      setCheckoutId(null);
    }
  };

  return (
    <Card>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm text-subtle">Real sweep controls</p>
          <h2 className="mt-1 font-display text-2xl text-[color:var(--text-strong)]">Route actual round-ups and cashback into wealth</h2>
          <p className="mt-2 text-sm leading-7 text-muted">
            This is the trust layer. Advice can suggest a route, but only funded contributions move savings, investment, and goal balances.
          </p>
        </div>
        <div className="surface-card max-w-sm px-4 py-3 text-sm leading-6 text-muted">
          <p className="font-semibold text-[color:var(--text-strong)]">Provider: {rule.provider === "mock" ? "Local mock funding" : "Razorpay"}</p>
          <p className="mt-1">{rule.provider_ready ? "Ready to accept sweep actions." : "Configure Razorpay keys before enabling real checkout."}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <label className="field-label">
          Sweep mode
          <select className="input-field" value={form.mode} onChange={(event) => setForm((current) => ({ ...current, mode: event.target.value as WealthSweepRuleRecord["mode"] }))}>
            {Object.entries(sweepModeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="field-label">
          Round-up base
          <select className="input-field" value={form.round_up_base} onChange={(event) => setForm((current) => ({ ...current, round_up_base: event.target.value }))}>
            {["10", "20", "50", "100"].map((value) => (
              <option key={value} value={value}>
                Rs {value}
              </option>
            ))}
          </select>
        </label>

        <label className="field-label">
          Percent of spend
          <input className="input-field" type="number" min="0" max="25" step="0.1" value={form.spend_percent} onChange={(event) => setForm((current) => ({ ...current, spend_percent: event.target.value }))} />
        </label>

        <label className="field-label">
          Funding provider
          <select className="input-field" value={form.provider} onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value as WealthSweepRuleRecord["provider"] }))}>
            <option value="mock">Mock</option>
            <option value="razorpay">Razorpay</option>
          </select>
        </label>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="surface-card flex items-center justify-between gap-3 p-4 text-sm text-[color:var(--text-strong)]">
          Enable sweep engine
          <input type="checkbox" checked={form.is_enabled} onChange={(event) => setForm((current) => ({ ...current, is_enabled: event.target.checked }))} />
        </label>
        <label className="surface-card flex items-center justify-between gap-3 p-4 text-sm text-[color:var(--text-strong)]">
          Auto-fund immediately
          <input type="checkbox" checked={form.auto_fund_enabled} onChange={(event) => setForm((current) => ({ ...current, auto_fund_enabled: event.target.checked }))} />
        </label>
        <label className="surface-card flex items-center justify-between gap-3 p-4 text-sm text-[color:var(--text-strong)]">
          Redirect real cashback
          <input type="checkbox" checked={form.redirect_cashback_enabled} onChange={(event) => setForm((current) => ({ ...current, redirect_cashback_enabled: event.target.checked }))} />
        </label>
      </div>

      {message ? <p className="mt-5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-3 text-sm text-[color:var(--brand)]">{message}</p> : null}
      {error ? <p className="mt-5 rounded-2xl border border-[color:var(--danger-soft)] bg-[color:var(--danger-bg)] px-4 py-3 text-sm text-[color:var(--danger-text)]">{error}</p> : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {pendingContributions.length
            ? `${pendingContributions.length} contribution${pendingContributions.length === 1 ? "" : "s"} waiting for funding.`
            : "No pending contributions right now."}
        </p>
        <button type="button" onClick={saveRule} disabled={saving} className="button-primary">
          {saving ? "Saving..." : "Save sweep settings"}
        </button>
      </div>

      <div className="mt-6 space-y-4">
        {contributions.length ? (
          contributions.map((contribution) => (
            <div key={contribution.id} className="surface-panel flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-[color:var(--text-strong)]">
                  {contribution.transaction_merchant || titleCase(contribution.source_type)} {titleCase(contribution.source_type)}
                </p>
                <p className="text-sm text-subtle">
                  {contribution.strategy_name} / {contributionStatusLabel(contribution.status)}
                </p>
                <p className="mt-2 text-xs leading-6 text-muted">
                  Invest {formatCurrency(contribution.investment_amount)} / Save {formatCurrency(contribution.savings_amount)} / Goals {formatCurrency(contribution.goal_amount)}
                </p>
              </div>
              <div className="flex flex-col items-start gap-3 lg:min-w-[8rem] lg:items-end">
                <p className="font-semibold text-[color:var(--text-strong)]">
                  {formatCurrency(contribution.funded_amount !== "0.00" ? contribution.funded_amount : contribution.planned_amount)}
                </p>
                {contribution.status === "planned" || contribution.status === "pending" ? (
                  <button type="button" className="button-secondary" disabled={checkoutId === contribution.id} onClick={() => fundContribution(contribution)}>
                    {checkoutId === contribution.id ? "Processing..." : "Fund now"}
                  </button>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <div className="surface-panel px-4 py-5 text-sm text-muted">
            No sweep actions yet. Log a spending or cashback event to create your first routed contribution.
          </div>
        )}
      </div>
    </Card>
  );
}
