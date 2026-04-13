import { ChartPoint, ChatMessage, InsightCard } from "@/types";

export const insightCards: InsightCard[] = [
  { title: "Net Worth", value: "₹14.8L", delta: "+8.2% this quarter", tone: "positive" },
  { title: "AI Cashback Invested", value: "₹18,420", delta: "92 automations fired", tone: "positive" },
  { title: "Fraud Risk", value: "Low", delta: "1 alert reviewed", tone: "neutral" },
  { title: "Money Personality", value: "81/100", delta: "Discipline improving", tone: "positive" },
];

export const savingsTrend: ChartPoint[] = [
  { label: "Jan", value: 42000 },
  { label: "Feb", value: 51000 },
  { label: "Mar", value: 48800 },
  { label: "Apr", value: 63400 },
  { label: "May", value: 72100 },
];

export const portfolioMix: ChartPoint[] = [
  { label: "Stocks", value: 38 },
  { label: "Mutual Funds", value: 34 },
  { label: "Savings", value: 20 },
  { label: "ESG", value: 8 },
];

export const advisorMessages: ChatMessage[] = [
  { role: "user", content: "Can I afford a ₹50k MacBook purchase this month?" },
  {
    role: "assistant",
    content:
      "Yes, but only if you hold dining and entertainment under your baseline. Otherwise it delays your emergency fund target by 19 days.",
  },
];

export const transactionRows = [
  { merchant: "Swiggy", category: "Food", amount: "-₹1,240", status: "Leak risk" },
  { merchant: "Salary", category: "Income", amount: "+₹1,85,000", status: "Captured" },
  { merchant: "Zerodha SIP", category: "Investment", amount: "-₹12,000", status: "On plan" },
  { merchant: "Netflix", category: "Subscription", amount: "-₹649", status: "Review" },
];
