from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal, ROUND_CEILING, ROUND_HALF_UP
import re
from django.db.models import Sum
from django.utils import timezone
from .models import Goal, GrowthScoreSnapshot, Investment, Transaction, UserBehaviorScore, WealthContribution, WealthMilestone

MONEY = Decimal("0.01")
HUNDRED = Decimal("100")
ZERO = Decimal("0")


@dataclass
class FinancialState:
    income_30d: Decimal
    spend_30d: Decimal
    income_90d: Decimal
    spend_90d: Decimal
    discretionary_30d: Decimal
    redirected_90d: Decimal
    goal_funding_90d: Decimal
    positive_cashflow_30d: Decimal
    emergency_fund_value: Decimal
    monthly_income_baseline: Decimal
    monthly_spend_baseline: Decimal
    emergency_months: Decimal
    portfolio_value: Decimal
    total_redirected_lifetime: Decimal


def money(value: Decimal | float | int | str) -> Decimal:
    return Decimal(str(value)).quantize(MONEY, rounding=ROUND_HALF_UP)


def clamp(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    return max(minimum, min(maximum, value))


def ratio(numerator: Decimal, denominator: Decimal) -> float:
    if denominator <= ZERO:
        return 0.0
    return float((numerator / denominator) * HUNDRED)


def _normalized_transaction_text(transaction: Transaction) -> str:
    merchant = (transaction.merchant or "").lower()
    description = (transaction.description or "").lower()
    source = (transaction.source or "").lower()
    category_name = (transaction.category.name if transaction.category_id and transaction.category else "").lower()
    ai_category = (transaction.ai_category or "").lower()
    return " ".join(filter(None, [merchant, description, source, category_name, ai_category]))


def transaction_flow_group(transaction: Transaction) -> str:
    text = _normalized_transaction_text(transaction)

    if transaction.transaction_type == Transaction.Types.CREDIT:
        if any(keyword in text for keyword in ["cashback", "reward", "cash back"]):
            return "reward"
        return "income"

    if any(keyword in text for keyword in ["sip", "mutual fund", "zerodha", "groww", "upstox", "etf", "stock", "investment"]):
        return "investment"
    if any(keyword in text for keyword in ["savings", "fd", "rd", "deposit", "emergency shield", "wallet top up"]):
        return "saving"
    return "expense"


def transaction_category_label(transaction: Transaction) -> str:
    text = _normalized_transaction_text(transaction)
    flow_group = transaction_flow_group(transaction)

    if flow_group == "income":
        return "income"
    if flow_group == "reward":
        return "cashback"
    if flow_group == "investment":
        return "investments"
    if flow_group == "saving":
        return "savings"

    keyword_map = {
        "shopping": ["amazon", "flipkart", "myntra", "ajio", "shopping", "gadget", "electronics", "purchase"],
        "food": ["swiggy", "zomato", "restaurant", "food", "cafe", "coffee", "dining"],
        "transport": ["uber", "ola", "metro", "fuel", "petrol", "diesel", "transport", "airport transfer"],
        "subscriptions": ["netflix", "spotify", "prime", "hotstar", "subscription", "renewal", "streaming"],
        "groceries": ["grocery", "mart", "blinkit", "instamart", "zepto", "bigbasket"],
        "travel": ["flight", "hotel", "travel", "booking", "makemytrip"],
        "utilities": ["electricity", "water bill", "internet", "mobile recharge", "utility", "broadband"],
    }
    for label, keywords in keyword_map.items():
        if any(keyword in text for keyword in keywords):
            return label

    if transaction.category_id and transaction.category and transaction.category.kind != "income":
        return transaction.category.name.lower()
    if transaction.ai_category and transaction.ai_category.lower() not in {"income", "cashback"}:
        return transaction.ai_category.lower()
    return "expenses"


def transaction_display_category(transaction: Transaction) -> str:
    label = transaction_category_label(transaction)
    if label == "income":
        return "Income"
    if label == "cashback":
        return "Cashback Reward"
    if label == "investments":
        return "Investment"
    if label == "savings":
        return "Savings"
    return re.sub(r"\b\w", lambda match: match.group(0).upper(), label.replace("_", " "))


def round_up_to_next_fifty(amount: Decimal) -> Decimal:
    rounded = (amount / Decimal("50")).to_integral_value(rounding=ROUND_CEILING) * Decimal("50")
    return max(rounded - amount, ZERO)


def _sum_transactions_by_flow(transactions, allowed_groups: set[str]) -> Decimal:
    total = ZERO
    for transaction in transactions:
        if transaction_flow_group(transaction) in allowed_groups:
            total += transaction.amount
    return money(total)


def goal_projection(goal: Goal):
    months = max((goal.deadline.year - timezone.now().date().year) * 12 + goal.deadline.month - timezone.now().date().month, 1)
    remaining = max(goal.target_amount - goal.current_amount, ZERO)
    return remaining / Decimal(months)


def update_goal_metrics(goal: Goal):
    monthly = goal_projection(goal)
    income = goal.user.monthly_income or Decimal("1")
    feasibility = clamp(100 - float((monthly / max(income, Decimal("1"))) * HUNDRED), 12.0, 98.0)
    goal.monthly_required = money(monthly)
    goal.feasibility_score = round(feasibility, 2)
    goal.save(update_fields=["monthly_required", "feasibility_score", "updated_at"])


def build_financial_state(user) -> FinancialState:
    now = timezone.now()
    txns_30 = list(user.transactions.filter(occurred_at__gte=now - timedelta(days=30)).select_related("category"))
    txns_90 = list(user.transactions.filter(occurred_at__gte=now - timedelta(days=90)).select_related("category"))
    income_30d = _sum_transactions_by_flow(txns_30, {"income"})
    spend_30d = _sum_transactions_by_flow(txns_30, {"expense"})
    income_90d = _sum_transactions_by_flow(txns_90, {"income"})
    spend_90d = _sum_transactions_by_flow(txns_90, {"expense"})

    discretionary_categories = {"food", "subscriptions", "transport", "shopping", "entertainment", "travel"}
    discretionary_30d = ZERO
    for transaction in txns_30:
        if transaction_flow_group(transaction) == "expense" and transaction_category_label(transaction) in discretionary_categories:
            discretionary_30d += transaction.amount

    funded_contributions_90d = user.wealth_contributions.filter(status__in=[WealthContribution.Statuses.FUNDED, WealthContribution.Statuses.MOCK_FUNDED], funded_at__gte=now - timedelta(days=90))
    redirected_90d = funded_contributions_90d.aggregate(value=Sum("funded_amount"))["value"] or user.empowerment_allocations.filter(created_at__gte=now - timedelta(days=90)).aggregate(value=Sum("redirected_amount"))["value"] or ZERO
    goal_funding_90d = funded_contributions_90d.aggregate(value=Sum("goal_amount"))["value"] or user.empowerment_allocations.filter(created_at__gte=now - timedelta(days=90)).aggregate(value=Sum("goal_boost_amount"))["value"] or ZERO
    positive_cashflow_30d = max(income_30d - spend_30d, ZERO)
    monthly_income_baseline = user.monthly_income or max(income_90d / Decimal("3"), ZERO)
    monthly_spend_baseline = max(spend_90d / Decimal("3"), Decimal("1"))
    emergency_fund_value = user.investments.filter(asset_type=Investment.AssetTypes.SAVINGS).aggregate(value=Sum("current_value"))["value"] or ZERO
    emergency_months = emergency_fund_value / monthly_spend_baseline if monthly_spend_baseline > ZERO else ZERO
    portfolio_value = user.investments.aggregate(value=Sum("current_value"))["value"] or ZERO
    total_redirected_lifetime = user.wealth_contributions.filter(status__in=[WealthContribution.Statuses.FUNDED, WealthContribution.Statuses.MOCK_FUNDED]).aggregate(value=Sum("funded_amount"))["value"] or user.empowerment_allocations.aggregate(value=Sum("redirected_amount"))["value"] or ZERO

    return FinancialState(
        income_30d=income_30d,
        spend_30d=spend_30d,
        income_90d=income_90d,
        spend_90d=spend_90d,
        discretionary_30d=discretionary_30d,
        redirected_90d=redirected_90d,
        goal_funding_90d=goal_funding_90d,
        positive_cashflow_30d=positive_cashflow_30d,
        emergency_fund_value=emergency_fund_value,
        monthly_income_baseline=monthly_income_baseline,
        monthly_spend_baseline=monthly_spend_baseline,
        emergency_months=emergency_months,
        portfolio_value=portfolio_value,
        total_redirected_lifetime=total_redirected_lifetime,
    )


def build_growth_score_snapshot(user, state: FinancialState):
    budget_buffer = max(state.income_30d - state.spend_30d, ZERO)
    budgeting_score = clamp(55 + ratio(budget_buffer, max(state.income_30d, Decimal("1"))) * 0.35 - ratio(state.discretionary_30d, max(state.spend_30d, Decimal("1"))) * 0.15)
    investing_score = clamp(18 + ratio(state.redirected_90d, max(state.income_90d, Decimal("1"))) * 0.65 + len({i.asset_type for i in user.investments.all()}) * 6)
    savings_score = clamp(20 + float(state.emergency_months * Decimal("18")) + ratio(state.positive_cashflow_30d, max(state.income_30d, Decimal("1"))) * 0.35)

    active_weeks = set()
    consistency_events = list(
        user.wealth_contributions.filter(
            created_at__gte=timezone.now() - timedelta(days=56),
            status__in=[WealthContribution.Statuses.FUNDED, WealthContribution.Statuses.MOCK_FUNDED],
        )
    ) or list(user.empowerment_allocations.filter(created_at__gte=timezone.now() - timedelta(days=56)))
    for event in consistency_events:
        iso_year, iso_week, _ = event.created_at.isocalendar()
        active_weeks.add(f"{iso_year}-{iso_week}")
    consistency_score = clamp(25 + len(active_weeks) * 9)

    previous_start = timezone.now() - timedelta(days=60)
    previous_end = timezone.now() - timedelta(days=30)
    previous_transactions = list(user.transactions.filter(occurred_at__gte=previous_start, occurred_at__lt=previous_end).select_related("category"))
    previous_spend = _sum_transactions_by_flow(previous_transactions, {"expense"})
    previous_income = _sum_transactions_by_flow(previous_transactions, {"income"})
    previous_cashflow = max(previous_income - previous_spend, ZERO)
    momentum_delta = state.positive_cashflow_30d - previous_cashflow
    resilience_score = clamp(30 + float(state.emergency_months * Decimal("20")) + (15 if state.spend_30d <= state.income_30d else 0))
    momentum_score = clamp(50 + ratio(momentum_delta, max(state.monthly_income_baseline, Decimal("1"))) * 0.5)

    overall = round(budgeting_score * 0.24 + investing_score * 0.20 + savings_score * 0.18 + consistency_score * 0.14 + resilience_score * 0.14 + momentum_score * 0.10, 2)
    drivers = []
    if state.discretionary_30d > state.spend_30d * Decimal("0.30"):
        drivers.append("Discretionary spending is eating into surplus. Tighten food, shopping, and subscription habits.")
    if state.emergency_months < Decimal("3"):
        drivers.append("Emergency cover is still shallow. Keep auto-saving until you cross 3 months of expenses.")
    if state.goal_funding_90d > ZERO:
        drivers.append("Funded goal contributions are active, which turns everyday behavior into visible progress.")
    if state.redirected_90d > ZERO:
        drivers.append("Recent spend and cashback flows are funding real saving or investing contributions instead of one-time cashback.")

    snapshot = GrowthScoreSnapshot.objects.create(
        user=user,
        overall_score=overall,
        budgeting_score=round(budgeting_score, 2),
        investing_score=round(investing_score, 2),
        savings_score=round(savings_score, 2),
        consistency_score=round(consistency_score, 2),
        resilience_score=round(resilience_score, 2),
        momentum_score=round(momentum_score, 2),
        summary={"drivers": drivers, "emergency_months": round(float(state.emergency_months), 2), "positive_cashflow_30d": float(state.positive_cashflow_30d), "redirected_90d": float(state.redirected_90d)},
    )

    UserBehaviorScore.objects.create(
        user=user,
        impulsive_spending_score=round(clamp(100 - ratio(state.discretionary_30d, max(state.spend_30d, Decimal("1"))) * 0.8), 2),
        consistency_score=round(consistency_score, 2),
        wealth_discipline_score=overall,
    )
    user.money_personality_score = overall
    user.save(update_fields=["money_personality_score"])
    return snapshot


def portfolio_mix(user):
    totals = defaultdict(lambda: ZERO)
    for investment in Investment.objects.filter(user=user):
        totals[investment.asset_type] += investment.current_value
    grand_total = sum(totals.values(), ZERO) or Decimal("1")
    return [
        {"name": asset_type, "value": float(amount), "percentage": round(float((amount / grand_total) * HUNDRED), 2)}
        for asset_type, amount in totals.items()
    ]


def dashboard_snapshot(user):
    state = build_financial_state(user)
    snapshot = user.growth_score_snapshots.first() or build_growth_score_snapshot(user, state)
    goal = user.goals.order_by("deadline").first()
    goal_velocity = 0.0
    if goal and goal.target_amount > ZERO:
        goal_velocity = round(float((goal.current_amount / goal.target_amount) * HUNDRED), 2)

    active_triggers = list(user.savings_triggers.filter(is_active=True)[:3])
    top_insights = [trigger.description for trigger in active_triggers]
    if not top_insights:
        top_insights = snapshot.summary.get("drivers", [])[:3]

    funded_contributions = user.wealth_contributions.filter(status__in=[WealthContribution.Statuses.FUNDED, WealthContribution.Statuses.MOCK_FUNDED])
    redirected_investment_value = funded_contributions.aggregate(value=Sum("investment_amount"))["value"] or user.empowerment_allocations.aggregate(value=Sum("investment_amount"))["value"] or ZERO
    redirected_savings_value = funded_contributions.aggregate(value=Sum("savings_amount"))["value"] or user.empowerment_allocations.aggregate(value=Sum("savings_amount"))["value"] or ZERO
    redirected_goal_value = funded_contributions.aggregate(value=Sum("goal_amount"))["value"] or user.empowerment_allocations.aggregate(value=Sum("goal_boost_amount"))["value"] or ZERO

    return {
        "net_worth": float((state.income_90d - state.spend_90d) + state.portfolio_value),
        "monthly_savings": float(state.positive_cashflow_30d),
        "portfolio_value": float(state.portfolio_value),
        "redirected_value": float(state.total_redirected_lifetime),
        "redirected_investment_value": float(redirected_investment_value),
        "redirected_savings_value": float(redirected_savings_value),
        "redirected_goal_value": float(redirected_goal_value),
        "redirected_event_count": funded_contributions.count() or user.empowerment_allocations.count(),
        "pending_contribution_value": float(user.wealth_contributions.filter(status__in=[WealthContribution.Statuses.PLANNED, WealthContribution.Statuses.PENDING]).aggregate(value=Sum("planned_amount"))["value"] or ZERO),
        "pending_contribution_count": user.wealth_contributions.filter(status__in=[WealthContribution.Statuses.PLANNED, WealthContribution.Statuses.PENDING]).count(),
        "growth_score": snapshot.overall_score,
        "budgeting_score": snapshot.budgeting_score,
        "emergency_months": round(float(state.emergency_months), 2),
        "goal_velocity": goal_velocity,
        "active_trigger_count": user.savings_triggers.filter(is_active=True).count(),
        "milestones_unlocked": user.wealth_milestones.filter(status=WealthMilestone.Statuses.ACHIEVED).count(),
        "top_insights": top_insights,
    }


def monthly_spend_series(user):
    buckets = defaultdict(lambda: {"month": "", "spend": ZERO, "redirected": ZERO})
    now = timezone.now()
    for offset in range(5, -1, -1):
        month_date = (now.replace(day=1) - timedelta(days=offset * 30)).replace(day=1)
        label = month_date.strftime("%b")
        buckets[label]["month"] = label

    for transaction in user.transactions.filter(occurred_at__gte=now - timedelta(days=180)).select_related("category"):
        if transaction_flow_group(transaction) != "expense":
            continue
        label = transaction.occurred_at.strftime("%b")
        buckets[label]["month"] = label
        buckets[label]["spend"] += transaction.amount

    for contribution in user.wealth_contributions.filter(created_at__gte=now - timedelta(days=180), status__in=[WealthContribution.Statuses.FUNDED, WealthContribution.Statuses.MOCK_FUNDED]):
        label = (contribution.funded_at or contribution.created_at).strftime("%b")
        buckets[label]["month"] = label
        buckets[label]["redirected"] += contribution.funded_amount

    return [{"month": bucket["month"], "spend": float(bucket["spend"]), "redirected": float(bucket["redirected"])} for bucket in buckets.values() if bucket["month"]]


def analytics_payload(user):
    snapshot = user.growth_score_snapshots.first()
    growth_history = [
        {"date": record.created_at.strftime("%d %b"), "overall_score": record.overall_score, "budgeting_score": record.budgeting_score, "investing_score": record.investing_score}
        for record in user.growth_score_snapshots.all()[:6]
    ]
    category_breakdown = defaultdict(lambda: ZERO)
    for transaction in user.transactions.filter(occurred_at__gte=timezone.now() - timedelta(days=90)).select_related("category"):
        if transaction_flow_group(transaction) != "expense":
            continue
        category_breakdown[transaction_category_label(transaction)] += transaction.amount

    return {
        "monthly_spend": monthly_spend_series(user),
        "growth_history": growth_history,
        "category_breakdown": [{"category": key, "value": float(value)} for key, value in sorted(category_breakdown.items(), key=lambda item: item[1], reverse=True)],
        "insights": snapshot.summary.get("drivers", []) if snapshot else [],
    }
