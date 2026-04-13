from __future__ import annotations

import re
from datetime import timedelta
from dataclasses import dataclass
from decimal import Decimal
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.pipeline import Pipeline
from django.utils import timezone
from apps.finance.models import Cashback, Goal, Transaction
from apps.finance.services import build_financial_state, dashboard_snapshot, process_transaction_for_financial_empowerment, transaction_category_label
from apps.notifications.models import Notification
from .models import AIInsight


@dataclass
class AllocationResult:
    stocks: Decimal
    mutual_funds: Decimal
    savings: Decimal
    strategy: str


def _allocation_training_data():
    return pd.DataFrame(
        [
            {"income": 50000, "spending": 42000, "risk": 0, "strategy": 0},
            {"income": 180000, "spending": 90000, "risk": 2, "strategy": 2},
            {"income": 90000, "spending": 50000, "risk": 1, "strategy": 1},
            {"income": 70000, "spending": 65000, "risk": 0, "strategy": 0},
            {"income": 220000, "spending": 110000, "risk": 2, "strategy": 2},
        ]
    )


def allocation_engine(user, cashback_amount: Decimal) -> AllocationResult:
    df = _allocation_training_data()
    model = RandomForestClassifier(n_estimators=16, random_state=42)
    X = df[["income", "spending", "risk"]]
    y = df["strategy"]
    model.fit(X, y)
    risk_map = {"conservative": 0, "balanced": 1, "aggressive": 2}
    spending = sum(float(t.amount) for t in user.transactions.filter(transaction_type="debit").order_by("-occurred_at")[:30])
    strategy = int(model.predict([[float(user.monthly_income), spending, risk_map.get(user.risk_profile, 1)]])[0])

    mixes = {
        0: (Decimal("0.10"), Decimal("0.25"), Decimal("0.65"), "Capital Shield"),
        1: (Decimal("0.30"), Decimal("0.45"), Decimal("0.25"), "Balanced Momentum"),
        2: (Decimal("0.55"), Decimal("0.35"), Decimal("0.10"), "Alpha Growth"),
    }
    stock_weight, mf_weight, savings_weight, strategy_name = mixes[strategy]
    return AllocationResult(
        stocks=(cashback_amount * stock_weight).quantize(Decimal("0.01")),
        mutual_funds=(cashback_amount * mf_weight).quantize(Decimal("0.01")),
        savings=(cashback_amount * savings_weight).quantize(Decimal("0.01")),
        strategy=strategy_name,
    )


def categorize_transaction(transaction: Transaction) -> str:
    return transaction_category_label(transaction)


def forecast_balances(user):
    state = build_financial_state(user)
    monthly_income = float(state.monthly_income_baseline or 0)
    monthly_spend = float(state.monthly_spend_baseline or 0)
    monthly_surplus = max(monthly_income - monthly_spend, 0)
    portfolio_value = float(state.portfolio_value)

    history = np.array([[1], [2], [3], [4], [5], [6]])
    values = np.array(
        [
            max(portfolio_value - (monthly_surplus * 2.5), 0),
            max(portfolio_value - (monthly_surplus * 2.0), 0),
            max(portfolio_value - (monthly_surplus * 1.5), 0),
            max(portfolio_value - monthly_surplus, 0),
            max(portfolio_value - (monthly_surplus * 0.5), 0),
            portfolio_value,
        ]
    )
    model = LinearRegression().fit(history, values)
    future = model.predict(np.array([[7], [8], [9]])).tolist()
    return {"next_3_months": [round(val, 2) for val in future], "projected_monthly_surplus": round(monthly_surplus, 2)}


def detect_fraud(transaction: Transaction):
    model = IsolationForest(contamination=0.15, random_state=42)
    X = np.array([[2000, 12], [3500, 19], [1200, 9], [78000, 2], [2900, 20], [99999, 3]])
    model.fit(X)
    score = float(model.decision_function([[float(transaction.amount), transaction.occurred_at.hour]])[0])
    return {"score": score, "is_anomaly": score < 0}


def goal_planner(goal: Goal):
    months = max((goal.deadline.year - goal.created_at.date().year) * 12 + goal.deadline.month - goal.created_at.date().month, 1)
    remaining = max(goal.target_amount - goal.current_amount, Decimal("0"))
    monthly = remaining / months
    feasibility = max(10.0, min(97.0, 100 - float(monthly / max(goal.user.monthly_income or 1, 1) * 100)))
    return {"monthly_required": round(float(monthly), 2), "feasibility_score": round(feasibility, 2)}


def _currency(value: float | Decimal) -> str:
    amount = float(value)
    return f"Rs {amount:,.0f}"


def _top_spend_categories(user, days: int = 30):
    cutoff = timezone.now() - timedelta(days=days)
    totals = {}
    for transaction in user.transactions.filter(transaction_type=Transaction.Types.DEBIT, occurred_at__gte=cutoff):
        label = transaction_category_label(transaction)
        totals[label] = totals.get(label, Decimal("0")) + transaction.amount
    return sorted(totals.items(), key=lambda item: item[1], reverse=True)


def _advisor_context(user):
    state = build_financial_state(user)
    summary = dashboard_snapshot(user)
    top_categories = _top_spend_categories(user)
    lead_goal = user.goals.order_by("deadline").first()
    active_triggers = list(user.savings_triggers.filter(is_active=True)[:3])
    latest_allocation = user.empowerment_allocations.first()
    portfolio = list(user.investments.all()[:6])
    return {
        "state": state,
        "summary": summary,
        "top_categories": top_categories,
        "lead_goal": lead_goal,
        "active_triggers": active_triggers,
        "latest_allocation": latest_allocation,
        "portfolio": portfolio,
    }


def _extract_amount(prompt: str):
    match = re.search(r"(\d[\d,]*(?:\.\d+)?)", prompt.replace(",", ""))
    if not match:
        return None
    return float(match.group(1))


def _budgeting_advice(context):
    top_categories = context["top_categories"]
    summary = context["summary"]
    state = context["state"]
    discretionary_categories = {"food", "shopping", "subscriptions", "transport", "travel", "groceries", "entertainment"}
    biggest = next((item for item in top_categories if item[0] in discretionary_categories), top_categories[0] if top_categories else None)
    answer = f"Your fastest budgeting improvement is protecting the monthly surplus of {_currency(summary['monthly_savings'])} and reducing discretionary drag."
    focus = []
    actions = []
    if biggest:
        focus.append(f"Your biggest recent spending bucket is {biggest[0]} at {_currency(biggest[1])}.")
        if biggest[0] in discretionary_categories:
            actions.append(f"Cap {biggest[0]} spending by 10-15% this month and redirect the recovered cash into savings or a goal.")
        else:
            actions.append("Protect your committed investing, then reduce optional day-to-day spend before cutting long-term wealth contributions.")
    if state.emergency_months < Decimal("3"):
        focus.append(f"Emergency cover is only {round(float(state.emergency_months), 1)} months.")
        actions.append("Prioritize safety-buffer growth before increasing lifestyle spending.")
    actions.append("Use the daily check-in to log spend the same day so the dashboard and triggers stay accurate.")
    return answer, focus, actions


def _investment_advice(context):
    portfolio = context["portfolio"]
    latest_allocation = context["latest_allocation"]
    state = context["state"]
    summary = context["summary"]
    mix_line = "Your portfolio is still early-stage, so diversified accumulation matters more than picking one hero stock."
    if portfolio:
        mix_line = "Current holdings show the engine is already splitting capital across savings, diversified funds, and growth baskets."
    answer = f"The optimal investing move right now is to keep auto-redirecting small amounts consistently instead of waiting for perfect timing. {_currency(summary['redirected_value'])} has already been redirected into wealth."
    focus = [mix_line]
    actions = []
    if latest_allocation and latest_allocation.metadata.get("primary_option"):
        focus.append(f"Your most recent allocation strategy is {latest_allocation.metadata['primary_option']}.")
    if state.emergency_months < Decimal("3"):
        actions.append("Keep at least part of each new contribution flowing into your safety bucket until you cross 3 months of expenses.")
    actions.append("For long-term growth, keep the mutual fund and diversified equity buckets as the default first option rather than chasing single-stock moves.")
    actions.append("Use cashback conversions as micro-invest events, then rely on fallback strategies if your cash buffer weakens.")
    return answer, focus, actions


def _savings_advice(context):
    state = context["state"]
    triggers = context["active_triggers"]
    answer = f"Your strongest savings lever is consistency. Right now your emergency buffer covers about {round(float(state.emergency_months), 1)} months."
    focus = []
    actions = []
    for trigger in triggers[:2]:
        focus.append(f"{trigger.title}: potential impact {_currency(trigger.monthly_impact)}.")
        actions.append(f"Act on '{trigger.title}' and try to save about {_currency(trigger.recommended_amount)}.")
    if not triggers:
        actions.append("Add one daily savings check-in this week to increase your reserve automatically.")
    actions.append("Treat cashback as future capital, not spending money.")
    return answer, focus, actions


def _affordability_advice(context, prompt: str):
    amount = _extract_amount(prompt)
    summary = context["summary"]
    state = context["state"]
    if amount is None:
        answer = "I can evaluate affordability, but include the approximate amount so I can compare it against your live cashflow and safety buffer."
        return answer, ["No purchase amount was detected in your question."], ["Ask again with a rupee amount, like 'Can I afford a 15000 phone this month?'"]

    safe_spend = max(float(summary["monthly_savings"]) * 0.7, 0)
    answer = f"A purchase around {_currency(amount)} is {'reasonable' if amount <= safe_spend else 'risky'} given your current monthly surplus of {_currency(summary['monthly_savings'])}."
    focus = [
        f"Monthly surplus available: {_currency(summary['monthly_savings'])}.",
        f"Emergency coverage: {round(float(state.emergency_months), 1)} months.",
    ]
    actions = [
        "If you buy it, avoid reducing scheduled savings or goal funding.",
        "If it is optional and larger than one month of surplus, split it across 2-3 months instead of absorbing it at once.",
    ]
    return answer, focus, actions


def _default_advice(context):
    summary = context["summary"]
    triggers = context["active_triggers"]
    goal = context["lead_goal"]
    answer = f"Your best financial move is to keep the loop between spending, saving, and investing alive. Current growth score is {round(summary['growth_score'], 1)}/100."
    focus = [
        f"Monthly surplus: {_currency(summary['monthly_savings'])}.",
        f"Redirected wealth so far: {_currency(summary['redirected_value'])}.",
    ]
    if goal:
        focus.append(f"Lead goal '{goal.title}' is {round((float(goal.current_amount) / max(float(goal.target_amount), 1)) * 100, 1)}% funded.")
    actions = [f"Act on '{trigger.title}'." for trigger in triggers[:2]]
    if not actions:
        actions = ["Log spending daily and keep cashback conversion active.", "Top up either savings or a long-term investment bucket this week."]
    return answer, focus, actions


def advisor_response(user, prompt: str):
    context = _advisor_context(user)
    prompt_lower = prompt.lower()
    responses = []
    if any(keyword in prompt_lower for keyword in ["afford", "buy", "purchase", "cost"]):
        responses.append(_affordability_advice(context, prompt))
    if any(keyword in prompt_lower for keyword in ["invest", "investment", "portfolio", "stock", "mutual fund", "sip"]):
        responses.append(_investment_advice(context))
    if any(keyword in prompt_lower for keyword in ["save", "saving", "savings", "cashback", "buffer", "emergency"]):
        responses.append(_savings_advice(context))
    if any(keyword in prompt_lower for keyword in ["spend", "budget", "wasting", "expense", "expenses"]):
        responses.append(_budgeting_advice(context))
    if not responses:
        responses.append(_default_advice(context))

    answer = " ".join(response[0] for response in responses[:2])
    focus = []
    actions = []
    seen_focus = set()
    seen_actions = set()
    for _, response_focus, response_actions in responses:
        for item in response_focus:
            if item not in seen_focus:
                seen_focus.add(item)
                focus.append(item)
        for item in response_actions:
            if item not in seen_actions:
                seen_actions.add(item)
                actions.append(item)

    return {
        "prompt": prompt,
        "answer": answer,
        "focus_areas": focus[:3],
        "recommendations": actions[:4],
        "confidence": round(min(0.94, 0.72 + (len(focus) * 0.04)), 2),
    }


def search_insights(user, query: str):
    terms = [term for term in re.findall(r"\w+", query.lower()) if term]
    if not terms:
        return []

    candidates = []
    for trigger in user.savings_triggers.filter(is_active=True):
        candidates.append({"source_type": "trigger", "title": trigger.title, "body": trigger.description, "route": "/dashboard"})
    for milestone in user.wealth_milestones.all()[:6]:
        candidates.append({"source_type": "milestone", "title": milestone.title, "body": milestone.description, "route": "/goals"})
    for goal in user.goals.all()[:6]:
        candidates.append({"source_type": "goal", "title": goal.title, "body": f"Target Rs {goal.target_amount} by {goal.deadline}. Current amount Rs {goal.current_amount}.", "route": "/goals"})
    for allocation in user.empowerment_allocations.all()[:6]:
        candidates.append({"source_type": "allocation", "title": allocation.strategy_name, "body": allocation.rationale + " " + allocation.transaction.merchant, "route": "/transactions"})
    for insight in AIInsight.objects.filter(user=user)[:6]:
        candidates.append({"source_type": "insight", "title": insight.title, "body": insight.body, "route": "/advisor"})
    for notification in Notification.objects.filter(user=user)[:6]:
        candidates.append({"source_type": "notification", "title": notification.title, "body": notification.body, "route": "/notifications"})
    for transaction in user.transactions.all()[:6]:
        candidates.append({"source_type": "transaction", "title": transaction.merchant, "body": f"{transaction_category_label(transaction)} {_currency(transaction.amount)} {transaction.description}", "route": "/transactions"})

    results = []
    for candidate in candidates:
        haystack = f"{candidate['title']} {candidate['body']}".lower()
        score = sum(3 if term in candidate["title"].lower() else 1 for term in terms if term in haystack)
        if score > 0:
            results.append({**candidate, "score": score})

    ranked = sorted(results, key=lambda item: item["score"], reverse=True)[:6]
    return [{"source_type": item["source_type"], "title": item["title"], "body": item["body"], "route": item["route"]} for item in ranked]


def create_cashback(transaction: Transaction):
    if transaction.transaction_type != Transaction.Types.DEBIT:
        return None
    process_transaction_for_financial_empowerment(transaction)
    return Cashback.objects.filter(transaction=transaction).first()
