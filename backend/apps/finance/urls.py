from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import (
    EmpowermentAllocationViewSet,
    GrowthScoreSnapshotViewSet,
    SavingsTriggerViewSet,
    WealthMilestoneViewSet,
    analytics,
    contribution_checkout,
    contribution_verify,
    daily_check_in,
    dashboard,
    razorpay_webhook,
    sweep_rule,
    BehaviorScoreViewSet,
    CategoryViewSet,
    GoalViewSet,
    InvestmentViewSet,
    PredictionViewSet,
    TransactionViewSet,
    WealthContributionViewSet,
)

router = DefaultRouter()
router.register("transactions", TransactionViewSet, basename="transactions")
router.register("investments", InvestmentViewSet, basename="investments")
router.register("goals", GoalViewSet, basename="goals")
router.register("predictions", PredictionViewSet, basename="predictions")
router.register("behavior-scores", BehaviorScoreViewSet, basename="behavior-scores")
router.register("categories", CategoryViewSet, basename="categories")
router.register("empowerment-allocations", EmpowermentAllocationViewSet, basename="empowerment-allocations")
router.register("growth-snapshots", GrowthScoreSnapshotViewSet, basename="growth-snapshots")
router.register("savings-triggers", SavingsTriggerViewSet, basename="savings-triggers")
router.register("wealth-milestones", WealthMilestoneViewSet, basename="wealth-milestones")
router.register("wealth-contributions", WealthContributionViewSet, basename="wealth-contributions")

urlpatterns = [
    path("dashboard/", dashboard, name="dashboard"),
    path("analytics/", analytics, name="analytics"),
    path("daily-check-in/", daily_check_in, name="daily-check-in"),
    path("sweep-rule/", sweep_rule, name="sweep-rule"),
    path("wealth-contributions/<int:pk>/checkout/", contribution_checkout, name="contribution-checkout"),
    path("wealth-contributions/verify/", contribution_verify, name="contribution-verify"),
    path("payments/razorpay/webhook/", razorpay_webhook, name="razorpay-webhook"),
    path("", include(router.urls)),
]
