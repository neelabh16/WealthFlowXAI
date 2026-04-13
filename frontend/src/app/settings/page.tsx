import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/shared/card";

export default function SettingsPage() {
  return (
    <AppShell title="Settings" subtitle="Manage profile, risk level, preferences, currencies, and AI autopilot controls.">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <p className="font-display text-2xl text-[color:var(--text-strong)]">Profile & Preferences</p>
            <p className="mt-4 text-sm leading-7 text-muted">Update identity, preferred currency, notification rules, and security options.</p>
          </Card>
          <Card>
            <p className="font-display text-2xl text-[color:var(--text-strong)]">Risk & Automation</p>
            <p className="mt-4 text-sm leading-7 text-muted">Choose conservative, balanced, or aggressive allocation logic and enable voice advisor / PWA mode.</p>
          </Card>
        </div>
    </AppShell>
  );
}
