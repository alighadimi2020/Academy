from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from consultations.study_models import StudyReport, StudyTimer

TEHRAN = ZoneInfo("Asia/Tehran")


def deliver_pending_daily_reports():
    from consultations.models import ConsultationRequest
    now = timezone.now()
    today = timezone.localtime(now, TEHRAN).date()
    pending = StudyTimer.objects.filter(study_date__lt=today, delivered_at__isnull=True).select_related("plan", "student")
    sent = 0
    delivered_groups = set()
    for timer in pending.iterator():
        with transaction.atomic():
            timer = StudyTimer.objects.select_for_update().get(pk=timer.pk)
            if timer.delivered_at:
                continue
            if timer.running_since:
                midnight = timezone.make_aware(datetime.combine(timer.study_date + timedelta(days=1), time.min), TEHRAN)
                stop_at = min(now, midnight)
                timer.elapsed_seconds += max(0, int((stop_at - timer.running_since).total_seconds()))
                timer.running_since = None
            if timer.elapsed_seconds:
                consultant = None
                if timer.plan and timer.plan.consultant:
                    consultant = timer.plan.consultant
                else:
                    req = ConsultationRequest.objects.filter(student=timer.student, status="approved").select_related("assigned_consultant__user").first()
                    if req and req.assigned_consultant:
                        consultant = req.assigned_consultant.user
                if consultant:
                    subject = timer.subject or (timer.plan.subject if timer.plan else "مطالعه")
                    report_values = {
                        "student": timer.student,
                        "consultant": consultant,
                        "study_date": timer.study_date,
                        "subject": subject,
                        "minutes": (timer.elapsed_seconds + 30) // 60,
                        "test_count": timer.test_count,
                        "notes": timer.notes,
                        "manual_edits": timer.manual_edits,
                    }
                    report = StudyReport.objects.filter(timer=timer).first()
                    if report is None:
                        legacy = StudyReport.objects.filter(
                            student=timer.student,
                            consultant=consultant,
                            study_date=timer.study_date,
                            subject=subject,
                            timer__isnull=True,
                        ).order_by("-created_at", "-id")
                        report = legacy.first()
                    if report:
                        for field, value in report_values.items():
                            setattr(report, field, value)
                        report.timer = timer
                        report.save()
                        StudyReport.objects.filter(
                            student=timer.student,
                            consultant=consultant,
                            study_date=timer.study_date,
                            subject=subject,
                            timer__isnull=True,
                        ).delete()
                    else:
                        StudyReport.objects.create(timer=timer, **report_values)
                    sent += 1
                    delivered_groups.add((consultant, timer.student, timer.study_date))
            timer.delivered_at = now
            timer.save(update_fields=("elapsed_seconds", "running_since", "delivered_at", "updated_at"))

    # Send Telegram notification cards to connected consultants
    try:
        from consultations.telegram_service import send_student_daily_report_to_consultant
        for consultant, student, s_date in delivered_groups:
            student_reports = list(StudyReport.objects.filter(consultant=consultant, student=student, study_date=s_date).order_by("id"))
            if student_reports:
                send_student_daily_report_to_consultant(consultant, student, s_date, student_reports)
    except Exception as exc:
        import logging
        logging.getLogger(__name__).error(f"Error sending Telegram daily reports: {exc}")

    return sent



class Command(BaseCommand):
    help = "Send completed or paused daily study reports to consultants after Tehran midnight."

    def handle(self, *args, **options):
        sent = deliver_pending_daily_reports()
        self.stdout.write(self.style.SUCCESS(f"Sent {sent} daily study report(s)."))
