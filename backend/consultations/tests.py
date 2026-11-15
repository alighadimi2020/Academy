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

    def test_delete_study_timer(self):
        self.client.force_login(self.student_user)
        res = self.client.post("/api/consultations/study-timers/create-box/", data={"subject": "شیمی ۱", "topic": "فصل ۱"}, content_type="application/json")
        self.assertEqual(res.status_code, 201)
        t_id = res.json()["id"]

        # Verify today timers contains this box
        today_res = self.client.get("/api/consultations/study-timers/today/")
        self.assertTrue(any(t["id"] == t_id for t in today_res.json()["results"]))

        # Delete the timer box
        del_res = self.client.post("/api/consultations/study-timers/action/", data={"timer_id": t_id, "action": "delete"}, content_type="application/json")
        self.assertEqual(del_res.status_code, 200)
        self.assertTrue(del_res.json()["deleted"])

        # Verify today timers no longer returns the box
        today_res2 = self.client.get("/api/consultations/study-timers/today/")
        self.assertFalse(any(t["id"] == t_id for t in today_res2.json()["results"]))

    def test_delete_study_report(self):
        self.client.force_login(self.student_user)
        report = StudyReport.objects.create(
            student=self.student_user,
            consultant=self.consultant_user,
            study_date=_tehran_today(),
            subject="زیست‌شناسی",
            topic="فصل ۲",
            minutes=75
        )
        res = self.client.post(f"/api/consultations/study-reports/{report.id}/delete/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["ok"])
        self.assertFalse(StudyReport.objects.filter(pk=report.id).exists())



class ManagerAssignmentFlowTests(TestCase):
    def test_assignment_visibility_planning_chat_and_reassignment(self):
        manager = User.objects.create_user(phone="09120000001", password="pass", role="manager")
        student = User.objects.create_user(phone="09120000002", password="pass", role="student", full_name="دانش آموز")
        consultant = User.objects.create_user(phone="09120000003", password="pass", role="consultant", full_name="مشاور اول")
        other = User.objects.create_user(phone="09120000004", password="pass", role="consultant", full_name="مشاور دوم")
        client = Client(enforce_csrf_checks=True)
        client.force_login(manager)
        token = client.get('/api/auth/csrf/').json()['csrfToken']
        assign_url = f'/api/manager/students/{student.pk}/assign/'
        response = client.post(assign_url, {'consultant_id': consultant.pk}, content_type='application/json', HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 200, response.content)
        request_id = response.json()['assignment']['assigned_request_id']
        client.force_login(consultant)
        self.assertEqual(client.get('/api/consultations/requests/').json()['results'][0]['student_id'], student.pk)
        token = client.get('/api/auth/csrf/').json()['csrfToken']
        response = client.post('/api/consultations/study-sessions/create/', {'student_id': student.pk, 'weekday': 0, 'subject': 'ریاضی', 'planned_minutes': 60}, content_type='application/json', HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 201, response.content)
        chat_url = f'/api/consultations/requests/{request_id}/messages/'
        self.assertEqual(client.post(chat_url, {'body': 'سلام'}, content_type='application/json', HTTP_X_CSRFTOKEN=token).status_code, 201)
        client.force_login(student)
        self.assertEqual(client.get('/api/consultations/requests/').json()['results'][0]['assigned_consultant_id'], consultant.pk)
        self.assertEqual(client.get('/api/consultations/study-sessions/').json()['results'][0]['subject'], 'ریاضی')
        self.assertEqual(client.get(chat_url).json()['results'][0]['body'], 'سلام')
        client.force_login(manager)
        token = client.get('/api/auth/csrf/').json()['csrfToken']
        self.assertEqual(client.post(assign_url, {'consultant_id': other.pk}, content_type='application/json', HTTP_X_CSRFTOKEN=token).status_code, 200)
        client.force_login(consultant)
        self.assertEqual(client.get('/api/consultations/requests/').json()['results'], [])
        self.assertEqual(client.get(chat_url).status_code, 403)
        client.force_login(other)
        self.assertEqual(client.get('/api/consultations/requests/').json()['results'][0]['student_id'], student.pk)
