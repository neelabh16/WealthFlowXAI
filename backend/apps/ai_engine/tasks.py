from celery import shared_task
from apps.finance.models import Goal, Transaction
from .models import AIInsight, FraudLog
from .services import advisor_response, create_cashback, detect_fraud, forecast_balances, goal_planner


@shared_task
def process_transaction_ai(transaction_id: int):
    transaction = Transaction.objects.select_related("user").get(id=transaction_id)
    create_cashback(transaction)
    fraud = detect_fraud(transaction)
    if fraud["is_anomaly"]:
        FraudLog.objects.create(
            user=transaction.user,
            transaction=transaction,
            anomaly_score=fraud["score"],
            severity="high" if abs(fraud["score"]) > 0.1 else "medium",
            details=fraud,
        )
        transaction.is_flagged = True
        transaction.save(update_fields=["is_flagged"])


@shared_task
def refresh_user_predictions(user_id: int):
    from django.contrib.auth import get_user_model
    from apps.finance.models import ModelPrediction

    user = get_user_model().objects.get(id=user_id)
    ModelPrediction.objects.create(user=user, prediction_type="balance_forecast", payload=forecast_balances(user))


@shared_task
def refresh_goal_plan(goal_id: int):
    goal = Goal.objects.select_related("user").get(id=goal_id)
    plan = goal_planner(goal)
    goal.monthly_required = plan["monthly_required"]
    goal.feasibility_score = plan["feasibility_score"]
    goal.save(update_fields=["monthly_required", "feasibility_score"])


@shared_task
def generate_ai_insight(user_id: int):
    from django.contrib.auth import get_user_model

    user = get_user_model().objects.get(id=user_id)
    AIInsight.objects.create(
        user=user,
        insight_type="advisor",
        title="Weekly money personality update",
        body=advisor_response(user, "Where am I wasting money?"),
        confidence=0.82,
        metadata={"source": "scheduled-insight"},
    )
