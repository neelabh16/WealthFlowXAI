import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/shared/card";

export default function AdminPage() {
  return (
    <AppShell title="Admin Control Room" subtitle="Monitor growth, fraud, AI model activity, and platform reliability from one operator surface.">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            "Active users: 12,408",
            "Fraud cases escalated: 14",
            "AI insights generated today: 82,441",
          ].map((item) => (
            <Card key={item} className="font-display text-2xl text-[color:var(--text-strong)]">
              {item}
            </Card>
          ))}
        </div>
    </AppShell>
  );
}
