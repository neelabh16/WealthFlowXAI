import Link from "next/link";
import { Bot, BrainCircuit, LineChart, ShieldCheck, Target, Wallet } from "lucide-react";
import { Card } from "@/components/shared/card";

const features = [
  { icon: Wallet, title: "AI Cashback Investing", body: "Convert round-ups and cashback into savings, investing, and goal funding instead of short-term reward spending." },
  { icon: Bot, title: "Advisor Copilot", body: "Ask natural-language money questions with context from your transactions, goals, and behavior patterns." },
  { icon: BrainCircuit, title: "Behavioral Finance Engine", body: "Detect impulsive habits, subscription leaks, and build stronger financial discipline over time." },
  { icon: LineChart, title: "Prediction Engine", body: "Forecast savings, balances, and portfolio growth with data-backed projections." },
  { icon: ShieldCheck, title: "Fraud Intelligence", body: "Surface anomaly signals and safety alerts inside the same financial command center." },
  { icon: Target, title: "Goal Optimizer", body: "Turn ambitions into executable monthly plans with feasibility scoring and visible progress tracking." },
];

export default function LandingPageHomeV2() {
  return (
    <main className="min-h-screen">
      <section className="grid-shell relative overflow-hidden py-10">
        <div className="absolute inset-x-0 top-0 -z-10 h-[540px] rounded-[48px] bg-gradient-to-br from-ocean/20 via-transparent to-mint/10 blur-3xl" />
        <div className="glass-card overflow-hidden p-8 sm:p-12">
          <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="mb-4 inline-flex rounded-full border border-mint/30 bg-mint/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-mint">
                Wealth creation on autopilot
              </p>
              <h1 className="max-w-4xl font-display text-5xl leading-tight sm:text-7xl">
                Make every rupee work harder with an AI-native wealth operating system.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                WealthFlow X AI transforms spending into investing, coaching, forecasting, fraud protection, and behavioral growth in one premium fintech platform.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/dashboard" className="rounded-full bg-mint px-6 py-3 text-sm font-semibold text-ink">
                  Enter Wealth Dashboard
                </Link>
                <Link href="/advisor" className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white">
                  Open Finance Advisor
                </Link>
              </div>
              <div className="mt-12 grid gap-4 sm:grid-cols-3">
                {["Rs 1.8Cr assets modeled", "97.2% fraud detection confidence", "3.4x faster goal planning"].map((item) => (
                  <div key={item} className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-slate-200">
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <Card className="relative overflow-hidden bg-gradient-to-b from-white/10 to-white/5">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-400">How it helps users</p>
              <div className="mt-8 space-y-4">
                {[
                  "Track spending, cashback, savings, and goals from one financial command center.",
                  "Convert small daily amounts into visible savings, investing, and goal progress.",
                  "Use AI guidance to reduce money leaks and build stronger long-term habits.",
                ].map((line) => (
                  <div key={line} className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm leading-7 text-slate-200">
                    {line}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="grid-shell py-14">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-mint">Platform pillars</p>
            <h2 className="mt-2 font-display text-4xl">Enterprise-grade intelligence across your money stack.</h2>
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title}>
                <div className="mb-5 inline-flex rounded-2xl bg-white/10 p-3">
                  <Icon className="h-5 w-5 text-mint" />
                </div>
                <h3 className="font-display text-2xl">{feature.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{feature.body}</p>
              </Card>
            );
          })}
        </div>
      </section>
    </main>
  );
}
