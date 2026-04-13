export type InsightCard = {
  title: string;
  value: string;
  delta: string;
  tone: "positive" | "neutral" | "warning";
};

export type ChartPoint = {
  label: string;
  value: number;
};

export type ChatMessage = {
  role: "assistant" | "user";
  content: string;
};

export type AdvisorReply = {
  prompt: string;
  answer: string;
  focus_areas: string[];
  recommendations: string[];
  confidence: number;
};

export type InsightSearchResult = {
  source_type: string;
  title: string;
  body: string;
  route: string;
};

export type ThemeMode = "light" | "dark";

export type AuthUser = {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
  monthly_income: string;
  risk_profile: string;
  preferred_currency: string;
  money_personality_score: number;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  email: string;
  username: string;
  password: string;
  first_name: string;
  last_name: string;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
};

export type EmpowermentStrategyOption = {
  title: string;
  code: string;
  description: string;
  fit_score: number;
  thesis: string;
};

export type ApiListResponse<T> = {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: T;
};

export type TransactionRecord = {
  id: number;
  merchant: string;
  category_name?: string;
  display_category?: string;
  flow_group?: "income" | "expense" | "investment" | "saving" | "reward";
  amount: string;
  currency: string;
  transaction_type: "credit" | "debit";
  description: string;
  occurred_at: string;
  ai_category: string;
  is_flagged: boolean;
};

export type GoalRecord = {
  id: number;
  title: string;
  target_amount: string;
  current_amount: string;
  deadline: string;
  feasibility_score: number;
  monthly_required: string;
};

export type InvestmentRecord = {
  id: number;
  asset_name: string;
  asset_type: string;
  allocated_amount: string;
  current_value: string;
  roi_percentage: number;
};

export type EmpowermentAllocationRecord = {
  id: number;
  transaction: number;
  strategy_name: string;
  redirected_amount: string;
  round_up_amount: string;
  behavioral_bonus: string;
  investment_amount: string;
  savings_amount: string;
  goal_boost_amount: string;
  rationale: string;
  transaction_merchant?: string;
  metadata?: {
    channel?: string;
    primary_option?: string;
    selection_reason?: string;
    goal_label?: string;
    strategy_options?: EmpowermentStrategyOption[];
  };
  created_at: string;
};

export type SavingsTriggerRecord = {
  id: number;
  trigger_type: string;
  title: string;
  description: string;
  recommended_amount: string;
  monthly_impact: string;
  severity: string;
  is_active: boolean;
};

export type WealthMilestoneRecord = {
  id: number;
  milestone_type: string;
  title: string;
  description: string;
  target_value: string;
  current_value: string;
  progress_percentage: number;
  status: "locked" | "active" | "achieved";
  celebration_copy: string;
};

export type GrowthSnapshotRecord = {
  id: number;
  overall_score: number;
  budgeting_score: number;
  investing_score: number;
  savings_score: number;
  consistency_score: number;
  resilience_score: number;
  momentum_score: number;
  summary: {
    drivers?: string[];
    emergency_months?: number;
    positive_cashflow_30d?: number;
    redirected_90d?: number;
  };
  created_at: string;
};

export type NotificationRecord = {
  id: number;
  title: string;
  body: string;
  notification_type: string;
  is_read: boolean;
  payload: Record<string, unknown>;
  created_at: string;
};

export type PortfolioMixRecord = {
  name: string;
  value: number;
  percentage: number;
};

export type DashboardSummary = {
  net_worth: number;
  monthly_savings: number;
  portfolio_value: number;
  redirected_value: number;
  redirected_investment_value: number;
  redirected_savings_value: number;
  redirected_goal_value: number;
  redirected_event_count: number;
  pending_contribution_value: number;
  pending_contribution_count: number;
  growth_score: number;
  budgeting_score: number;
  emergency_months: number;
  goal_velocity: number;
  active_trigger_count: number;
  milestones_unlocked: number;
  top_insights: string[];
};

export type WealthSweepRuleRecord = {
  id: number;
  is_enabled: boolean;
  mode: "round_up" | "cashback_only" | "hybrid" | "percent";
  round_up_base: number;
  spend_percent: string;
  auto_fund_enabled: boolean;
  redirect_cashback_enabled: boolean;
  provider: "mock" | "razorpay";
  provider_ready: boolean;
  checkout_key: string;
  currency: string;
};

export type WealthContributionRecord = {
  id: number;
  transaction: number | null;
  transaction_merchant?: string;
  source_type: string;
  status: "planned" | "pending" | "funded" | "mock_funded" | "failed" | "cancelled";
  provider: string;
  planned_amount: string;
  funded_amount: string;
  currency: string;
  strategy_name: string;
  investment_amount: string;
  savings_amount: string;
  goal_amount: string;
  provider_order_id: string;
  created_at: string;
  notes: Record<string, unknown>;
};

export type DashboardResponse = {
  summary: DashboardSummary;
  portfolio_mix: PortfolioMixRecord[];
  goals: GoalRecord[];
  transactions: TransactionRecord[];
  empowerment_allocations: EmpowermentAllocationRecord[];
  wealth_contributions: WealthContributionRecord[];
  sweep_rule: WealthSweepRuleRecord;
  smart_saving_triggers: SavingsTriggerRecord[];
  wealth_milestones: WealthMilestoneRecord[];
  growth_snapshot: GrowthSnapshotRecord;
};

export type AnalyticsPoint = {
  month: string;
  spend: number;
  redirected: number;
};

export type GrowthHistoryPoint = {
  date: string;
  overall_score: number;
  budgeting_score: number;
  investing_score: number;
};

export type CategoryBreakdownPoint = {
  category: string;
  value: number;
};

export type AnalyticsResponse = {
  monthly_spend: AnalyticsPoint[];
  growth_history: GrowthHistoryPoint[];
  category_breakdown: CategoryBreakdownPoint[];
  insights: string[];
};

export type DailyCheckInResponse = {
  message: string;
  growth_score: number;
  spending_transaction_id: number | null;
  latest_strategy: string | null;
  spend_sweep: {
    id: number;
    status: "planned" | "pending" | "funded" | "mock_funded" | "failed" | "cancelled";
    source_type: string;
    amount: number;
    strategy_name: string;
    selection_reason: string;
    fallback_options: string[];
    investment_amount: number;
    savings_amount: number;
    goal_amount: number;
  } | null;
  cashback_conversion: {
    id: number;
    status: "planned" | "pending" | "funded" | "mock_funded" | "failed" | "cancelled";
    source_type: string;
    amount: number;
    strategy_name: string;
    selection_reason: string;
    fallback_options: string[];
    investment_amount: number;
    savings_amount: number;
    goal_amount: number;
  } | null;
};
