import json
from django.contrib.auth import get_user_model
from django.test import TestCase, Client
from consultations.models import ConsultantApplication
from consultations.study_models import StudyReport

User = get_user_model()


class SecurityAndAccountTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.student = User.objects.create_user(
            phone="09129998877",
            password="StudentPassword123!",
            full_name="دانش‌آموز تست",
            role="student"
        )
        self.manager = User.objects.create_user(
            phone="09121234567",
            password="ManagerPassword123!",
            full_name="مدیر اول",
            role="manager"
        )
        self.other_manager = User.objects.create_user(
            phone="09127654321",
            password="Manager2Password123!",
            full_name="مدیر دوم",
            role="manager"
        )

    def test_current_user_inactive_blocked(self):
        self.client.force_login(self.student)
        res = self.client.get("/api/auth/me/")
        self.assertEqual(res.status_code, 200)

        # Deactivate student
        self.student.is_active = False
        self.student.save()

        res = self.client.get("/api/auth/me/")
        self.assertEqual(res.status_code, 401)

    def test_consultant_registration_account_takeover_blocked(self):
        # Attempt to register consultant using existing student's phone number
        from django.core.files.uploadedfile import SimpleUploadedFile
        fake_pdf_data = b"%PDF-1.4\n" + b"%" + b"a" * 100 + b"\n%%EOF"
        fake_resume = SimpleUploadedFile("resume.pdf", fake_pdf_data, content_type="application/pdf")

        res = self.client.post(
            "/api/consultations/register/start/",
            data={
                "full_name": "مهاجم آکادمی",
                "phone": "09129998877",  # Student's phone
                "email": "attacker@example.com",
                "birth_date": "1380/01/01",
                "konkur_year": "1401",
                "konkur_quota": "منطقه ۱",
                "quota_rank": "100",
                "password": "AttackerNewPassword123!",
                "password_confirmation": "AttackerNewPassword123!",
                "resume_file": fake_resume,
            }
        )
        self.assertEqual(res.status_code, 409)

        # Confirm student password was NOT changed / overwritten
        self.student.refresh_from_db()
        self.assertTrue(self.student.check_password("StudentPassword123!"))
        self.assertEqual(self.student.role, "student")

    def test_manager_cannot_reset_other_manager_password(self):
        self.client.force_login(self.manager)
        res = self.client.post(
            f"/api/manager/users/{self.other_manager.id}/password/",
            data=json.dumps({"password": "HackedPassword123!"}),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 403)

        # Check other manager's password was NOT changed
        self.other_manager.refresh_from_db()
        self.assertTrue(self.other_manager.check_password("Manager2Password123!"))

        # Resetting student's password SHOULD succeed
        res_student = self.client.post(
            f"/api/manager/users/{self.student.id}/password/",
            data=json.dumps({"password": "NewStudentPass123!"}),
            content_type="application/json"
        )
        self.assertEqual(res_student.status_code, 200)
        self.student.refresh_from_db()
        self.assertTrue(self.student.check_password("NewStudentPass123!"))

    def test_manager_can_view_study_reports(self):
        consultant = User.objects.create_user(phone="09123334455", role="consultant", full_name="مشاور")
        StudyReport.objects.create(
            student=self.student,
            consultant=consultant,
            study_date="2026-03-01",
            subject="شیمی",
            minutes=45
        )
        self.client.force_login(self.manager)
        res = self.client.get("/api/consultations/study-reports/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("results", res.json())
        self.assertEqual(len(res.json()["results"]), 1)
