from rest_framework import permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def accounts_feed(request):
    return Response(
        {
            "institution": "WealthFlow Sandbox Bank",
            "accounts": [
                {"type": "savings", "balance": 215000, "currency": "INR"},
                {"type": "credit_card", "balance": -18500, "currency": "INR"},
            ],
        }
    )
