from rest_framework import permissions, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from .models import AIInsight, FraudLog
from .serializers import AIInsightSerializer, FraudLogSerializer
from .services import advisor_response, forecast_balances, search_insights


class AIInsightViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AIInsightSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return AIInsight.objects.filter(user=self.request.user)


class FraudLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = FraudLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return FraudLog.objects.filter(user=self.request.user)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def advisor_chat(request):
    prompt = request.data.get("prompt", "")
    return Response(advisor_response(request.user, prompt))


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def insight_search(request):
    query = request.query_params.get("q", "")
    return Response({"query": query, "results": search_insights(request.user, query)})


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def predictions(request):
    return Response(forecast_balances(request.user))
