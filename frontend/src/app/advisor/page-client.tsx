"use client";

import { FormEvent, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/shared/card";
import { QueryState } from "@/components/shared/query-state";
import { useAuth } from "@/components/providers/auth-provider";
import { apiRequest } from "@/lib/api";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import type { AdvisorReply, DashboardResponse } from "@/types";

const starterPrompts = [
  "How can I improve my growth score this week?",
  "Where am I overspending right now?",
  "What is the best investing move for me this month?",
  "Can I afford a 15000 purchase this month?",
];

export default function AdvisorPageClient() {
  const { session } = useAuth();
  const { data, error, loading } = useAuthedQuery<DashboardResponse>("/finance/dashboard/");
  const [prompt, setPrompt] = useState("How can I improve my growth score this week?");
  const [messages, setMessages] = useState<AdvisorReply[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const sendPrompt = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session?.accessToken || !prompt.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      const reply = await apiRequest<AdvisorReply>("/ai/advisor/chat/", {
        method: "POST",
        token: session.accessToken,
        body: { prompt },
      });
      setMessages((current) => [reply, ...current]);
      setPrompt("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell title="AI Advisor" subtitle="Ask contextual questions about budgets, growth score, savings triggers, and what each spend should do for your future.">
      {loading ? <QueryState title="Loading advisor context" message="Preparing your live growth signals and behavior drivers." /> : null}
      {error ? <QueryState title="Advisor context unavailable" message={error} /> : null}
      {!data ? null : (
        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <Card>
            <p className="text-sm text-subtle">Current advisor context</p>
            <div className="mt-4 space-y-4">
              <div className="surface-panel p-4">
                <p className="font-semibold text-[color:var(--text-strong)]">Growth score</p>
                <p className="mt-2 text-sm text-muted">{Math.round(data.summary.growth_score)}/100 with {data.summary.active_trigger_count} active saving triggers</p>
              </div>
              <div className="surface-panel p-4">
                <p className="font-semibold text-[color:var(--text-strong)]">Ask about</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {starterPrompts.map((starterPrompt) => (
                    <button key={starterPrompt} type="button" className="button-ghost" onClick={() => setPrompt(starterPrompt)}>
                      {starterPrompt}
                    </button>
                  ))}
                </div>
              </div>
              {data.growth_snapshot.summary.drivers?.map((driver) => (
                <div key={driver} className="surface-card p-4 text-sm leading-7 text-[color:var(--text-strong)]">
                  {driver}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <form onSubmit={sendPrompt} className="space-y-4">
              <label className="field-label">
                Ask the advisor
                <textarea className="input-field min-h-32" value={prompt} onChange={(event) => setPrompt(event.target.value)} />
              </label>
              <button type="submit" disabled={submitting} className="button-primary">
                {submitting ? "Thinking..." : "Send prompt"}
              </button>
            </form>

            <div className="mt-6 space-y-4">
              {messages.map((message, index) => (
                <div key={`${message.prompt}-${index}`} className="surface-panel p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-subtle">Prompt</p>
                  <p className="mt-2 text-sm text-[color:var(--text-strong)]">{message.prompt}</p>
                  <p className="mt-4 text-xs uppercase tracking-[0.2em] text-subtle">Advisor</p>
                  <p className="mt-2 text-sm leading-7 text-muted">{message.answer}</p>
                  {message.focus_areas.length ? (
                    <div className="mt-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-subtle">What I am seeing</p>
                      <div className="mt-2 space-y-2">
                        {message.focus_areas.map((item) => (
                          <div key={item} className="surface-card p-3 text-sm leading-7 text-[color:var(--text-strong)]">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {message.recommendations.length ? (
                    <div className="mt-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-subtle">Recommended next moves</p>
                      <div className="mt-2 space-y-2">
                        {message.recommendations.map((item) => (
                          <div key={item} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-3 text-sm text-[color:var(--brand)]">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <p className="mt-4 text-xs uppercase tracking-[0.2em] text-subtle">Confidence {Math.round(message.confidence * 100)}%</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
