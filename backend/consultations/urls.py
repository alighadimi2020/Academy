from django.urls import path
from . import views
from . import telegram_views
from . import registration_views

urlpatterns = [
    path("study-sessions/", views.study_sessions, name="study-sessions"),
    path("study-sessions/create/", views.study_sessions_create, name="study-sessions-create"),
    path("study-timers/action/", views.study_timer_action, name="study-timer-action"),
    path("study-timers/today/", views.study_timers_today, name="study-timers-today"),
    path("study-timers/create-box/", views.study_timer_create_box, name="study-timer-create-box"),
    path("study-reports/", views.study_reports, name="study-reports"),
    path("study-reports/<int:report_id>/edit/", views.study_report_edit, name="study-report-edit"),
    path("marketplace/", views.marketplace, name="consultation-marketplace"),
    path("profile/", views.consultant_profile, name="consultant-own-profile"),
    path("manage/", views.manager_overview, name="consultation-manager-overview"),
    path("manage/prices/", views.manage_prices, name="consultation-manage-prices"),
    path("requests/", views.request_list, name="consultation-requests"),
    path("requests/create/", views.create_request, name="consultation-request-create"),
    path("requests/<int:request_id>/decision/", views.decide_request, name="consultation-request-decision"),
    path("staff-conversations/", views.staff_conversations, name="staff-conversation-list"),
    path("staff-conversations/<int:conversation_id>/messages/", views.staff_conversation_messages, name="staff-conversation-messages"),
    path("staff-conversations/<int:conversation_id>/images/<int:message_id>/", views.staff_chat_image, name="staff-conversation-image"),
    path("requests/<int:request_id>/images/<int:message_id>/", views.chat_image, name="consultation-message-image"),
    path("requests/<int:request_id>/messages/", views.chat_messages, name="consultation-messages"),
    # Telegram Bot & Feedback
    path("telegram/webhook/", telegram_views.telegram_webhook, name="telegram-webhook"),
    path("telegram/status/", telegram_views.consultant_telegram_status, name="consultant-telegram-status"),
    path("telegram/disconnect/", telegram_views.consultant_telegram_disconnect, name="consultant-telegram-disconnect"),
    path("telegram/test/", telegram_views.consultant_telegram_test, name="consultant-telegram-test"),
    path("study-feedbacks/", telegram_views.study_feedbacks_list, name="study-feedbacks-list"),
    # Consultant Registration & Resume Application
    path("register/start/", registration_views.start_consultant_registration, name="consultant-register-start"),
    path("register/verify/", registration_views.verify_consultant_registration, name="consultant-register-verify"),
    path("register/status/", registration_views.consultant_application_status, name="consultant-register-status"),
    path("manager/applications/", registration_views.manager_consultant_applications, name="manager-consultant-applications"),
    path("manager/applications/<int:application_id>/decision/", registration_views.manager_decide_consultant_application, name="manager-decide-consultant-application"),
    path("manager/resumes/<str:filename>/", registration_views.manager_download_resume, name="manager-download-resume"),
]
