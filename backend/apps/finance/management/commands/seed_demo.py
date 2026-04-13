from datetime import timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.ai_engine.tasks import generate_ai_insight
from apps.finance.models import Category, Goal, Investment, Transaction
from apps.finance.services import process_transaction_for_financial_empowerment, refresh_financial_state

User = get_user_model()


class Command(BaseCommand):
    help = "Seed demo data for WealthFlow X AI"

    def handle(self, *args, **options):
        user, created = User.objects.get_or_create(
            email="demo@wealthflow.ai",
            defaults={
                "username": "demo",
                "first_name": "Demo",
                "last_name": "User",
                "monthly_income": Decimal("185000"),
                "risk_profile": "balanced",
                "role": "user",
            },
        )
        if created:
            user.set_password("Demo@12345")
            user.save()

        categories = {
            "Food": "expense",
            "Income": "income",
            "Investments": "expense",
            "Subscriptions": "expense",
            "Transport": "expense",
            "Shopping": "expense",
        }
        category_objects = {}
        for name, kind in categories.items():
            category_objects[name], _ = Category.objects.get_or_create(name=name, defaults={"kind": kind})

        now = timezone.now()
        samples = [
            ("Salary", "Income", Decimal("185000"), "credit", "Monthly salary credit", 5),
            ("Swiggy", "Food", Decimal("1240"), "debit", "Late night order", 3),
            ("Netflix", "Subscriptions", Decimal("649"), "debit", "Streaming plan", 2),
            ("Zerodha SIP", "Investments", Decimal("12000"), "debit", "Monthly SIP", 1),
            ("Uber", "Transport", Decimal("890"), "debit", "Airport transfer", 6),
            ("Amazon", "Shopping", Decimal("3280"), "debit", "Impulse gadget purchase", 8),
        ]
        for merchant, category_name, amount, txn_type, description, days_ago in samples:
            transaction, _ = Transaction.objects.get_or_create(
                user=user,
                merchant=merchant,
                amount=amount,
                transaction_type=txn_type,
                occurred_at=now - timedelta(days=days_ago),
                defaults={
                    "category": category_objects[category_name],
                    "description": description,
                    "currency": "INR",
                },
            )
            if txn_type == "debit":
                process_transaction_for_financial_empowerment(transaction)

        Goal.objects.get_or_create(
            user=user,
            title="Europe Trip",
            defaults={
                "target_amount": Decimal("400000"),
                "current_amount": Decimal("248000"),
                "deadline": (now + timedelta(days=300)).date(),
            },
        )
        Investment.objects.get_or_create(
            user=user,
            asset_name="Balanced Flexi Cap Fund",
            defaults={
                "asset_type": "mutual_fund",
                "allocated_amount": Decimal("180000"),
                "current_value": Decimal("196380"),
                "roi_percentage": 9.1,
            },
        )

        refresh_financial_state(user)
        generate_ai_insight.delay(user.id)
        self.stdout.write(self.style.SUCCESS("Demo data ready for demo@wealthflow.ai / Demo@12345"))
