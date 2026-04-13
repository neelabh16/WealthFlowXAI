"use client";

import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/shared/card";
import { QueryState } from "@/components/shared/query-state";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { formatCurrency, formatDate, titleCase } from "@/lib/formatters";
import type { EmpowermentAllocationRecord, TransactionRecord } from "@/types";

export default function TransactionsPageClient() {
  const transactions = useAuthedQuery<TransactionRecord[]>("/finance/transactions/");
  const allocations = useAuthedQuery<EmpowermentAllocationRecord[]>("/finance/empowerment-allocations/");
  const loading = transactions.loading || allocations.loading;
  const error = transactions.error || allocations.error;

  return (
    <AppShell title="Transactions" subtitle="Each debit can now trigger budgeting nudges, savings triggers, and auto-redirection into wealth.">
      {loading ? <QueryState title="Loading transactions" message="Joining transaction activity with live empowerment allocations." /> : null}
      {error ? <QueryState title="Transactions unavailable" message={error} /> : null}
      {!transactions.data ? null : (
        <Card>
          <div className="space-y-4">
            {transactions.data.map((transaction) => {
              const allocation = (allocations.data ?? []).find((item) => item.transaction === transaction.id);
              const flowLabel =
                transaction.flow_group === "income"
                  ? "Income"
                  : transaction.flow_group === "reward"
                    ? "Reward"
                    : transaction.flow_group === "investment"
                      ? "Investment"
                      : transaction.flow_group === "saving"
                        ? "Saving"
                        : "Expense";
              return (
                <div key={transaction.id} className="surface-panel grid gap-4 p-4 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
                  <div>
                    <p className="font-semibold text-[color:var(--text-strong)]">{transaction.merchant}</p>
                    <p className="text-sm text-subtle">{transaction.display_category || transaction.category_name || titleCase(transaction.ai_category || "expense")}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.2em] text-subtle">{formatDate(transaction.occurred_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-subtle">{flowLabel}</p>
                    <p className="mt-2 font-semibold text-[color:var(--text-strong)]">{formatCurrency(transaction.amount, transaction.currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-subtle">Redirected</p>
                    <p className="mt-2 font-semibold text-[color:var(--brand)]">
                      {allocation ? formatCurrency(allocation.redirected_amount) : transaction.flow_group === "reward" ? "Converted separately" : "No redirect"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-subtle">Outcome</p>
                    <p className="mt-2 text-sm text-muted">
                      {allocation
                        ? allocation.strategy_name
                        : transaction.flow_group === "income"
                          ? "Cash inflow recorded"
                          : transaction.flow_group === "reward"
                            ? "Reward or cashback event"
                            : transaction.flow_group === "investment"
                              ? "Long-term investment contribution"
                              : transaction.flow_group === "saving"
                                ? "Savings transfer recorded"
                                : "Household spending recorded"}
                    </p>
                    {allocation?.metadata?.strategy_options && allocation.metadata.strategy_options.length > 1 ? (
                      <p className="mt-2 text-xs text-[color:var(--brand)]">Fallbacks: {allocation.metadata.strategy_options.slice(1).map((option) => option.title).join(", ")}</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </AppShell>
  );
}
