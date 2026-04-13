from __future__ import annotations

from decimal import Decimal, ROUND_CEILING
from django.db import transaction as db_transaction
from django.db.models import Sum
from django.utils import timezone
from apps.ai_engine.models import AIInsight
from apps.notifications.models import Notification
from .gateway import RazorpayGatewayError, create_razorpay_order, razorpay_is_configured, verify_checkout_signature, verify_webhook_signature
from .metrics import ZERO, FinancialState, build_financial_state, build_growth_score_snapshot, money, ratio, round_up_to_next_fifty, transaction_category_label, update_goal_metrics
from .models import Cashback, EmpowermentAllocation, GrowthScoreSnapshot, Investment, SavingsTrigger, Transaction, WealthContribution, WealthMilestone, WealthSweepRule


def lead_goal(user):
    goal = user.goals.order_by("deadline").first()
    goal_gap_ratio = 0.0
    if goal:
        remaining = max(goal.target_amount - goal.current_amount, ZERO)
        goal_gap_ratio = float(remaining / max(goal.target_amount, Decimal("1")))
    return goal, goal_gap_ratio


FUNDED_CONTRIBUTION_STATUSES = {WealthContribution.Statuses.FUNDED, WealthContribution.Statuses.MOCK_FUNDED}


def get_or_create_sweep_rule(user):
    return WealthSweepRule.objects.get_or_create(
        user=user,
        defaults={
            "mode": WealthSweepRule.Modes.HYBRID,
            "round_up_base": 50,
            "spend_percent": Decimal("0"),
            "auto_fund_enabled": True,
            "redirect_cashback_enabled": True,
            "provider": WealthSweepRule.Providers.MOCK,
            "currency": getattr(user, "preferred_currency", "INR") or "INR",
        },
    )[0]


def strategy_candidates(user, state: FinancialState, redirected_amount: Decimal, channel: str):
    goal, goal_gap_ratio = lead_goal(user)
    risk_profile = user.risk_profile or "balanced"
    candidates = [
        {
            "code": "safety_net_builder",
            "title": "Safety Net Builder",
            "description": "Prioritize liquidity until the emergency buffer can absorb a shock without derailing goals.",
            "weights": {"investment": Decimal("0.18"), "savings": Decimal("0.62"), "goal": Decimal("0.20")},
            "fit_score": 96 if state.emergency_months < Decimal("2.5") else 58,
            "thesis": "Best when resilience is still shallow and cash access matters more than upside.",
        },
        {
            "code": "goal_accelerator",
            "title": "Goal Accelerator",
            "description": "Push more of the redirected value into the nearest goal so progress stays visible and motivating.",
            "weights": {"investment": Decimal("0.28"), "savings": Decimal("0.17"), "goal": Decimal("0.55")},
            "fit_score": 90 if goal and goal_gap_ratio > 0.30 else 52,
            "thesis": "Strong when a live goal is underfunded and visible progress is the retention loop.",
        },
        {
            "code": "balanced_momentum",
            "title": "Balanced Momentum",
            "description": "Blend investing, safety, and goal funding so each transaction compounds across all three.",
            "weights": {"investment": Decimal("0.52"), "savings": Decimal("0.20"), "goal": Decimal("0.28")},
            "fit_score": 78 if risk_profile == "balanced" else 66,
            "thesis": "Default all-weather path for users who need growth without losing flexibility.",
        },
        {
            "code": "alpha_growth",
            "title": "Alpha Growth",
            "description": "Favor diversified growth assets while keeping a modest safety layer and a smaller goal drip.",
            "weights": {"investment": Decimal("0.68"), "savings": Decimal("0.10"), "goal": Decimal("0.22")},
            "fit_score": 88 if risk_profile == "aggressive" else 60,
            "thesis": "Strongest long-term upside when risk appetite is healthy and buffers are acceptable.",
        },
        {
            "code": "capital_shield",
            "title": "Capital Shield",
            "description": "Lean toward lower-volatility savings and balanced funds before pushing harder into equities.",
            "weights": {"investment": Decimal("0.34"), "savings": Decimal("0.42"), "goal": Decimal("0.24")},
            "fit_score": 86 if risk_profile == "conservative" else 61,
            "thesis": "Suitable when trust, downside control, and steady habit formation matter most.",
        },
    ]

    if channel == "cashback":
        for candidate in candidates:
            if candidate["code"] in {"balanced_momentum", "alpha_growth"}:
                candidate["fit_score"] += 5

    if redirected_amount >= Decimal("500"):
        for candidate in candidates:
            if candidate["code"] in {"goal_accelerator", "balanced_momentum"}:
                candidate["fit_score"] += 4

    return goal, sorted(candidates, key=lambda item: item["fit_score"], reverse=True)[:3]


def determine_empowerment_mix(user, state: FinancialState, transaction: Transaction | None, redirect_seed: Decimal = ZERO, channel: str = "spend"):
    goal, _ = lead_goal(user)
    category_multipliers = {
        "subscriptions": Decimal("1.55"),
        "food": Decimal("1.35"),
        "transport": Decimal("1.20"),
        "shopping": Decimal("1.45"),
        "groceries": Decimal("1.10"),
        "travel": Decimal("1.40"),
        "investments": Decimal("0.75"),
        "savings": Decimal("0.65"),
        "income": Decimal("0.40"),
        "cashback": Decimal("1.00"),
    }
    base_rate = {"conservative": Decimal("0.020"), "balanced": Decimal("0.030"), "aggressive": Decimal("0.040")}.get(user.risk_profile, Decimal("0.030"))
    category_label = transaction_category_label(transaction) if transaction else "cashback"
    round_up = round_up_to_next_fifty(transaction.amount) if transaction and channel == "spend" else ZERO
    if transaction and channel == "spend":
        raw_bonus = transaction.amount * base_rate * category_multipliers.get(category_label, Decimal("1.00"))
        minimum_nudge = min(max(transaction.amount * Decimal("0.02"), Decimal("5")), Decimal("60"))
        behavioral_bonus = money(min(max(raw_bonus, minimum_nudge), Decimal("1500")))
    elif channel == "cashback" and redirect_seed > ZERO:
        cashback_boost = min(max(redirect_seed * Decimal("0.35"), Decimal("5")), Decimal("75"))
        behavioral_bonus = money(cashback_boost)
    else:
        behavioral_bonus = ZERO
    redirected_amount = money(round_up + behavioral_bonus + redirect_seed)

    _, options = strategy_candidates(user, state, redirected_amount, channel)
    selected = options[0]
    selection_reason = selected["thesis"]
    if selected["code"] == "goal_accelerator" and goal:
        selection_reason = f"{goal.title} is still underfunded, so the strongest intrinsic loop is faster goal progress."
    elif selected["code"] == "safety_net_builder":
        selection_reason = "Emergency liquidity is still thin, so resilience comes before taking extra risk."
    elif selected["code"] == "alpha_growth":
        selection_reason = "Your profile can tolerate a stronger equity tilt, so growth gets the first shot while the rest stays diversified."

    strategy_options = [
        {
            "title": option["title"],
            "code": option["code"],
            "description": option["description"],
            "fit_score": option["fit_score"],
            "thesis": option["thesis"],
        }
        for option in options
    ]

    return {
        "strategy_name": selected["title"],
        "strategy_code": selected["code"],
        "selection_reason": selection_reason,
        "goal_label": goal.title if goal else "No active goal yet",
        "round_up": money(round_up),
        "behavioral_bonus": behavioral_bonus,
        "cashback_bonus": money(redirect_seed),
        "redirected_amount": redirected_amount,
        "investment_amount": money(redirected_amount * selected["weights"]["investment"]),
        "savings_amount": money(redirected_amount * selected["weights"]["savings"]),
        "goal_boost_amount": money(redirected_amount * selected["weights"]["goal"]),
        "strategy_options": strategy_options,
    }


def upsert_investment_position(user, asset_name: str, asset_type: str, amount: Decimal, roi_percentage: float):
    if amount <= ZERO:
        return
    growth_factor = Decimal(str(1 + (roi_percentage / 100)))
    defaults = {"asset_type": asset_type, "allocated_amount": amount, "current_value": money(amount * growth_factor), "roi_percentage": roi_percentage}
    investment, created = Investment.objects.get_or_create(user=user, asset_name=asset_name, defaults=defaults)
    if created:
        return
    investment.allocated_amount = money(investment.allocated_amount + amount)
    investment.current_value = money(investment.current_value + (amount * growth_factor))
    investment.roi_percentage = roi_percentage
    investment.save(update_fields=["allocated_amount", "current_value", "roi_percentage", "updated_at"])


def apply_goal_boost(user, amount: Decimal):
    if amount <= ZERO:
        return None
    goal = user.goals.order_by("deadline").first()
    if not goal:
        return None
    goal.current_amount = money(min(goal.current_amount + amount, goal.target_amount))
    goal.save(update_fields=["current_amount", "updated_at"])
    update_goal_metrics(goal)
    return goal


def investment_split(user, amount: Decimal):
    if amount <= ZERO:
        return {"stock": ZERO, "mutual_fund": ZERO, "esg": ZERO}
    esg_share = money(amount * Decimal("0.12"))
    core_amount = money(max(amount - esg_share, ZERO))
    stock_bias = Decimal("0.65") if user.risk_profile == "aggressive" else Decimal("0.20") if user.risk_profile == "conservative" else Decimal("0.45")
    stock_share = money(core_amount * stock_bias)
    mutual_fund_share = money(max(core_amount - stock_share, ZERO))
    return {"stock": stock_share, "mutual_fund": mutual_fund_share, "esg": esg_share}


def apply_allocation_to_positions(user, allocation: dict):
    split = investment_split(user, allocation["investment_amount"])
    upsert_investment_position(user, "Auto Equity Growth Basket", Investment.AssetTypes.STOCK, split["stock"], 12.4)
    upsert_investment_position(user, "Balanced Flexi Wealth Fund", Investment.AssetTypes.MUTUAL_FUND, split["mutual_fund"], 9.2)
    upsert_investment_position(user, "Emergency Shield Wallet", Investment.AssetTypes.SAVINGS, allocation["savings_amount"], 4.0)
    upsert_investment_position(user, "ESG Future Builder", Investment.AssetTypes.ESG, split["esg"], 10.1)
    boosted_goal = apply_goal_boost(user, allocation["goal_boost_amount"])
    return split, boosted_goal


def create_empowerment_record(user, transaction: Transaction, allocation: dict, rationale: str, split: dict, channel: str):
    return EmpowermentAllocation.objects.create(
        user=user,
        transaction=transaction,
        strategy_name=allocation["strategy_name"],
        redirected_amount=allocation["redirected_amount"],
        round_up_amount=allocation["round_up"],
        behavioral_bonus=allocation["behavioral_bonus"],
        investment_amount=allocation["investment_amount"],
        savings_amount=allocation["savings_amount"],
        goal_boost_amount=allocation["goal_boost_amount"],
        rationale=rationale,
        metadata={
            "channel": channel,
            "category": transaction_category_label(transaction),
            "selection_reason": allocation["selection_reason"],
            "goal_label": allocation["goal_label"],
            "primary_option": allocation["strategy_name"],
            "advisory_only": True,
            "strategy_options": allocation["strategy_options"],
            "cashback_bonus": float(allocation["cashback_bonus"]),
            "stock_share": float(split["stock"]),
            "mutual_fund_share": float(split["mutual_fund"]),
            "esg_share": float(split["esg"]),
        },
    )


def contribution_split(user, amount: Decimal, transaction: Transaction | None = None):
    state = build_financial_state(user)
    allocation = determine_empowerment_mix(user, state, transaction, redirect_seed=money(amount), channel="funded")
    return allocation


def create_contribution_record(user, *, transaction: Transaction | None, source_type: str, amount: Decimal, provider: str, notes: dict | None = None):
    allocation = contribution_split(user, amount, transaction)
    return WealthContribution.objects.create(
        user=user,
        transaction=transaction,
        source_type=source_type,
        status=WealthContribution.Statuses.PLANNED,
        provider=provider,
        planned_amount=money(amount),
        funded_amount=ZERO,
        currency=getattr(user, "preferred_currency", "INR") or "INR",
        strategy_name=allocation["strategy_name"],
        investment_amount=allocation["investment_amount"],
        savings_amount=allocation["savings_amount"],
        goal_amount=allocation["goal_boost_amount"],
        notes={
            "selection_reason": allocation["selection_reason"],
            "strategy_options": allocation["strategy_options"],
            **(notes or {}),
        },
    )


def apply_funded_contribution(contribution: WealthContribution):
    if contribution.applied_at or contribution.status not in FUNDED_CONTRIBUTION_STATUSES:
        return contribution
    allocation = {
        "investment_amount": contribution.investment_amount,
        "savings_amount": contribution.savings_amount,
        "goal_boost_amount": contribution.goal_amount,
    }
    split, boosted_goal = apply_allocation_to_positions(contribution.user, allocation)
    contribution.notes = {
        **(contribution.notes or {}),
        "applied_split": {
            "stock_share": float(split["stock"]),
            "mutual_fund_share": float(split["mutual_fund"]),
            "esg_share": float(split["esg"]),
            "goal_boosted": boosted_goal.title if boosted_goal else None,
        },
    }
    contribution.applied_at = timezone.now()
    contribution.save(update_fields=["notes", "applied_at", "updated_at"])
    return contribution


def mark_contribution_funded(contribution: WealthContribution, *, funded_amount: Decimal | None = None, provider_payment_id: str = "", provider_signature: str = "", mock: bool = False):
    contribution.status = WealthContribution.Statuses.MOCK_FUNDED if mock else WealthContribution.Statuses.FUNDED
    contribution.funded_amount = money(funded_amount or contribution.planned_amount)
    contribution.provider_payment_id = provider_payment_id or contribution.provider_payment_id
    contribution.provider_signature = provider_signature or contribution.provider_signature
    contribution.funded_at = timezone.now()
    contribution.save(update_fields=["status", "funded_amount", "provider_payment_id", "provider_signature", "funded_at", "updated_at"])
    apply_funded_contribution(contribution)
    upsert_notification(
        contribution.user,
        "Wealth sweep funded",
        f"{money(contribution.funded_amount)} from {contribution.get_source_type_display().lower()} was funded into {contribution.strategy_name}.",
        "wealth_sweep",
        f"wealth-contribution-{contribution.id}",
        {"contribution_id": contribution.id, "status": contribution.status},
    )
    return contribution


def round_up_amount(amount: Decimal, base: int) -> Decimal:
    base_decimal = Decimal(str(base))
    if base <= 0:
        return ZERO
    rounded = (amount / base_decimal).to_integral_value(rounding=ROUND_CEILING) * base_decimal
    return money(max(rounded - amount, ZERO))


def planned_round_up_for_transaction(user, transaction: Transaction):
    rule = get_or_create_sweep_rule(user)
    if not rule.is_enabled or rule.mode == WealthSweepRule.Modes.CASHBACK_ONLY:
        return None

    if rule.mode == WealthSweepRule.Modes.PERCENT and rule.spend_percent > ZERO:
        return money(transaction.amount * (rule.spend_percent / Decimal("100")))

    if rule.mode in {WealthSweepRule.Modes.ROUND_UP, WealthSweepRule.Modes.HYBRID}:
        return round_up_amount(transaction.amount, rule.round_up_base)

    return None


def planned_cashback_redirect(user, cashback_amount: Decimal):
    rule = get_or_create_sweep_rule(user)
    if not rule.is_enabled or not rule.redirect_cashback_enabled:
        return None
    return money(cashback_amount)


def fund_contribution_or_prepare_payment(contribution: WealthContribution, *, force_fund: bool = False):
    rule = get_or_create_sweep_rule(contribution.user)
    if contribution.status in FUNDED_CONTRIBUTION_STATUSES:
        return {"mode": "funded", "status": contribution.status}
    provider = rule.provider if razorpay_is_configured() else WealthSweepRule.Providers.MOCK
    contribution.provider = provider
    contribution.save(update_fields=["provider", "updated_at"])

    if provider == WealthSweepRule.Providers.MOCK and (rule.auto_fund_enabled or force_fund):
        mark_contribution_funded(contribution, funded_amount=contribution.planned_amount, mock=True)
        return {"mode": "mock", "status": contribution.status}

    contribution.status = WealthContribution.Statuses.PENDING
    contribution.save(update_fields=["status", "updated_at"])
    if provider == WealthSweepRule.Providers.RAZORPAY:
        order = create_razorpay_order(
            amount_paise=int(contribution.planned_amount * 100),
            currency=contribution.currency,
            receipt=f"wealth_contribution_{contribution.id}",
            notes={"contribution_id": str(contribution.id), "source_type": contribution.source_type},
        )
        contribution.provider_order_id = order.get("id", "")
        contribution.save(update_fields=["provider_order_id", "updated_at"])
        return {"mode": "razorpay", "order": order}

    return {"mode": "manual", "status": contribution.status}


def ensure_real_sweep_for_transaction(transaction: Transaction):
    rule = get_or_create_sweep_rule(transaction.user)
    amount = planned_round_up_for_transaction(transaction.user, transaction)
    if not amount or amount <= ZERO:
        return None
    source_type = WealthContribution.SourceTypes.PERCENT if rule.mode == WealthSweepRule.Modes.PERCENT else WealthContribution.SourceTypes.ROUND_UP
    existing = transaction.wealth_contributions.filter(source_type=source_type).first()
    if existing:
        return existing
    contribution = create_contribution_record(
        transaction.user,
        transaction=transaction,
        source_type=source_type,
        amount=amount,
        provider=rule.provider,
        notes={"source": "transaction_round_up", "sweep_mode": rule.mode},
    )
    fund_contribution_or_prepare_payment(contribution)
    return contribution


def create_real_cashback_contribution(user, *, cashback_amount: Decimal, occurred_at, payment_channel: str, transaction: Transaction | None = None):
    amount = planned_cashback_redirect(user, cashback_amount)
    if not amount or amount <= ZERO:
        return None

    reward_transaction = transaction
    if reward_transaction is None:
        reward_transaction = Transaction.objects.create(
            user=user,
            amount=money(amount),
            currency=getattr(user, "preferred_currency", "INR") or "INR",
            transaction_type=Transaction.Types.CREDIT,
            merchant=f"{payment_channel.upper()} Cashback",
            description="Actual cashback received and redirected into wealth buckets.",
            source=payment_channel,
            occurred_at=occurred_at,
            ai_category="cashback",
        )

    contribution = create_contribution_record(
        user,
        transaction=reward_transaction,
        source_type=WealthContribution.SourceTypes.CASHBACK,
        amount=amount,
        provider=get_or_create_sweep_rule(user).provider,
        notes={"source": "cashback_received", "payment_channel": payment_channel},
    )
    fund_contribution_or_prepare_payment(contribution)
    return contribution


def build_savings_trigger_specs(user, state: FinancialState):
    specs = []
    month_start = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    recent_month_txns = list(user.transactions.filter(occurred_at__gte=month_start))
    projected_round_up = (
        user.wealth_contributions.filter(
            created_at__gte=month_start,
            source_type__in=[WealthContribution.SourceTypes.ROUND_UP, WealthContribution.SourceTypes.PERCENT],
        ).aggregate(total=Sum("planned_amount"))["total"]
        or ZERO
    )
    if projected_round_up > ZERO:
        specs.append({"trigger_type": SavingsTrigger.TriggerTypes.ROUND_UP, "title": "Sweep spare change into wealth", "description": "Your round-up engine is already unlocking spare change this month. Sweep it directly into investing and goals.", "recommended_amount": projected_round_up, "monthly_impact": projected_round_up, "severity": "low", "metadata": {"source": "round_up_projection"}})

    subscription_total = ZERO
    recurring_merchants = []
    weekend_total = ZERO
    weekday_total = ZERO
    for transaction in recent_month_txns:
        if transaction.transaction_type != Transaction.Types.DEBIT:
            continue
        category = transaction_category_label(transaction)
        if category == "subscriptions" or "subscription" in transaction.description.lower():
            subscription_total += transaction.amount
            recurring_merchants.append(transaction.merchant)
        if transaction.occurred_at.weekday() >= 5:
            weekend_total += transaction.amount
        else:
            weekday_total += transaction.amount

    if subscription_total > ZERO:
        specs.append({"trigger_type": SavingsTrigger.TriggerTypes.SUBSCRIPTION, "title": "Trim recurring subscription drag", "description": "Recurring subscriptions are one of the easiest sources of instant budget recovery.", "recommended_amount": money(subscription_total * Decimal("0.35")), "monthly_impact": subscription_total, "severity": "high" if subscription_total > Decimal("1500") else "medium", "metadata": {"merchants": recurring_merchants}})
    if weekend_total > ZERO and weekend_total > weekday_total * Decimal("0.55"):
        specs.append({"trigger_type": SavingsTrigger.TriggerTypes.WEEKEND, "title": "Set a weekend spending guardrail", "description": "Weekend discretionary spend is the clearest place to create effortless savings without touching essentials.", "recommended_amount": money(weekend_total * Decimal("0.20")), "monthly_impact": weekend_total, "severity": "medium", "metadata": {"weekend_total": float(weekend_total)}})

    goal = user.goals.order_by("deadline").first()
    if goal:
        gap = max(goal.monthly_required - max(state.positive_cashflow_30d, ZERO), ZERO)
        if gap > ZERO:
            specs.append({"trigger_type": SavingsTrigger.TriggerTypes.GOAL, "title": f"Close the gap on {goal.title}", "description": "The strongest retention loop is visible goal progress. A small weekly sweep would keep this goal moving.", "recommended_amount": money(gap), "monthly_impact": money(gap), "severity": "high" if gap > Decimal("5000") else "medium", "metadata": {"goal_id": goal.id, "goal_title": goal.title}})
    if state.income_30d > ZERO:
        payday_sweep = money(min(state.income_30d * Decimal("0.08"), Decimal("15000")))
        specs.append({"trigger_type": SavingsTrigger.TriggerTypes.PAYDAY, "title": "Turn payday into a wealth ritual", "description": "Lock in a fixed percentage of each salary credit before lifestyle spend absorbs it.", "recommended_amount": payday_sweep, "monthly_impact": payday_sweep, "severity": "low", "metadata": {"source": "salary_sweep"}})
    return specs


def upsert_notification(user, title: str, body: str, notification_type: str, code: str, payload: dict | None = None):
    Notification.objects.update_or_create(
        user=user,
        title=title,
        defaults={"body": body, "notification_type": notification_type, "payload": {"code": code, **(payload or {})}, "is_read": False},
    )


def sync_triggers(user, state: FinancialState):
    specs = build_savings_trigger_specs(user, state)
    active_ids = []
    for spec in specs:
        trigger, _ = SavingsTrigger.objects.update_or_create(user=user, trigger_type=spec["trigger_type"], title=spec["title"], defaults={**spec, "is_active": True})
        active_ids.append(trigger.id)
    user.savings_triggers.exclude(id__in=active_ids).update(is_active=False)
    return list(user.savings_triggers.filter(id__in=active_ids))


def apply_cashback_conversion(user, amount: Decimal, occurred_at, payment_channel: str):
    if amount <= ZERO:
        return None
    return create_real_cashback_contribution(
        user,
        cashback_amount=money(amount),
        occurred_at=occurred_at,
        payment_channel=payment_channel,
    )


def add_manual_savings(user, amount: Decimal, payment_channel: str):
    if amount <= ZERO:
        return
    upsert_investment_position(user, "Emergency Shield Wallet", Investment.AssetTypes.SAVINGS, money(amount), 4.0)
    upsert_notification(
        user,
        "Savings logged into your reserve",
        f"Rs {money(amount)} was added to your Emergency Shield Wallet from your {payment_channel.upper()} check-in.",
        "savings",
        f"savings-topup-{timezone.now().strftime('%Y%m%d%H%M%S')}",
        {"amount": float(money(amount))},
    )


def grant_milestone_reward(user, milestone: WealthMilestone, state: FinancialState):
    reward_amount = Decimal("250") if milestone.milestone_type != WealthMilestone.Types.GROWTH_SCORE else Decimal("400")
    contribution = create_contribution_record(
        user,
        transaction=None,
        source_type=WealthContribution.SourceTypes.REWARD,
        amount=reward_amount,
        provider=WealthSweepRule.Providers.MOCK,
        notes={"source": "milestone_reward", "milestone_type": milestone.milestone_type, "platform_reward": True},
    )
    contribution = mark_contribution_funded(contribution, funded_amount=reward_amount, mock=True)
    strategy_options = (contribution.notes or {}).get("strategy_options") or []
    reward_payload = {
        "amount": float(reward_amount),
        "strategy_name": contribution.strategy_name,
        "fallback_titles": [option["title"] for option in strategy_options[1:]],
        "goal_boosted": ((contribution.notes or {}).get("applied_split") or {}).get("goal_boosted"),
        "stock_share": (((contribution.notes or {}).get("applied_split") or {}).get("stock_share") or 0),
        "mutual_fund_share": (((contribution.notes or {}).get("applied_split") or {}).get("mutual_fund_share") or 0),
        "esg_share": (((contribution.notes or {}).get("applied_split") or {}).get("esg_share") or 0),
        "contribution_id": contribution.id,
    }
    upsert_notification(
        user,
        f"Milestone reward deployed: {milestone.title}",
        f"A Rs {reward_amount} platform reward was routed via {contribution.strategy_name}."
        + (f" {reward_payload['goal_boosted']} also moved forward." if reward_payload["goal_boosted"] else ""),
        "milestone",
        f"milestone-reward-{milestone.milestone_type}",
        reward_payload,
    )
    return reward_payload


def update_milestones(user, state: FinancialState, snapshot: GrowthScoreSnapshot):
    goal = user.goals.order_by("deadline").first()
    goal_progress = money((goal.current_amount / goal.target_amount) * Decimal("100")) if goal and goal.target_amount > ZERO else ZERO
    specs = [
        {"milestone_type": WealthMilestone.Types.REDIRECTED, "title": "Redirected capital builder", "description": "Convert everyday spending into auto-investing and goal progress.", "target_value": Decimal("10000"), "current_value": state.total_redirected_lifetime, "celebration_copy": "You have redirected Rs 10k into wealth-building momentum."},
        {"milestone_type": WealthMilestone.Types.GROWTH_SCORE, "title": "Growth score 75", "description": "Sustain healthy budgeting, savings, and investing behavior until your score reaches 75.", "target_value": Decimal("75"), "current_value": money(snapshot.overall_score), "celebration_copy": "Your financial behavior has entered a high-discipline zone."},
        {"milestone_type": WealthMilestone.Types.EMERGENCY, "title": "Three-month safety buffer", "description": "Build an emergency reserve that covers at least three months of spending.", "target_value": Decimal("3"), "current_value": money(state.emergency_months), "celebration_copy": "Your emergency buffer is now strong enough to absorb real-life shocks."},
        {"milestone_type": WealthMilestone.Types.GOAL_PROGRESS, "title": "Goal momentum 50%", "description": "Push your leading goal past the halfway mark so progress feels intrinsically rewarding.", "target_value": Decimal("50"), "current_value": goal_progress, "celebration_copy": "You crossed the halfway line on a live wealth goal."},
    ]
    results = []
    for spec in specs:
        achieved = spec["current_value"] >= spec["target_value"]
        progress = round(ratio(spec["current_value"], max(spec["target_value"], Decimal("1"))), 2)
        milestone, created = WealthMilestone.objects.get_or_create(
            user=user,
            milestone_type=spec["milestone_type"],
            title=spec["title"],
            defaults={**spec, "progress_percentage": progress, "status": WealthMilestone.Statuses.ACHIEVED if achieved else WealthMilestone.Statuses.ACTIVE, "achieved_at": timezone.now() if achieved else None},
        )
        was_achieved = milestone.status == WealthMilestone.Statuses.ACHIEVED and not created
        milestone.description = spec["description"]
        milestone.target_value = spec["target_value"]
        milestone.current_value = money(spec["current_value"])
        milestone.progress_percentage = progress
        milestone.celebration_copy = spec["celebration_copy"]
        milestone.status = WealthMilestone.Statuses.ACHIEVED if achieved else WealthMilestone.Statuses.ACTIVE
        if achieved and not was_achieved:
            milestone.achieved_at = timezone.now()
        if achieved and (created or not was_achieved):
            reward_payload = grant_milestone_reward(user, milestone, state)
            milestone.metadata = {**(milestone.metadata or {}), "reward": reward_payload}
            milestone.celebration_copy = spec["celebration_copy"] + f" Reward deployed: Rs {reward_payload['amount']} into {reward_payload['strategy_name']}."
            upsert_notification(user, f"Milestone unlocked: {milestone.title}", milestone.celebration_copy, "milestone", f"milestone-{milestone.milestone_type}", {"milestone_id": milestone.id, "reward": reward_payload})
        milestone.save()
        results.append(milestone)
    return results


def upsert_growth_insight(user, snapshot: GrowthScoreSnapshot, triggers):
    titles = [trigger.title for trigger in list(triggers)[:2]]
    body = f"Growth score updated to {round(snapshot.overall_score, 1)}. "
    if titles:
        body += "Focus next on: " + ", ".join(titles) + "."
    elif snapshot.summary.get("drivers"):
        body += snapshot.summary["drivers"][0]
    else:
        body += "Keep redirecting spend into investments, savings, and goal progress."
    AIInsight.objects.update_or_create(user=user, insight_type="growth_coach", defaults={"title": "Financial empowerment engine updated", "body": body, "confidence": 0.84, "metadata": {"growth_score": snapshot.overall_score}})


def sync_legacy_cashback_record(user, transaction: Transaction, allocation: dict):
    Cashback.objects.update_or_create(user=user, transaction=transaction, defaults={"amount": allocation["redirected_amount"], "stocks_allocation": money(allocation["investment_amount"] * Decimal("0.5")), "mutual_funds_allocation": money(allocation["investment_amount"] * Decimal("0.5")), "savings_allocation": allocation["savings_amount"]})


def refresh_financial_state(user):
    state = build_financial_state(user)
    for goal in user.goals.all():
        update_goal_metrics(goal)
    snapshot = build_growth_score_snapshot(user, state)
    triggers = sync_triggers(user, state)
    milestones = update_milestones(user, state, snapshot)
    upsert_growth_insight(user, snapshot, triggers)
    return {"state": state, "snapshot": snapshot, "triggers": triggers, "milestones": milestones}


def create_contribution_checkout(contribution: WealthContribution):
    return fund_contribution_or_prepare_payment(contribution, force_fund=True)


def verify_contribution_checkout(*, contribution: WealthContribution, payment_id: str, signature: str):
    if contribution.provider != WealthSweepRule.Providers.RAZORPAY or not contribution.provider_order_id:
        raise RazorpayGatewayError("Contribution is not awaiting Razorpay verification.")
    if not verify_checkout_signature(order_id=contribution.provider_order_id, payment_id=payment_id, signature=signature):
        raise RazorpayGatewayError("Invalid payment signature.")
    return mark_contribution_funded(
        contribution,
        funded_amount=contribution.planned_amount,
        provider_payment_id=payment_id,
        provider_signature=signature,
        mock=False,
    )


def reconcile_razorpay_webhook(*, body: bytes, signature: str):
    if not verify_webhook_signature(body=body, signature=signature):
        raise RazorpayGatewayError("Invalid webhook signature.")

    payload = __import__("json").loads(body.decode("utf-8"))
    payment_entity = ((payload.get("payload") or {}).get("payment") or {}).get("entity") or {}
    order_id = payment_entity.get("order_id", "")
    payment_id = payment_entity.get("id", "")
    if not order_id:
        return None

    contribution = WealthContribution.objects.filter(provider_order_id=order_id).first()
    if not contribution:
        return None
    if contribution.status not in FUNDED_CONTRIBUTION_STATUSES:
        mark_contribution_funded(contribution, funded_amount=contribution.planned_amount, provider_payment_id=payment_id, mock=False)
    return contribution


def contribution_feedback(contribution: WealthContribution | None):
    if not contribution:
        return None
    strategy_options = ((contribution.notes or {}).get("strategy_options") or [])
    return {
        "id": contribution.id,
        "status": contribution.status,
        "source_type": contribution.source_type,
        "amount": float(contribution.funded_amount or contribution.planned_amount),
        "strategy_name": contribution.strategy_name,
        "selection_reason": (contribution.notes or {}).get("selection_reason", ""),
        "fallback_options": [option["title"] for option in strategy_options[1:]],
        "investment_amount": float(contribution.investment_amount),
        "savings_amount": float(contribution.savings_amount),
        "goal_amount": float(contribution.goal_amount),
    }


@db_transaction.atomic
def record_daily_check_in(user, payload: dict):
    spending_transaction = None
    spending_contribution = None
    cashback_contribution = None
    occurred_at = payload["occurred_at"]
    payment_channel = payload["payment_channel"]
    description = payload.get("description", "")

    if payload["spending_amount"] > ZERO:
        spending_transaction = Transaction.objects.create(
            user=user,
            amount=money(payload["spending_amount"]),
            currency=payload["currency"],
            transaction_type=Transaction.Types.DEBIT,
            merchant=payload["merchant"],
            description=description or "Manual daily spending log",
            source=payment_channel,
            occurred_at=occurred_at,
        )
        from apps.ai_engine.services import categorize_transaction

        spending_transaction.ai_category = categorize_transaction(spending_transaction)
        spending_transaction.save(update_fields=["ai_category"])
        process_transaction_for_financial_empowerment(spending_transaction)
        spending_contribution = spending_transaction.wealth_contributions.exclude(
            source_type=WealthContribution.SourceTypes.CASHBACK
        ).first()

    if payload["savings_amount"] > ZERO:
        add_manual_savings(user, payload["savings_amount"], payment_channel)

    if payload["cashback_amount"] > ZERO:
        cashback_contribution = create_real_cashback_contribution(
            user,
            cashback_amount=money(payload["cashback_amount"]),
            occurred_at=occurred_at,
            payment_channel=payment_channel,
        )

    refreshed = refresh_financial_state(user)
    latest_allocation = spending_transaction.empowerment_allocation if spending_transaction and hasattr(spending_transaction, "empowerment_allocation") else None
    return {
        "message": "Daily check-in captured and folded into your wealth engine.",
        "growth_score": refreshed["snapshot"].overall_score,
        "spending_transaction_id": spending_transaction.id if spending_transaction else None,
        "latest_strategy": latest_allocation.strategy_name if latest_allocation else None,
        "spend_sweep": contribution_feedback(spending_contribution),
        "cashback_conversion": contribution_feedback(cashback_contribution),
    }


@db_transaction.atomic
def process_transaction_for_financial_empowerment(transaction: Transaction):
    if transaction.transaction_type != Transaction.Types.DEBIT or hasattr(transaction, "empowerment_allocation"):
        return refresh_financial_state(transaction.user)
    if transaction_category_label(transaction) in {"investments", "savings"}:
        return refresh_financial_state(transaction.user)
    state = build_financial_state(transaction.user)
    allocation = determine_empowerment_mix(transaction.user, state, transaction)
    split = investment_split(transaction.user, allocation["investment_amount"])
    create_empowerment_record(
        transaction.user,
        transaction,
        allocation,
        "Advisory strategy only: this spend generated a recommended wealth-routing plan. Actual balances change only after a funded round-up, cashback, or platform reward contribution.",
        split,
        "spend",
    )
    contribution = ensure_real_sweep_for_transaction(transaction)
    fallback_titles = [option["title"] for option in allocation["strategy_options"][1:]]
    contribution_text = "No real sweep was created for this spend."
    if contribution:
        contribution_amount = contribution.funded_amount if contribution.status in FUNDED_CONTRIBUTION_STATUSES else contribution.planned_amount
        contribution_text = (
            f"A real {contribution.get_source_type_display().lower()} of Rs {contribution_amount} is "
            f"{'already funded' if contribution.status in FUNDED_CONTRIBUTION_STATUSES else 'awaiting funding'} via {contribution.strategy_name}."
        )
    upsert_notification(
        transaction.user,
        "Spend converted into wealth progress",
        f"Strategy recommendation: {allocation['strategy_name']}. {contribution_text}"
        + " The advisory split shows the best current route for investing, savings, and goal progress."
        + (f" Fallback paths ready: {', '.join(fallback_titles)}." if fallback_titles else ""),
        "empowerment",
        f"empowerment-{transaction.id}",
        {"transaction_id": transaction.id, "strategy_options": allocation["strategy_options"], "real_contribution_id": contribution.id if contribution else None},
    )
    return refresh_financial_state(transaction.user)
