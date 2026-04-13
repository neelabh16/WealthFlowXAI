import csv
from io import StringIO
from rest_framework import permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from apps.finance.models import Transaction


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def export_csv(request):
    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["merchant", "amount", "type", "occurred_at"])
    for transaction in Transaction.objects.filter(user=request.user)[:100]:
        writer.writerow([transaction.merchant, transaction.amount, transaction.transaction_type, transaction.occurred_at.isoformat()])
    return Response({"filename": "wealthflow-transactions.csv", "content": buffer.getvalue()})


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def monthly_report(request):
    return Response(
        {
            "headline": "Financial health improved this month",
            "sections": [
                "Savings rate increased by 8%.",
                "Fraud detection flagged 1 unusual debit.",
                "Goal progress remains on track for your travel fund.",
            ],
        }
    )
