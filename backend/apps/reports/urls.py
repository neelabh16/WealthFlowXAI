from django.urls import path
from .views import export_csv, monthly_report

urlpatterns = [
    path("export/csv/", export_csv, name="export-csv"),
    path("monthly/", monthly_report, name="monthly-report"),
]
