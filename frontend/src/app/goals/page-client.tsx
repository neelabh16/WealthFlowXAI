"use client";

import { FormEvent, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/components/providers/auth-provider";
import { Card } from "@/components/shared/card";
import { QueryState } from "@/components/shared/query-state";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { apiRequest } from "@/lib/api";
import { formatCurrency, formatPercent, formatDate } from "@/lib/formatters";
import type { GoalRecord, WealthMilestoneRecord } from "@/types";

export default function GoalsPageClient() {
  const { session } = useAuth();
  const goals = useAuthedQuery<GoalRecord[]>("/finance/goals/");
  const milestones = useAuthedQuery<WealthMilestoneRecord[]>("/finance/wealth-milestones/");
  const loading = goals.loading || milestones.loading;
  const error = goals.error || milestones.error;
  const [form, setForm] = useState({
    title: "",
    target_amount: "",
    current_amount: "",
    deadline: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [topUpAmounts, setTopUpAmounts] = useState<Record<number, string>>({});
  const [topUpLoadingId, setTopUpLoadingId] = useState<number | null>(null);
  const [topUpError, setTopUpError] = useState<string | null>(null);

  const handleCreateGoal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session?.accessToken) {
      setSubmitError("Please log in again before creating a goal.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      await apiRequest("/finance/goals/", {
        method: "POST",
        token: session.accessToken,
        body: {
          ...form,
          current_amount: form.current_amount || "0",
        },
      });
      setForm({ title: "", target_amount: "", current_amount: "", deadline: "" });
      await Promise.all([goals.refetch(), milestones.refetch()]);
    } catch (submissionError) {
      setSubmitError(submissionError instanceof Error ? submissionError.message : "Unable to create the goal.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTopUpGoal = async (goal: GoalRecord) => {
    if (!session?.accessToken) {
      setTopUpError("Please log in again before updating the goal.");
      return;
    }

    const amount = Number(topUpAmounts[goal.id] || 0);
    if (!amount || amount <= 0) {
      setTopUpError("Enter a valid amount to add to the goal.");
      return;
    }

    setTopUpLoadingId(goal.id);
    setTopUpError(null);

    try {
      await apiRequest(`/finance/goals/${goal.id}/`, {
        method: "PATCH",
        token: session.accessToken,
        body: {
          current_amount: (Number(goal.current_amount) + amount).toFixed(2),
        },
      });
      setTopUpAmounts((current) => ({ ...current, [goal.id]: "" }));
      await Promise.all([goals.refetch(), milestones.refetch()]);
    } catch (submissionError) {
      setTopUpError(submissionError instanceof Error ? submissionError.message : "Unable to update the goal.");
    } finally {
      setTopUpLoadingId(null);
    }
  };

  return (
    <AppShell title="Goal Planner" subtitle="Every goal receives live boost contributions from your redirected spending behavior.">
      {loading ? <QueryState title="Loading goals" message="Bringing in live goal progress and milestone momentum." /> : null}
      {error ? <QueryState title="Goals unavailable" message={error} /> : null}
      {!goals.data ? null : (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-6">
            <Card>
              <p className="text-sm text-subtle">Create a live goal</p>
              <h2 className="mt-2 font-display text-2xl text-[color:var(--text-strong)]">Give the engine something meaningful to fund</h2>
              <form onSubmit={handleCreateGoal} className="mt-5 grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="field-label md:col-span-2">
                    Goal title
                    <input className="input-field" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Emergency fund, Europe trip, house deposit..." required />
                  </label>
                  <label className="field-label">
                    Target amount
                    <input className="input-field" type="number" min="1" step="0.01" value={form.target_amount} onChange={(event) => setForm((current) => ({ ...current, target_amount: event.target.value }))} required />
                  </label>
                  <label className="field-label">
                    Current amount
                    <input className="input-field" type="number" min="0" step="0.01" value={form.current_amount} onChange={(event) => setForm((current) => ({ ...current, current_amount: event.target.value }))} />
                  </label>
                  <label className="field-label">
                    Deadline
                    <input className="input-field" type="date" value={form.deadline} onChange={(event) => setForm((current) => ({ ...current, deadline: event.target.value }))} required />
                  </label>
                </div>
                {submitError ? <p className="rounded-2xl border border-[color:var(--danger-soft)] bg-[color:var(--danger-bg)] px-4 py-3 text-sm text-[color:var(--danger-text)]">{submitError}</p> : null}
                <div className="flex justify-end">
                  <button type="submit" disabled={submitting} className="button-primary">
                    {submitting ? "Creating goal..." : "Create goal"}
                  </button>
                </div>
              </form>
            </Card>

            {goals.data.map((goal) => {
              const progress = Math.min((Number(goal.current_amount) / Math.max(Number(goal.target_amount), 1)) * 100, 100);
              return (
                <Card key={goal.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-subtle">Deadline {formatDate(goal.deadline)}</p>
                      <h2 className="mt-2 font-display text-3xl text-[color:var(--text-strong)]">{goal.title}</h2>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-subtle">Feasibility</p>
                      <p className="text-lg font-semibold text-[color:var(--brand)]">{formatPercent(goal.feasibility_score)}</p>
                    </div>
                  </div>
                  <div className="mt-6 h-3 rounded-full bg-[color:var(--surface-strong)]">
                    <div className="h-3 rounded-full bg-gradient-to-r from-mint to-ocean" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-subtle">Current</p>
                      <p className="mt-2 font-semibold text-[color:var(--text-strong)]">{formatCurrency(goal.current_amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-subtle">Target</p>
                      <p className="mt-2 font-semibold text-[color:var(--text-strong)]">{formatCurrency(goal.target_amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-subtle">Needed monthly</p>
                      <p className="mt-2 font-semibold text-[color:var(--brand)]">{formatCurrency(goal.monthly_required)}</p>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <label className="field-label sm:max-w-[12rem]">
                      Add progress
                      <input
                        className="input-field"
                        type="number"
                        min="0"
                        step="0.01"
                        value={topUpAmounts[goal.id] ?? ""}
                        onChange={(event) => setTopUpAmounts((current) => ({ ...current, [goal.id]: event.target.value }))}
                        placeholder="0"
                      />
                    </label>
                    <button type="button" className="button-secondary" disabled={topUpLoadingId === goal.id} onClick={() => handleTopUpGoal(goal)}>
                      {topUpLoadingId === goal.id ? "Updating..." : "Update goal progress"}
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>

          <Card>
            <p className="text-sm text-subtle">Milestones reinforcing progress</p>
            {topUpError ? <p className="mt-4 rounded-2xl border border-[color:var(--danger-soft)] bg-[color:var(--danger-bg)] px-4 py-3 text-sm text-[color:var(--danger-text)]">{topUpError}</p> : null}
            <div className="mt-4 space-y-4">
              {milestones.data?.length ? (
                milestones.data.map((milestone) => (
                  <div key={milestone.id} className="surface-panel p-4">
                    <p className="font-semibold text-[color:var(--text-strong)]">{milestone.title}</p>
                    <p className="mt-2 text-sm text-muted">{milestone.description}</p>
                    <p className="mt-3 text-[color:var(--brand)]">{milestone.celebration_copy}</p>
                  </div>
                ))
              ) : (
                <div className="surface-panel p-4 text-sm text-muted">Milestones will appear here as your funded goals and buffers grow.</div>
              )}
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
