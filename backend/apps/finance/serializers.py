from django.conf import settings
from django.utils import timezone
from rest_framework import serializers
from .gateway import razorpay_is_configured
from .metrics import transaction_display_category, transaction_flow_group
from .models import (
    Cashback,
    Category,
    EmpowermentAllocation,
    Goal,
    GrowthScoreSnapshot,
    Investment,
    ModelPrediction,
    SavingsTrigger,
    Transaction,
    UserBehaviorScore,
    WealthContribution,
    WealthMilestone,
    WealthSweepRule,
)


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = "__all__"


class TransactionSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    display_category = serializers.SerializerMethodField()
    flow_group = serializers.SerializerMethodField()

    def get_display_category(self, obj):
        return transaction_display_category(obj)

    def get_flow_group(self, obj):
        return transaction_flow_group(obj)

    class Meta:
        model = Transaction
        fields = "__all__"
        read_only_fields = ("user", "is_flagged", "ai_category")


class InvestmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Investment
        fields = "__all__"
        read_only_fields = ("user",)


class GoalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Goal
        fields = "__all__"
        read_only_fields = ("user", "feasibility_score", "monthly_required")


class CashbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cashback
        fields = "__all__"


class EmpowermentAllocationSerializer(serializers.ModelSerializer):
    transaction_merchant = serializers.CharField(source="transaction.merchant", read_only=True)

    class Meta:
        model = EmpowermentAllocation
        fields = "__all__"
        read_only_fields = ("user",)


class ModelPredictionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModelPrediction
        fields = "__all__"


class UserBehaviorScoreSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserBehaviorScore
        fields = "__all__"


class GrowthScoreSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = GrowthScoreSnapshot
        fields = "__all__"
        read_only_fields = ("user",)


class SavingsTriggerSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavingsTrigger
        fields = "__all__"
        read_only_fields = ("user",)


class WealthMilestoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = WealthMilestone
        fields = "__all__"
        read_only_fields = ("user",)


class WealthSweepRuleSerializer(serializers.ModelSerializer):
    provider_ready = serializers.SerializerMethodField()
    checkout_key = serializers.SerializerMethodField()

    def get_provider_ready(self, obj):
        if obj.provider == WealthSweepRule.Providers.MOCK:
            return True
        return razorpay_is_configured()

    def get_checkout_key(self, obj):
        if obj.provider != WealthSweepRule.Providers.RAZORPAY or not razorpay_is_configured():
            return ""
        return getattr(settings, "RAZORPAY_KEY_ID", "")

    class Meta:
        model = WealthSweepRule
        fields = "__all__"
        read_only_fields = ("user", "provider_customer_id")


class WealthContributionSerializer(serializers.ModelSerializer):
    transaction_merchant = serializers.CharField(source="transaction.merchant", read_only=True)

    class Meta:
        model = WealthContribution
        fields = "__all__"
        read_only_fields = (
            "user",
            "transaction",
            "status",
            "provider",
            "planned_amount",
            "funded_amount",
            "currency",
            "strategy_name",
            "investment_amount",
            "savings_amount",
            "goal_amount",
            "provider_order_id",
            "provider_payment_id",
            "provider_signature",
            "funded_at",
            "applied_at",
        )


class ContributionPaymentVerificationSerializer(serializers.Serializer):
    contribution_id = serializers.IntegerField()
    razorpay_payment_id = serializers.CharField(max_length=120)
    razorpay_signature = serializers.CharField(max_length=255)


class DailyCheckInSerializer(serializers.Serializer):
    merchant = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    description = serializers.CharField(required=False, allow_blank=True, default="")
    occurred_at = serializers.DateTimeField(required=False, default=timezone.now)
    currency = serializers.CharField(required=False, default="INR")
    payment_channel = serializers.ChoiceField(
        choices=(
            ("upi", "UPI"),
            ("card", "Card"),
            ("bank", "Bank"),
            ("cash", "Cash"),
            ("manual", "Manual"),
        ),
        required=False,
        default="upi",
    )
    spending_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, min_value=0, default=0)
    savings_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, min_value=0, default=0)
    cashback_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, min_value=0, default=0)

    def validate(self, attrs):
        spending_amount = attrs.get("spending_amount", 0)
        savings_amount = attrs.get("savings_amount", 0)
        cashback_amount = attrs.get("cashback_amount", 0)

        if spending_amount <= 0 and savings_amount <= 0 and cashback_amount <= 0:
            raise serializers.ValidationError("Add at least one amount for spending, savings, or cashback.")

        if spending_amount > 0 and not attrs.get("merchant"):
            raise serializers.ValidationError({"merchant": "Merchant is required when logging spending."})

        return attrs
