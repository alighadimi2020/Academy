import json
from django.contrib.auth import get_user_model
from django.test import TestCase, Client
from consultations.models import ConsultantApplication
from consultations.study_models import StudyReport

User = get_user_model()


class SecurityAndAccountTests(TestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()
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

    def test_session_flush_and_no_cache_headers(self):
        # Login as manager first
        self.client.login(phone="09121234567", password="ManagerPassword123!")
        res = self.client.get("/api/auth/me/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["role"], "manager")
        self.assertIn("no-store", res.headers.get("Cache-Control", ""))

        # Now login as student directly
        res_login = self.client.post(
            "/api/auth/login/",
            data=json.dumps({"phone": "09129998877", "password": "StudentPassword123!"}),
            content_type="application/json"
        )
        self.assertEqual(res_login.status_code, 200)
        self.assertIn("no-store", res_login.headers.get("Cache-Control", ""))

        # Check me endpoint returns student, not manager
        res_me = self.client.get("/api/auth/me/")
        self.assertEqual(res_me.status_code, 200)
        self.assertEqual(res_me.json()["role"], "student")
        self.assertEqual(res_me.json()["phone"], "09129998877")

    def test_login_with_persian_digits(self):
        res_login = self.client.post(
            "/api/auth/login/",
            data=json.dumps({"phone": "۰۹۱۲۹۹۹۸۸۷۷", "password": "StudentPassword123!"}),
            content_type="application/json"
        )
        self.assertEqual(res_login.status_code, 200)
        res_me = self.client.get("/api/auth/me/")
        self.assertEqual(res_me.status_code, 200)
        self.assertEqual(res_me.json()["role"], "student")
        self.assertEqual(res_me.json()["phone"], "09129998877")

    def test_manager_create_consultant_and_login(self):
        self.client.force_login(self.manager)
        res = self.client.post(
            "/api/manager/consultants/create/",
            data=json.dumps({
                "full_name": "مشاور جدید تستی",
                "phone": "۰۹۱۹۸۸۸۷۷۶۶",
                "password": "ConsultantPassword123!"
            }),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertTrue(data.get("ok"))
        consultant_id = data["consultant"]["id"]

        # Consultant can immediately log in with these credentials
        self.client.logout()
        login_res = self.client.post(
            "/api/auth/login/",
            data=json.dumps({
                "phone": "09198887766",
                "password": "ConsultantPassword123!"
            }),
            content_type="application/json"
        )
        self.assertEqual(login_res.status_code, 200)
        me_res = self.client.get("/api/auth/me/")
        self.assertEqual(me_res.status_code, 200)
        self.assertEqual(me_res.json()["role"], "consultant")
        self.assertEqual(me_res.json()["id"], consultant_id)

    def test_manager_assign_student_and_delete_consultant(self):
        # 1. Manager creates a consultant
        self.client.force_login(self.manager)
        res_create = self.client.post(
            "/api/manager/consultants/create/",
            data=json.dumps({
                "full_name": "دکتر علی رضایی",
                "phone": "09123334455",
                "password": "Pass123456Password!"
            }),
            content_type="application/json"
        )
        self.assertEqual(res_create.status_code, 201)
        consultant_id = res_create.json()["consultant"]["id"]

        # 2. Assign student to this consultant
        res_assign = self.client.post(
            f"/api/manager/students/{self.student.id}/assign/",
            data=json.dumps({"consultant_id": consultant_id}),
            content_type="application/json"
        )
        self.assertEqual(res_assign.status_code, 200)
        self.assertTrue(res_assign.json().get("ok"))
        self.assertEqual(res_assign.json()["assignment"]["assigned_consultant_id"], consultant_id)

        # 3. Verify student sees this consultant
        self.client.force_login(self.student)
        res_requests = self.client.get("/api/consultations/requests/")
        self.assertEqual(res_requests.status_code, 200)
        results = res_requests.json().get("results", [])
        self.assertTrue(len(results) > 0)
        self.assertEqual(results[0]["status"], "approved")
        self.assertEqual(results[0]["assigned_consultant_id"], consultant_id)

        # 4. Verify manager student list shows the assigned consultant
        self.client.force_login(self.manager)
        res_users = self.client.get("/api/manager/users/?role=student")
        self.assertEqual(res_users.status_code, 200)
        student_item = next(u for u in res_users.json()["results"] if u["id"] == self.student.id)
        self.assertEqual(student_item["assigned_consultant_id"], consultant_id)
        self.assertIn("دکتر علی رضایی", student_item["assigned_consultant_name"])

        # 5. Delete consultant completely
        res_del = self.client.post(f"/api/manager/consultants/{consultant_id}/delete/")
        self.assertEqual(res_del.status_code, 200)
        self.assertTrue(res_del.json().get("ok"))
        self.assertFalse(User.objects.filter(id=consultant_id).exists())

    def test_manager_create_and_delete_student(self):
        self.client.force_login(self.manager)
        # 1. Create a student manually
        res_create = self.client.post(
            "/api/manager/students/create/",
            data=json.dumps({
                "full_name": "سارا محمدی",
                "phone": "۰۹۳۵۱۱۱۴۴۷۷",
                "password": "SaraPassword123!",
                "grade": "12",
                "major": "experimental"
            }),
            content_type="application/json"
        )
        self.assertEqual(res_create.status_code, 201)
        data = res_create.json()
        self.assertTrue(data.get("ok"))
        created_student_id = data["student"]["id"]

        # Student can log in directly
        self.client.logout()
        login_res = self.client.post(
            "/api/auth/login/",
            data=json.dumps({
                "phone": "09351114477",
                "password": "SaraPassword123!"
            }),
            content_type="application/json"
        )
        self.assertEqual(login_res.status_code, 200)

        # 2. Manager deletes student
        self.client.force_login(self.manager)
        res_del = self.client.post(f"/api/manager/students/{created_student_id}/delete/")
        self.assertEqual(res_del.status_code, 200)
        self.assertTrue(res_del.json().get("ok"))
        self.assertFalse(User.objects.filter(id=created_student_id).exists())

    def test_student_change_password_success_and_security(self):
        self.client.force_login(self.student)

        # 1. Reject wrong old password
        res = self.client.post(
            "/api/auth/password/change/",
            data=json.dumps({
                "old_password": "WrongPassword123!",
                "new_password": "ValidNewPass2026!",
                "new_password_confirm": "ValidNewPass2026!"
            }),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("رمز عبور فعلی اشتباه است", res.json().get("detail", ""))

        # 2. Reject reusing old password
        res = self.client.post(
            "/api/auth/password/change/",
            data=json.dumps({
                "old_password": "StudentPassword123!",
                "new_password": "StudentPassword123!",
                "new_password_confirm": "StudentPassword123!"
            }),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("نمی‌تواند همان رمز عبور قبلی", res.json().get("detail", ""))

        # 3. Reject password less than 8 characters
        res = self.client.post(
            "/api/auth/password/change/",
            data=json.dumps({
                "old_password": "StudentPassword123!",
                "new_password": "Short1",
                "new_password_confirm": "Short1"
            }),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 400)

        # 4. Reject numeric-only password
        res = self.client.post(
            "/api/auth/password/change/",
            data=json.dumps({
                "old_password": "StudentPassword123!",
                "new_password": "1234567890",
                "new_password_confirm": "1234567890"
            }),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 400)

        # 5. Reject mismatching password confirmation
        res = self.client.post(
            "/api/auth/password/change/",
            data=json.dumps({
                "old_password": "StudentPassword123!",
                "new_password": "ValidNewPass2026!",
                "new_password_confirm": "MismatchPass2026!"
            }),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 400)

        # 6. Valid password change succeeds
        res = self.client.post(
            "/api/auth/password/change/",
            data=json.dumps({
                "old_password": "StudentPassword123!",
                "new_password": "BrandNewSecurePassword2026!",
                "new_password_confirm": "BrandNewSecurePassword2026!"
            }),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 200)
        self.student.refresh_from_db()
        self.assertTrue(self.student.check_password("BrandNewSecurePassword2026!"))

        # 7. Student can login with new password
        self.client.logout()
        res_login = self.client.post(
            "/api/auth/login/",
            data=json.dumps({
                "phone": "09129998877",
                "password": "BrandNewSecurePassword2026!"
            }),
            content_type="application/json"
        )
        self.assertEqual(res_login.status_code, 200)

    def test_change_password_rate_limiting_after_repeated_failures(self):
        self.client.force_login(self.student)
        # Attempt 5 consecutive failed password changes
        for _ in range(5):
            res = self.client.post(
                "/api/auth/password/change/",
                data=json.dumps({
                    "old_password": "WrongPasswordAttempt",
                    "new_password": "SomeNewPassword123!",
                    "new_password_confirm": "SomeNewPassword123!"
                }),
                content_type="application/json"
            )
            self.assertEqual(res.status_code, 400)

        # 6th attempt must be blocked with HTTP 429
        res_locked = self.client.post(
            "/api/auth/password/change/",
            data=json.dumps({
                "old_password": "StudentPassword123!",
                "new_password": "SomeNewPassword123!",
                "new_password_confirm": "SomeNewPassword123!"
            }),
            content_type="application/json"
        )
        self.assertEqual(res_locked.status_code, 429)




