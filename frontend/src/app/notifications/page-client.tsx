"use client";

import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/shared/card";
import { QueryState } from "@/components/shared/query-state";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { formatDate, titleCase } from "@/lib/formatters";
import type { NotificationRecord } from "@/types";

export default function NotificationsPageClient() {
  const { data, error, loading } = useAuthedQuery<NotificationRecord[]>("/notifications/");

  return (
    <AppShell title="Notification Center" subtitle="Milestones, spend-to-wealth conversions, and savings triggers land here as live nudges.">
      {loading ? <QueryState title="Loading notifications" message="Fetching live nudges, empowerment events, and milestone alerts." /> : null}
      {error ? <QueryState title="Notifications unavailable" message={error} /> : null}
      {!data ? null : (
        <div className="space-y-4">
          {data.map((notification) => (
            <Card key={notification.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-[color:var(--text-strong)]">{notification.title}</p>
                  <p className="mt-2 text-sm leading-7 text-muted">{notification.body}</p>
                </div>
                <span className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs uppercase tracking-[0.2em] text-[color:var(--brand)]">
                  {titleCase(notification.notification_type)}
                </span>
              </div>
              <p className="mt-4 text-xs uppercase tracking-[0.18em] text-subtle">{formatDate(notification.created_at)}</p>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
