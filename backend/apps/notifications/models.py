from django.conf import settings
from django.db import models
from apps.core.models import TimeStampedModel


class Notification(TimeStampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField(max_length=150)
    body = models.TextField()
    notification_type = models.CharField(max_length=50, default="info")
    is_read = models.BooleanField(default=False, db_index=True)
    payload = models.JSONField(default=dict)
