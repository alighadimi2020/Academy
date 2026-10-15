from datetime import date, timedelta
from django.contrib.auth import get_user_model
from django.test import TestCase, Client
from consultations.models import ConsultantProfile, ConsultationRequest
from consultations.study_models import StudySession, StudyTimer, StudyReport
from consultations.management.commands.send_daily_study_reports import deliver_pending_daily_reports
from consultations.views import _tehran_today

User = get_user_model()

class StudyTimerAndReportsTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.consultant_user, _ = User.objects.get_or_create(
            phone="09121111111", defaults={"role": "consultant", "full_name": "مشاور اول"}
        )
        self.profile, _ = ConsultantProfile.objects.get_or_create(user=self.consultant_user)
        
        self.other_consultant_user, _ = User.objects.get_or_create(
            phone="09122222222", defaults={"role": "consultant", "full_name": "مشاور دوم"}
        )
        self.other_profile, _ = ConsultantProfile.objects.get_or_create(user=self.other_consultant_user)

        self.student_user, _ = User.objects.get_or_create(
            phone="09351111111", defaults={
                "role": "student", "full_name": "دانش آموز تجربی",
                "grade": "12", "major": "experimental"
            }
        )
        
        # Assign student to consultant
        self.req, _ = ConsultationRequest.objects.get_or_create(
            student=self.student_user,
            defaults={
                "plan": "standard",
                "status": ConsultationRequest.Status.APPROVED,
                "assigned_consultant": self.profile,
            }
        )

    def test_multi_box_and_30_limit(self):
        self.client.force_login(self.student_user)
        # Create boxes up to 30
        for i in range(30):
            res = self.client.post(
                "/api/consultations/study-timers/create-box/",
                data={"subject": f"درس شماره {i+1}"},
                content_type="application/json"
            )
            self.assertEqual(res.status_code, 201)
        
        # 31st box must fail with 429
        res = self.client.post(
            "/api/consultations/study-timers/create-box/",
            data={"subject": "درس سی و یکم"},
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 429)

    def test_start_auto_pauses_other_timer(self):
        self.client.force_login(self.student_user)
        res1 = self.client.post("/api/consultations/study-timers/create-box/", data={"subject": "فیزیک"}, content_type="application/json")
        t1_id = res1.json()["id"]
        res2 = self.client.post("/api/consultations/study-timers/create-box/", data={"subject": "شیمی"}, content_type="application/json")
        t2_id = res2.json()["id"]

        # Start physics
        act1 = self.client.post("/api/consultations/study-timers/action/", data={"timer_id": t1_id, "action": "start"}, content_type="application/json")
        self.assertEqual(act1.status_code, 200)
        self.assertTrue(act1.json()["running"])

        # Start chemistry -> physics must auto-pause
        act2 = self.client.post("/api/consultations/study-timers/action/", data={"timer_id": t2_id, "action": "start"}, content_type="application/json")
        self.assertEqual(act2.status_code, 200)
        self.assertTrue(act2.json()["running"])

        t1 = StudyTimer.objects.get(pk=t1_id)
        self.assertIsNone(t1.running_since)

    def test_midnight_delivery_to_assigned_consultant(self):
        yesterday = _tehran_today() - timedelta(days=1)
        timer = StudyTimer.objects.create(
            student=self.student_user,
            subject="زیست‌شناسی",
            study_date=yesterday,
            elapsed_seconds=3600,
            notes="فصل ۱ خوانده شد"
        )
        sent = deliver_pending_daily_reports()
        self.assertEqual(sent, 1)

        timer.refresh_from_db()
        self.assertIsNotNone(timer.delivered_at)

        report = StudyReport.objects.filter(timer=timer).first()
        self.assertIsNotNone(report)
        self.assertEqual(report.consultant, self.consultant_user)
        self.assertEqual(report.minutes, 60)
        self.assertEqual(report.notes, "فصل ۱ خوانده شد")

    def test_consultant_data_isolation(self):
        # Create a report for consultant 1
        yesterday = _tehran_today() - timedelta(days=1)
        StudyReport.objects.create(
            student=self.student_user,
            consultant=self.consultant_user,
            study_date=yesterday,
            subject="ریاضی",
            minutes=90
        )
        
        # Consultant 2 must NOT see this report
        self.client.force_login(self.other_consultant_user)
        res = self.client.get("/api/consultations/study-reports/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()["results"]), 0)

        # Consultant 1 DOES see the report
        self.client.force_login(self.consultant_user)
        res = self.client.get("/api/consultations/study-reports/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()["results"]), 1)
        self.assertEqual(res.json()["results"][0]["student_name"], "دانش آموز تجربی")

    def test_resume_and_edit_before_midnight(self):
        self.client.force_login(self.student_user)
        res = self.client.post("/api/consultations/study-timers/create-box/", data={"subject": "دین و زندگی"}, content_type="application/json")
        t_id = res.json()["id"]

        # Finish timer
        res = self.client.post("/api/consultations/study-timers/action/", data={"timer_id": t_id, "action": "finish", "notes": "درس ۱"}, content_type="application/json")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["finished"])

        # Resume before midnight
        res = self.client.post("/api/consultations/study-timers/action/", data={"timer_id": t_id, "action": "start"}, content_type="application/json")
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.json()["finished"])
        self.assertTrue(res.json()["running"])

        # Pause
        res = self.client.post("/api/consultations/study-timers/action/", data={"timer_id": t_id, "action": "pause"}, content_type="application/json")
        self.assertEqual(res.status_code, 200)

        # Edit notes only (no quota consumed)
        res = self.client.post("/api/consultations/study-timers/action/", data={"timer_id": t_id, "action": "edit", "notes": "یادداشت جدید"}, content_type="application/json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["manual_edits"], 0)

        # Edit minutes (consumes 1 quota)
        res = self.client.post("/api/consultations/study-timers/action/", data={"timer_id": t_id, "action": "edit", "minutes": 40}, content_type="application/json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["manual_edits"], 1)
        self.assertEqual(res.json()["elapsed_seconds"], 2400)

