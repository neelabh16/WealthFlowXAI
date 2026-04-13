from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.ai_engine.tasks import process_transaction_ai, refresh_goal_plan, refresh_user_predictions
from .models import Goal, Transaction


@receiver(post_save, sender=Transaction)
def schedule_transaction_ai(sender, instance, created, **kwargs):
    if created:
        if instance.transaction_type == Transaction.Types.DEBIT:
            process_transaction_ai.delay(instance.id)
        refresh_user_predictions.delay(instance.user_id)


@receiver(post_save, sender=Goal)
def schedule_goal_ai(sender, instance, created, **kwargs):
    if created:
        refresh_goal_plan.delay(instance.id)
