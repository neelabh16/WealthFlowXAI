from django.conf import settings
from django.db import models
from apps.core.models import TimeStampedModel


class AIInsight(TimeStampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ai_insights")
    insight_type = models.CharField(max_length=50, db_index=True)
    title = models.CharField(max_length=150)
    body = models.TextField()
    confidence = models.FloatField(default=0)
    metadata = models.JSONField(default=dict)


class FraudLog(TimeStampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="fraud_logs")
    transaction = models.ForeignKey("finance.Transaction", on_delete=models.CASCADE, related_name="fraud_logs")
    anomaly_score = models.FloatField()
    severity = models.CharField(max_length=20, default="medium")
    details = models.JSONField(default=dict)
