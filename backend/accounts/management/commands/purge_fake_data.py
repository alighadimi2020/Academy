from django.core.management.base import BaseCommand
from django.db import transaction
from accounts.models import User, PendingRegistration, AuditEvent
from consultations.models import (
    ConsultantProfile, ConsultantApplication, PendingConsultantRegistration,
    ConsultantPlanPrice, ConsultationRequest, ConsultationPreference,
    ConsultantManagerConversation, ConsultationMessage, AcademyAnnouncement
)
from consultations.study_models import StudySession, StudyTimer, StudyReport, StudyReportFeedback, TelegramReportLog
from blog.models import BlogPost, BlogSubmission


class Command(BaseCommand):
    help = "Purges all fake and test data, leaving only the manager and admin accounts."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Simulate the cleanup without committing changes to the database.",
        )

    def handle(self, *args, **options):
        dry_run = options.get("dry_run", False)

        with transaction.atomic():
            # Ensure manager account exists with exact specs
            manager, mgr_created = User.objects.get_or_create(
                phone="aliAhmadloo",
                defaults={
                    "full_name": "علیرضا احمدلو",
                    "role": "manager",
                    "email": "ahmadlwl05@gmail.com",
                    "is_staff": True,
                    "is_active": True,
                },
            )
            if mgr_created:
                manager.set_password("1234")
                manager.save()
                self.stdout.write(self.style.SUCCESS("Created manager account 'aliAhmadloo'."))
            else:
                manager.full_name = "علیرضا احمدلو"
                manager.role = "manager"
                manager.is_staff = True
                manager.is_active = True
                manager.save(update_fields=("full_name", "role", "is_staff", "is_active"))
                self.stdout.write(self.style.SUCCESS("Preserved manager account 'aliAhmadloo'."))

            # Ensure admin/developer account taha is preserved if present
            admin_user = User.objects.filter(phone="taha").first()
            if not admin_user:
                admin_user = User.objects.create_superuser(
                    phone="taha",
                    password="admin",
                    full_name="طاها",
                    role="admin",
                )
                self.stdout.write(self.style.SUCCESS("Created admin account 'taha'."))
            else:
                self.stdout.write(self.style.SUCCESS("Preserved admin account 'taha'."))

            keep_ids = {manager.id, admin_user.id}
            fake_users = list(User.objects.exclude(id__in=keep_ids))

            self.stdout.write(f"Found {len(fake_users)} fake/test user(s) to remove.")

            # 1. Study and report records
            c_logs, _ = TelegramReportLog.objects.all().delete()
            c_fb, _ = StudyReportFeedback.objects.all().delete()
            c_rep, _ = StudyReport.objects.all().delete()
            c_tmr, _ = StudyTimer.objects.all().delete()
            c_ses, _ = StudySession.objects.all().delete()

            # 2. Consultation messages and requests
            c_msg, _ = ConsultationMessage.objects.all().delete()
            c_conv, _ = ConsultantManagerConversation.objects.all().delete()
            c_pref, _ = ConsultationPreference.objects.all().delete()
            c_req, _ = ConsultationRequest.objects.all().delete()

            # 3. Consultant profiles and applications
            c_price, _ = ConsultantPlanPrice.objects.all().delete()
            c_app, _ = ConsultantApplication.objects.all().delete()
            c_prof, _ = ConsultantProfile.objects.all().delete()

            # 4. Registrations
            c_reg, _ = PendingRegistration.objects.all().delete()
            c_creg, _ = PendingConsultantRegistration.objects.all().delete()

            # 5. Blog and announcements: reassign fake author to manager
            BlogPost.objects.filter(author__in=fake_users).update(author=manager, approved_by=manager)
            BlogSubmission.objects.filter(author__in=fake_users).update(author=manager)
            AcademyAnnouncement.objects.filter(author__in=fake_users).update(author=manager)

            # 6. Audit events of fake users
            c_audit, _ = AuditEvent.objects.filter(actor__in=fake_users).delete()

            # 7. Delete fake users
            deleted_users_count, _ = User.objects.filter(id__in=[u.id for u in fake_users]).delete()

            self.stdout.write(
                self.style.SUCCESS(
                    f"Cleaned up:\n"
                    f" - Users deleted: {deleted_users_count}\n"
                    f" - Study timers & reports: {c_tmr + c_rep + c_ses}\n"
                    f" - Consultation requests & chats: {c_req + c_conv + c_msg}\n"
                    f" - Consultant profiles & applications: {c_prof + c_app}\n"
                    f" - Audit events purged: {c_audit}"
                )
            )

            remaining_users = list(User.objects.values("id", "phone", "full_name", "role"))
            self.stdout.write(f"Remaining active accounts: {remaining_users}")

            if dry_run:
                transaction.set_rollback(True)
                self.stdout.write(self.style.WARNING("DRY RUN: All changes rolled back."))
            else:
                self.stdout.write(self.style.SUCCESS("Database cleanup successfully committed."))
