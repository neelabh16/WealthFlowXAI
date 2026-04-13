from rest_framework import permissions, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from apps.ai_engine.services import categorize_transaction
from .models import Category, EmpowermentAllocation, Goal, GrowthScoreSnapshot, Investment, ModelPrediction, SavingsTrigger, Transaction, UserBehaviorScore, WealthContribution, WealthMilestone
from .serializers import (
    EmpowermentAllocationSerializer,
    CategorySerializer,
    ContributionPaymentVerificationSerializer,
    DailyCheckInSerializer,
    GoalSerializer,
    GrowthScoreSnapshotSerializer,
    InvestmentSerializer,
    ModelPredictionSerializer,
    SavingsTriggerSerializer,
    TransactionSerializer,
    UserBehaviorScoreSerializer,
    WealthContributionSerializer,
    WealthMilestoneSerializer,
    WealthSweepRuleSerializer,
)
from .services import (
    analytics_payload,
    create_contribution_checkout,
    dashboard_snapshot,
    get_or_create_sweep_rule,
    portfolio_mix,
    process_transaction_for_financial_empowerment,
    reconcile_razorpay_webhook,
    record_daily_check_in,
    refresh_financial_state,
    verify_contribution_checkout,
)


class OwnedModelViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class TransactionViewSet(OwnedModelViewSet):
    queryset = Transaction.objects.select_related("category")
    serializer_class = TransactionSerializer
    filterset_fields = ["transaction_type", "currency", "is_flagged", "category"]
    search_fields = ["merchant", "description", "ai_category"]
    ordering_fields = ["occurred_at", "amount", "created_at"]

    def perform_create(self, serializer):
        instance = serializer.save(user=self.request.user)
        category = categorize_transaction(instance)
        instance.ai_category = category
        instance.save(update_fields=["ai_category"])
        process_transaction_for_financial_empowerment(instance)


class InvestmentViewSet(OwnedModelViewSet):
    queryset = Investment.objects.all()
    serializer_class = InvestmentSerializer
    filterset_fields = ["asset_type"]
    search_fields = ["asset_name"]

    def perform_create(self, serializer):
        instance = serializer.save(user=self.request.user)
        refresh_financial_state(instance.user)

    def perform_update(self, serializer):
        instance = serializer.save()
        refresh_financial_state(instance.user)


class GoalViewSet(OwnedModelViewSet):
    queryset = Goal.objects.all()
    serializer_class = GoalSerializer
    search_fields = ["title"]

    def perform_create(self, serializer):
        instance = serializer.save(user=self.request.user)
        refresh_financial_state(instance.user)

    def perform_update(self, serializer):
        instance = serializer.save()
        refresh_financial_state(instance.user)


class PredictionViewSet(OwnedModelViewSet):
    queryset = ModelPrediction.objects.all()
    serializer_class = ModelPredictionSerializer
    filterset_fields = ["prediction_type"]


class BehaviorScoreViewSet(OwnedModelViewSet):
    queryset = UserBehaviorScore.objects.all()
    serializer_class = UserBehaviorScoreSerializer


class EmpowermentAllocationViewSet(OwnedModelViewSet):
    queryset = EmpowermentAllocation.objects.select_related("transaction")
    serializer_class = EmpowermentAllocationSerializer
    http_method_names = ["get", "head", "options"]


class GrowthScoreSnapshotViewSet(OwnedModelViewSet):
    queryset = GrowthScoreSnapshot.objects.all()
    serializer_class = GrowthScoreSnapshotSerializer
    http_method_names = ["get", "head", "options"]


class SavingsTriggerViewSet(OwnedModelViewSet):
    queryset = SavingsTrigger.objects.all()
    serializer_class = SavingsTriggerSerializer
    http_method_names = ["get", "head", "options"]


class WealthMilestoneViewSet(OwnedModelViewSet):
    queryset = WealthMilestone.objects.all()
    serializer_class = WealthMilestoneSerializer
    http_method_names = ["get", "head", "options"]


class WealthContributionViewSet(OwnedModelViewSet):
    queryset = WealthContribution.objects.select_related("transaction")
    serializer_class = WealthContributionSerializer
    http_method_names = ["get", "head", "options"]


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticated]


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def dashboard(request):
    refreshed = refresh_financial_state(request.user) if not request.user.growth_score_snapshots.exists() else {"snapshot": request.user.growth_score_snapshots.first()}
    return Response(
        {
            "summary": dashboard_snapshot(request.user),
            "portfolio_mix": portfolio_mix(request.user),
            "goals": GoalSerializer(request.user.goals.all()[:3], many=True).data,
            "transactions": TransactionSerializer(request.user.transactions.all()[:5], many=True).data,
            "empowerment_allocations": EmpowermentAllocationSerializer(request.user.empowerment_allocations.all()[:5], many=True).data,
            "wealth_contributions": WealthContributionSerializer(request.user.wealth_contributions.all()[:5], many=True).data,
            "sweep_rule": WealthSweepRuleSerializer(get_or_create_sweep_rule(request.user)).data,
            "smart_saving_triggers": SavingsTriggerSerializer(request.user.savings_triggers.filter(is_active=True)[:4], many=True).data,
            "wealth_milestones": WealthMilestoneSerializer(request.user.wealth_milestones.all()[:4], many=True).data,
            "growth_snapshot": GrowthScoreSnapshotSerializer(refreshed["snapshot"]).data,
        }
    )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def analytics(request):
    if not request.user.growth_score_snapshots.exists():
        refresh_financial_state(request.user)
    return Response(analytics_payload(request.user))


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def daily_check_in(request):
    serializer = DailyCheckInSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return Response(record_daily_check_in(request.user, serializer.validated_data), status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH"])
@permission_classes([permissions.IsAuthenticated])
def sweep_rule(request):
    rule = get_or_create_sweep_rule(request.user)
    if request.method == "PATCH":
        serializer = WealthSweepRuleSerializer(rule, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response(serializer.data)
    return Response(WealthSweepRuleSerializer(rule).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def contribution_checkout(request, pk: int):
    contribution = request.user.wealth_contributions.get(pk=pk)
    return Response(create_contribution_checkout(contribution))


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def contribution_verify(request):
    serializer = ContributionPaymentVerificationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    contribution = request.user.wealth_contributions.get(pk=serializer.validated_data["contribution_id"])
    verified = verify_contribution_checkout(
        contribution=contribution,
        payment_id=serializer.validated_data["razorpay_payment_id"],
        signature=serializer.validated_data["razorpay_signature"],
    )
    return Response(WealthContributionSerializer(verified).data)


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def razorpay_webhook(request):
    signature = request.headers.get("X-Razorpay-Signature", "")
    contribution = reconcile_razorpay_webhook(body=request.body, signature=signature)
    return Response({"ok": True, "contribution_id": contribution.id if contribution else None})
