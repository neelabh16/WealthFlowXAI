from django.urls import path
from .views import accounts_feed

urlpatterns = [path("accounts/", accounts_feed, name="accounts-feed")]
