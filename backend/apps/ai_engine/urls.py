from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import AIInsightViewSet, FraudLogViewSet, advisor_chat, insight_search, predictions

router = DefaultRouter()
router.register("insights", AIInsightViewSet, basename="insights")
router.register("fraud-logs", FraudLogViewSet, basename="fraud-logs")

urlpatterns = [
    path("advisor/chat/", advisor_chat, name="advisor-chat"),
    path("search-insights/", insight_search, name="search-insights"),
    path("predictions/", predictions, name="predictions"),
    path("", include(router.urls)),
]
