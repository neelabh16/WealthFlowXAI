from django.contrib import admin
from .models import Cashback, Category, Goal, Investment, ModelPrediction, Transaction, UserBehaviorScore

admin.site.register(Category)
admin.site.register(Transaction)
admin.site.register(Investment)
admin.site.register(Goal)
admin.site.register(Cashback)
admin.site.register(ModelPrediction)
admin.site.register(UserBehaviorScore)
