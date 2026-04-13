from django.contrib.auth.models import AbstractUser
from django.db import models
from apps.core.models import TimeStampedModel


class User(AbstractUser, TimeStampedModel):
    class Roles(models.TextChoices):
        USER = "user", "User"
        ADMIN = "admin", "Admin"
        ANALYST = "analyst", "Analyst"

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=Roles.choices, default=Roles.USER, db_index=True)
    monthly_income = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    risk_profile = models.CharField(max_length=20, default="balanced")
    preferred_currency = models.CharField(max_length=10, default="INR")
    money_personality_score = models.FloatField(default=50)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]


class UserPreference(TimeStampedModel):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="preference")
    voice_advisor_enabled = models.BooleanField(default=False)
    installable_pwa = models.BooleanField(default=True)
    multi_currency_enabled = models.BooleanField(default=True)
    weekly_budget = models.DecimalField(max_digits=12, decimal_places=2, default=0)
