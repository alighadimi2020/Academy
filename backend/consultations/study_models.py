from django.conf import settings
from django.db import models

from django.utils import timezone

class StudySession(models.Model):
    MODES = (("test", "تست"), ("written", "تشریحی"), ("study", "مطالعه"))
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="study_sessions")
    consultant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="created_study_sessions")
    weekday = models.PositiveSmallIntegerField(help_text="شنبه=۰ تا جمعه=۶")
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    subject = models.CharField(max_length=150)
    mode = models.CharField(max_length=12, choices=MODES, default="study")
    test_count = models.PositiveSmallIntegerField(default=0)
    instructions = models.CharField(max_length=500, blank=True)
    planned_minutes = models.PositiveSmallIntegerField(default=60, help_text="مدت مطالعه در روز به دقیقه")
    color = models.CharField(max_length=20, default="mint")
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ["weekday", "start_time"]


class StudyTimer(models.Model):
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="study_timers")
    plan = models.ForeignKey(StudySession, on_delete=models.SET_NULL, null=True, blank=True, related_name="timers")
    subject = models.CharField(max_length=150, blank=True, default="")
    study_date = models.DateField()
    elapsed_seconds = models.PositiveIntegerField(default=0)
    running_since = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    manual_edits = models.PositiveSmallIntegerField(default=0)
    notes = models.CharField(max_length=1000, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at", "id"]


class StudyReport(models.Model):
    timer = models.OneToOneField(StudyTimer, on_delete=models.SET_NULL, null=True, blank=True, related_name="study_report")
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="study_reports")
    consultant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="received_study_reports")
    study_date = models.DateField()
    subject = models.CharField(max_length=150)
    minutes = models.PositiveIntegerField(default=0)
    notes = models.CharField(max_length=1000, blank=True)
    manual_edits = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-study_date", "-created_at"]


class TelegramReportLog(models.Model):
    consultant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="telegram_report_logs")
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="telegram_received_report_logs")
    study_date = models.DateField()
    telegram_message_id = models.BigIntegerField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class StudyReportFeedback(models.Model):
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="study_feedbacks")
    consultant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="given_study_feedbacks")
    study_date = models.DateField()
    feedback_text = models.TextField(max_length=3000)
    source = models.CharField(max_length=20, default="telegram")
    telegram_message_id = models.BigIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-study_date", "-created_at"]

