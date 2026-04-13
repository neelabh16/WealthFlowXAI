from django.conf import settings
from django.db import models
from apps.core.models import TimeStampedModel


class Category(TimeStampedModel):
    name = models.CharField(max_length=100, unique=True)
    kind = models.CharField(max_length=30, default="expense", db_index=True)
    color = models.CharField(max_length=20, default="#00E5A8")
    icon = models.CharField(max_length=50, default="wallet")

    class Meta:
        indexes = [models.Index(fields=["kind", "name"])]

    def __str__(self) -> str:
        return self.name


class Transaction(TimeStampedModel):
    class Types(models.TextChoices):
        CREDIT = "credit", "Credit"
        DEBIT = "debit", "Debit"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="transactions")
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name="transactions")
    amount = models.DecimalField(max_digits=12, decimal_places=2, db_index=True)
    currency = models.CharField(max_length=10, default="INR")
    transaction_type = models.CharField(max_length=10, choices=Types.choices, db_index=True)
    merchant = models.CharField(max_length=255, db_index=True)
    description = models.TextField(blank=True)
    source = models.CharField(max_length=30, default="manual")
    is_flagged = models.BooleanField(default=False, db_index=True)
    occurred_at = models.DateTimeField(db_index=True)
    ai_category = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ["-occurred_at"]
        indexes = [
            models.Index(fields=["user", "occurred_at"]),
            models.Index(fields=["user", "transaction_type"]),
            models.Index(fields=["user", "is_flagged"]),
        ]


class Investment(TimeStampedModel):
    class AssetTypes(models.TextChoices):
        STOCK = "stock", "Stock"
        MUTUAL_FUND = "mutual_fund", "Mutual Fund"
        SAVINGS = "savings", "Savings Wallet"
        ESG = "esg", "ESG Basket"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="investments")
    asset_name = models.CharField(max_length=120)
    asset_type = models.CharField(max_length=30, choices=AssetTypes.choices, db_index=True)
    allocated_amount = models.DecimalField(max_digits=12, decimal_places=2)
    current_value = models.DecimalField(max_digits=12, decimal_places=2)
    roi_percentage = models.FloatField(default=0)

    class Meta:
        ordering = ["-updated_at", "-created_at"]
        indexes = [models.Index(fields=["user", "asset_type"])]


class Goal(TimeStampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="goals")
    title = models.CharField(max_length=120)
    target_amount = models.DecimalField(max_digits=12, decimal_places=2)
    current_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    deadline = models.DateField()
    feasibility_score = models.FloatField(default=0)
    monthly_required = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        ordering = ["deadline", "-created_at"]


class Cashback(TimeStampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="cashbacks")
    transaction = models.OneToOneField(Transaction, on_delete=models.CASCADE, related_name="cashback")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    stocks_allocation = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    mutual_funds_allocation = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    savings_allocation = models.DecimalField(max_digits=10, decimal_places=2, default=0)


class EmpowermentAllocation(TimeStampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="empowerment_allocations")
    transaction = models.OneToOneField(Transaction, on_delete=models.CASCADE, related_name="empowerment_allocation")
    strategy_name = models.CharField(max_length=120)
    redirected_amount = models.DecimalField(max_digits=10, decimal_places=2)
    round_up_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    behavioral_bonus = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    investment_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    savings_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    goal_boost_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    rationale = models.TextField(blank=True)
    metadata = models.JSONField(default=dict)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "created_at"])]


class ModelPrediction(TimeStampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="predictions")
    prediction_type = models.CharField(max_length=50, db_index=True)
    payload = models.JSONField(default=dict)


class UserBehaviorScore(TimeStampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="behavior_scores")
    impulsive_spending_score = models.FloatField(default=0)
    consistency_score = models.FloatField(default=0)
    wealth_discipline_score = models.FloatField(default=0)

    class Meta:
        ordering = ["-created_at"]


class GrowthScoreSnapshot(TimeStampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="growth_score_snapshots")
    overall_score = models.FloatField(default=0)
    budgeting_score = models.FloatField(default=0)
    investing_score = models.FloatField(default=0)
    savings_score = models.FloatField(default=0)
    consistency_score = models.FloatField(default=0)
    resilience_score = models.FloatField(default=0)
    momentum_score = models.FloatField(default=0)
    summary = models.JSONField(default=dict)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "created_at"])]


class SavingsTrigger(TimeStampedModel):
    class TriggerTypes(models.TextChoices):
        ROUND_UP = "round_up", "Round Up Sweep"
        SUBSCRIPTION = "subscription", "Subscription Leak"
        WEEKEND = "weekend", "Weekend Guardrail"
        GOAL = "goal", "Goal Gap"
        PAYDAY = "payday", "Payday Sweep"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="savings_triggers")
    trigger_type = models.CharField(max_length=30, choices=TriggerTypes.choices, db_index=True)
    title = models.CharField(max_length=140)
    description = models.TextField()
    recommended_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    monthly_impact = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    severity = models.CharField(max_length=20, default="medium")
    is_active = models.BooleanField(default=True, db_index=True)
    metadata = models.JSONField(default=dict)

    class Meta:
        ordering = ["-recommended_amount", "-created_at"]
        indexes = [models.Index(fields=["user", "trigger_type", "is_active"])]


class WealthMilestone(TimeStampedModel):
    class Types(models.TextChoices):
        REDIRECTED = "redirected", "Redirected Capital"
        GROWTH_SCORE = "growth_score", "Growth Score"
        GOAL_PROGRESS = "goal_progress", "Goal Progress"
        EMERGENCY = "emergency", "Emergency Buffer"

    class Statuses(models.TextChoices):
        LOCKED = "locked", "Locked"
        ACTIVE = "active", "Active"
        ACHIEVED = "achieved", "Achieved"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="wealth_milestones")
    milestone_type = models.CharField(max_length=30, choices=Types.choices, db_index=True)
    title = models.CharField(max_length=140)
    description = models.TextField()
    target_value = models.DecimalField(max_digits=12, decimal_places=2)
    current_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    progress_percentage = models.FloatField(default=0)
    status = models.CharField(max_length=20, choices=Statuses.choices, default=Statuses.ACTIVE, db_index=True)
    achieved_at = models.DateTimeField(null=True, blank=True)
    celebration_copy = models.CharField(max_length=200, blank=True)
    metadata = models.JSONField(default=dict)

    class Meta:
        ordering = ["status", "-progress_percentage", "-created_at"]
        indexes = [models.Index(fields=["user", "milestone_type", "status"])]


class WealthSweepRule(TimeStampedModel):
    class Modes(models.TextChoices):
        ROUND_UP = "round_up", "Round-Up"
        CASHBACK_ONLY = "cashback_only", "Cashback Only"
        HYBRID = "hybrid", "Hybrid"
        PERCENT = "percent", "Percent of Spend"

    class Providers(models.TextChoices):
        MOCK = "mock", "Mock"
        RAZORPAY = "razorpay", "Razorpay"

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="wealth_sweep_rule")
    is_enabled = models.BooleanField(default=True)
    mode = models.CharField(max_length=30, choices=Modes.choices, default=Modes.HYBRID)
    round_up_base = models.PositiveIntegerField(default=50)
    spend_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    auto_fund_enabled = models.BooleanField(default=True)
    redirect_cashback_enabled = models.BooleanField(default=True)
    provider = models.CharField(max_length=30, choices=Providers.choices, default=Providers.MOCK)
    provider_customer_id = models.CharField(max_length=120, blank=True)
    currency = models.CharField(max_length=10, default="INR")
    metadata = models.JSONField(default=dict)


class WealthContribution(TimeStampedModel):
    class SourceTypes(models.TextChoices):
        ROUND_UP = "round_up", "Round-Up"
        CASHBACK = "cashback", "Cashback"
        PERCENT = "percent", "Percent of Spend"
        MANUAL = "manual", "Manual"
        REWARD = "reward", "Reward"

    class Statuses(models.TextChoices):
        PLANNED = "planned", "Planned"
        PENDING = "pending", "Pending Payment"
        FUNDED = "funded", "Funded"
        MOCK_FUNDED = "mock_funded", "Mock Funded"
        FAILED = "failed", "Failed"
        CANCELLED = "cancelled", "Cancelled"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="wealth_contributions")
    transaction = models.ForeignKey(Transaction, on_delete=models.SET_NULL, null=True, blank=True, related_name="wealth_contributions")
    source_type = models.CharField(max_length=30, choices=SourceTypes.choices, db_index=True)
    status = models.CharField(max_length=30, choices=Statuses.choices, default=Statuses.PLANNED, db_index=True)
    provider = models.CharField(max_length=30, default=WealthSweepRule.Providers.MOCK)
    planned_amount = models.DecimalField(max_digits=12, decimal_places=2)
    funded_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency = models.CharField(max_length=10, default="INR")
    strategy_name = models.CharField(max_length=120, blank=True)
    investment_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    savings_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    goal_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    provider_order_id = models.CharField(max_length=120, blank=True)
    provider_payment_id = models.CharField(max_length=120, blank=True)
    provider_signature = models.CharField(max_length=255, blank=True)
    funded_at = models.DateTimeField(null=True, blank=True)
    applied_at = models.DateTimeField(null=True, blank=True)
    notes = models.JSONField(default=dict)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "status", "created_at"]),
            models.Index(fields=["user", "source_type", "created_at"]),
        ]
