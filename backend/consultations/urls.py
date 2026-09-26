from django.urls import path
from . import views

urlpatterns = [
    path("marketplace/", views.marketplace, name="consultation-marketplace"),
    path("profile/", views.consultant_profile, name="consultant-own-profile"),
    path("manage/", views.manager_overview, name="consultation-manager-overview"),
    path("manage/prices/", views.manage_prices, name="consultation-manage-prices"),
    path("requests/", views.request_list, name="consultation-requests"),
    path("requests/create/", views.create_request, name="consultation-request-create"),
    path("requests/<int:request_id>/decision/", views.decide_request, name="consultation-request-decision"),
    path("requests/<int:request_id>/messages/", views.chat_messages, name="consultation-messages"),
]
