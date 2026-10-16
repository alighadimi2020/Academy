import datetime
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.db import transaction

from accounts.models import User
from consultations.models import (
    ConsultantProfile,
    ConsultantPlanPrice,
    ConsultantApplication,
    ConsultationRequest,
    ConsultationPreference,
    ConsultantManagerConversation,
    ConsultationMessage,
)
from consultations.study_models import (
    StudySession,
    StudyTimer,
    StudyReport,
    StudyReportFeedback,
)
from blog.models import BlogPost, BlogImage

def seed():
    with transaction.atomic():
        print("--- 1. Creating Users ---")
        # 1. Student danesh / 1234
        student, _ = User.objects.get_or_create(phone="danesh", defaults={
            "full_name": "دانیال دانش‌پژوه",
            "role": "student",
            "grade": "11",
            "major": "experimental",
            "gender": "male",
            "is_active": True,
        })
        student.full_name = "دانیال دانش‌پژوه"
        student.role = "student"
        student.grade = "11"
        student.major = "experimental"
        student.gender = "male"
        student.is_active = True
        student.set_password("1234")
        student.save()
        print("Student created/updated: danesh (1234)")

        # 2. Consultant moshaver / 1234
        consultant, _ = User.objects.get_or_create(phone="moshaver", defaults={
            "full_name": "دکتر محمد امینی",
            "role": "consultant",
            "gender": "male",
            "is_active": True,
        })
        consultant.full_name = "دکتر محمد امینی"
        consultant.role = "consultant"
        consultant.gender = "male"
        consultant.is_active = True
        consultant.set_password("1234")
        consultant.save()
        print("Consultant created/updated: moshaver (1234)")

        # 3. Second consultant dr_moradi / 1234 (for multi-consultant marketplace)
        consultant2, _ = User.objects.get_or_create(phone="dr_moradi", defaults={
            "full_name": "مهندس سارا مرادی",
            "role": "consultant",
            "gender": "female",
            "is_active": True,
        })
        consultant2.full_name = "مهندس سارا مرادی"
        consultant2.role = "consultant"
        consultant2.gender = "female"
        consultant2.is_active = True
        consultant2.set_password("1234")
        consultant2.save()
        print("Second consultant created: dr_moradi (1234)")

        # 4. Pending applicant for manager review
        applicant, _ = User.objects.get_or_create(phone="applicant_reza", defaults={
            "full_name": "رضا کمالی",
            "role": "applicant",
            "gender": "male",
            "is_active": True,
        })
        applicant.set_password("1234")
        applicant.save()

        # Manager user: ensure aliAhmadloo or taha exists
        manager = User.objects.filter(role__in=["manager", "admin"]).first()
        if not manager:
            manager = User.objects.create_superuser(phone="manager", password="1234", full_name="مدیر مجموعه", role="manager")
        print(f"Manager in use: {manager.phone} ({manager.full_name})")

        print("--- 2. Setting Consultant Profiles & Prices ---")
        p1, _ = ConsultantProfile.objects.get_or_create(user=consultant)
        p1.bio = "فارغ‌التحصیل دکتری حرفه‌ای پزشکی دانشگاه علوم پزشکی تهران، رتبه ۷۲ کنکور تجربی، ۱۰ سال سابقه مشاوره تخصصی کنکور و برنامه‌ریزی فردی برای رتبه‌های برتر."
        p1.experience_years = 10
        p1.university_major = "پزشکی"
        p1.current_university = "دانشگاه علوم پزشکی تهران"
        p1.available_slots = 15
        p1.konkur_year = 1395
        p1.konkur_quota = "منطقه ۱"
        p1.quota_rank = 72
        p1.application_status = "approved"
        p1.save()

        for plan, price in [("standard", 1200000), ("vip", 2500000), ("super_vip", 4000000)]:
            ConsultantPlanPrice.objects.update_or_create(consultant=p1, plan=plan, defaults={"price_toman": price})

        p2, _ = ConsultantProfile.objects.get_or_create(user=consultant2)
        p2.bio = "رتبه ۳۴ کنکور ریاضی، کارشناسی ارشد مهندسی برق دانشگاه صنعتی شریف، متخصص برنامه‌ریزی دروس ریاضی و فیزیک با ۷ سال سابقه تدریس و مشاوره."
        p2.experience_years = 7
        p2.university_major = "مهندسی برق"
        p2.current_university = "دانشگاه صنعتی شریف"
        p2.available_slots = 10
        p2.konkur_year = 1397
        p2.konkur_quota = "منطقه ۱"
        p2.quota_rank = 34
        p2.application_status = "approved"
        p2.save()

        for plan, price in [("standard", 1000000), ("vip", 2000000), ("super_vip", 3500000)]:
            ConsultantPlanPrice.objects.update_or_create(consultant=p2, plan=plan, defaults={"price_toman": price})

        # Pending application for manager review
        ConsultantApplication.objects.update_or_create(
            user=applicant,
            defaults={
                "phone": "09129876543",
                "email": "reza.kamali@example.com",
                "full_name": "رضا کمالی",
                "gender": "male",
                "birth_date": "1380/04/15",
                "konkur_year": 1400,
                "konkur_quota": "منطقه ۲",
                "quota_rank": 215,
                "university_major": "دندانپزشکی",
                "current_university": "دانشگاه شهید بهشتی",
                "experience_years": 2,
                "bio": "دانشجوی سال چهارم دندانپزشکی شهید بهشتی، متقاضی همکاری در هدایت تحصیلی و مشاوره دانش‌آموزان کنکوری.",
                "status": ConsultantApplication.Status.PENDING,
            }
        )

        print("--- 3. Setting Consultation Request & Allocation ---")
        # Consultation request for danesh (approved to moshaver)
        req, created = ConsultationRequest.objects.get_or_create(student=student, defaults={
            "plan": "vip",
            "status": ConsultationRequest.Status.APPROVED,
            "assigned_consultant": p1,
            "assigned_price_toman": 2500000,
            "decision_note": "درخواست مشاوره تایید و دکتر محمد امینی به عنوان مشاور اختصاصی شما تخصیص یافت.",
        })
        if not created:
            req.plan = "vip"
            req.status = ConsultationRequest.Status.APPROVED
            req.assigned_consultant = p1
            req.assigned_price_toman = 2500000
            req.decision_note = "درخواست مشاوره تایید و دکتر محمد امینی به عنوان مشاور اختصاصی شما تخصیص یافت."
            req.save()

        ConsultationPreference.objects.filter(request=req).delete()
        ConsultationPreference.objects.create(request=req, consultant=p1, order=1, quoted_price_toman=2500000)
        ConsultationPreference.objects.create(request=req, consultant=p2, order=2, quoted_price_toman=2000000)

        # Another student with pending request for manager to test allocation
        student_pending, _ = User.objects.get_or_create(phone="sara_rad", defaults={
            "full_name": "سارا رادمنش",
            "role": "student",
            "grade": "12",
            "major": "experimental",
            "gender": "female",
            "is_active": True,
        })
        student_pending.set_password("1234")
        student_pending.save()

        req_pending, _ = ConsultationRequest.objects.get_or_create(student=student_pending, defaults={
            "plan": "standard",
            "status": ConsultationRequest.Status.PENDING,
        })
        req_pending.status = ConsultationRequest.Status.PENDING
        req_pending.assigned_consultant = None
        req_pending.save()
        ConsultationPreference.objects.filter(request=req_pending).delete()
        ConsultationPreference.objects.create(request=req_pending, consultant=p2, order=1, quoted_price_toman=1000000)
        ConsultationPreference.objects.create(request=req_pending, consultant=p1, order=2, quoted_price_toman=1200000)

        print("--- 4. Setting Chat Messages ---")
        # Chat between student (danesh) and consultant (moshaver)
        ConsultationMessage.objects.filter(request=req).delete()
        ConsultationMessage.objects.create(
            request=req,
            sender=student,
            body="سلام استاد امینی خسته نباشید، من فصل ۲ زیست دوازدهم رو خوندم ولی حس می‌کنم تو تست‌های زمان‌دار درصدم پایینه. به نظرتون چطور مرورش کنم؟"
        )
        ConsultationMessage.objects.create(
            request=req,
            sender=consultant,
            body="سلام دانیال جان، خدا قوت. برای زیست دوازدهم بعد از اولین دور مطالعه، تست‌های آموزشی بزن و نکات شکل‌ها رو یادداشت کن. ۴۸ ساعت بعد تست‌های پوششی زمان‌دار کار کن."
        )
        ConsultationMessage.objects.create(
            request=req,
            sender=student,
            body="ممنون استاد، برای تایم‌بندی برنامه این هفته چند پارت زیست بذارم؟"
        )
        ConsultationMessage.objects.create(
            request=req,
            sender=consultant,
            body="توی برنامه هفتگیت برات ۴ باکس ۹۰ دقیقه‌ای زیست همراه با ۶۰ تست تفکیکی چیدم. حتما گزارش کار هر روز رو ثبت کن تا بررسی کنم."
        )

        # Chat between consultant (moshaver) and manager
        mgr_conv, _ = ConsultantManagerConversation.objects.get_or_create(consultant=consultant)
        ConsultationMessage.objects.filter(conversation=mgr_conv).delete()
        ConsultationMessage.objects.create(
            conversation=mgr_conv,
            sender=consultant,
            body="سلام جناب مدیر، گزارش هفتگی عملکرد دانش‌آموزان آماده است. میانگین ساعت مطالعه بچه‌ها به ۷.۵ ساعت در روز رسیده و روند رضایت‌بخشه."
        )
        ConsultationMessage.objects.create(
            conversation=mgr_conv,
            sender=manager,
            body="سلام آقای دکتر امینی، بسیار عالی و خدا قوت. لطفاً وضعیت گزارش‌های شبانه دانش‌آموزان جدید رو هم با دقت بیشتری رصد بفرمایید."
        )
        ConsultationMessage.objects.create(
            conversation=mgr_conv,
            sender=consultant,
            body="حتماً، بازخوردهای شبانه روی سامانه به صورت روزانه ثبت میشه و دانش‌آموزان کاملاً هماهنگ هستند."
        )

        print("--- 5. Setting Weekly Study Sessions ---")
        StudySession.objects.filter(student=student).delete()
        StudySession.objects.bulk_create([
            StudySession(student=student, consultant=consultant, weekday=0, start_time=datetime.time(8, 0), end_time=datetime.time(9, 30), subject="زیست‌شناسی ۳", mode="study", test_count=30, planned_minutes=90, instructions="فصل ۲ - بررسی دقیق شکل‌ها و چرخه سلولی", color="mint"),
            StudySession(student=student, consultant=consultant, weekday=0, start_time=datetime.time(10, 0), end_time=datetime.time(11, 15), subject="شیمی ۳", mode="test", test_count=25, planned_minutes=75, instructions="مسائل اسید و باز - حل تست‌های کنکور سراسری ۹۹ تا ۱۴۰۲", color="amber"),
            StudySession(student=student, consultant=consultant, weekday=1, start_time=datetime.time(8, 30), end_time=datetime.time(10, 0), subject="فیزیک ۳", mode="study", test_count=20, planned_minutes=90, instructions="حرکت‌شناسی - حرکت با شتاب ثابت و حل تست‌های تیپ", color="sky"),
            StudySession(student=student, consultant=consultant, weekday=1, start_time=datetime.time(10, 30), end_time=datetime.time(11, 45), subject="ریاضی ۳", mode="test", test_count=25, planned_minutes=75, instructions="تابع و حد - حل سوالات تست منتخب", color="lavender"),
            StudySession(student=student, consultant=consultant, weekday=2, start_time=datetime.time(14, 0), end_time=datetime.time(15, 0), subject="زیست‌شناسی ۳", mode="written", test_count=15, planned_minutes=60, instructions="مرور متن کتاب و حل سوالات تشریحی امتحانات نهایی", color="mint"),
            StudySession(student=student, consultant=consultant, weekday=2, start_time=datetime.time(15, 30), end_time=datetime.time(16, 15), subject="زبان انگلیسی", mode="study", test_count=20, planned_minutes=45, instructions="گرامر درس اول و ریدینگ کلوزتست", color="rose"),
            StudySession(student=student, consultant=consultant, weekday=3, start_time=datetime.time(8, 0), end_time=datetime.time(9, 30), subject="شیمی ۳", mode="study", test_count=30, planned_minutes=90, instructions="الکتروشیمی - اکسایش و کاهش", color="amber"),
            StudySession(student=student, consultant=consultant, weekday=3, start_time=datetime.time(10, 0), end_time=datetime.time(11, 0), subject="فیزیک ۳", mode="test", test_count=20, planned_minutes=60, instructions="تست‌های نوسان و موج", color="sky"),
        ])

        print("--- 6. Setting Study Timers, Reports and Feedbacks ---")
        StudyTimer.objects.filter(student=student).delete()
        StudyReport.objects.filter(student=student).delete()
        StudyReportFeedback.objects.filter(student=student).delete()

        today = timezone.localdate()
        # Today's completed timers
        t1 = StudyTimer.objects.create(
            student=student,
            subject="زیست‌شناسی ۳",
            study_date=today,
            elapsed_seconds=90 * 60,
            finished_at=timezone.now(),
            delivered_at=timezone.now(),
            notes="فصل ۲ را با دقت خواندم و ۳۰ تست آموزشی حل کردم."
        )
        StudyReport.objects.create(
            timer=t1,
            student=student,
            consultant=consultant,
            study_date=today,
            subject="زیست‌شناسی ۳",
            minutes=90,
            notes="فصل ۲ را با دقت خواندم و ۳۰ تست آموزشی حل کردم."
        )

        t2 = StudyTimer.objects.create(
            student=student,
            subject="شیمی ۳",
            study_date=today,
            elapsed_seconds=75 * 60,
            finished_at=timezone.now(),
            delivered_at=timezone.now(),
            notes="مسائل اسید و باز حل شد و درصد آزمونک ۸۲٪ شد."
        )
        StudyReport.objects.create(
            timer=t2,
            student=student,
            consultant=consultant,
            study_date=today,
            subject="شیمی ۳",
            minutes=75,
            notes="مسائل اسید و باز حل شد و درصد آزمونک ۸۲٪ شد."
        )

        # Past days reports
        past_records = [
            (today - datetime.timedelta(days=1), "فیزیک ۳", 180, "حل ۶۰ تست حرکت‌شناسی و مرور جزوه استاد"),
            (today - datetime.timedelta(days=1), "زیست‌شناسی ۳", 150, "مطالعه گفتار ۳ فصل ۱ دوازدهم"),
            (today - datetime.timedelta(days=1), "ریاضی ۳", 90, "تست‌های ترکیب توابع"),
            (today - datetime.timedelta(days=2), "شیمی ۳", 210, "مفاهیم سینتیک و تعادل‌ها"),
            (today - datetime.timedelta(days=2), "زیست‌شناسی ۳", 180, "تست‌های تالیفی فصل ژنتیک"),
            (today - datetime.timedelta(days=3), "فیزیک ۳", 150, "الکتریسیته ساکن و حل تیپ‌های پرتکرار"),
            (today - datetime.timedelta(days=3), "شیمی ۳", 180, "استوکیومتری و واکنش‌های شیمیایی"),
            (today - datetime.timedelta(days=3), "ریاضی ۳", 150, "حد و پیوستگی"),
        ]

        for s_date, subj, mins, note in past_records:
            StudyReport.objects.create(
                student=student,
                consultant=consultant,
                study_date=s_date,
                subject=subj,
                minutes=mins,
                notes=note
            )

        # Consultant Feedback for yesterday
        StudyReportFeedback.objects.create(
            student=student,
            consultant=consultant,
            study_date=today - datetime.timedelta(days=1),
            feedback_text="آفرین دانیال جان، ساعت مطالعه ۷ ساعت دیروز و تعادل تست‌های فیزیک و زیست بسیار عالی بود. امروز طبق برنامه باکس‌های شیمی رو با دقت بالا ادامه بده.",
            source="web"
        )

        print("--- 7. Setting High Quality Blog Posts & Images ---")
        BlogPost.objects.all().delete()

        # Post 1
        p1_post = BlogPost.objects.create(
            title="راهنمای جامع مدیریت زمان و استراتژی بازگشت در کنکور سراسری",
            summary="چگونه در آزمون‌های آزمایشی و کنکور سراسری زمان خود را مدیریت کنیم و با تکنیک ضربدر منها و زمان‌های نقصانی بالاترین تراز را کسب نماییم.",
            category="مشاوره و برنامه‌ریزی",
            reading_minutes=6,
            author=consultant,
            status=BlogPost.Status.PUBLISHED,
            approved_by=manager,
            published_at=timezone.now() - datetime.timedelta(days=2),
            sections=[
                {
                    "heading": "چرا مدیریت زمان کلید موفقیت در آزمون است؟",
                    "body": "در کنکور سراسری، آزمون صرفاً سنجش دانش علمی شما نیست؛ بلکه مهارت در مدیریت زمان، تصمیم‌گیری سریع و حفظ خونسردی در شرایط حساس است. بسیاری از داوطلبانی که سطح علمی برابری دارند، صرفاً به دلیل تخصیص نادرست دقایق به سوالات وقت‌گیر، شانس پاسخگویی به سوالات ساده را از دست می‌دهند."
                },
                {
                    "heading": "تکنیک ضربدر و منها به شیوه حرفه‌ای‌ها",
                    "body": "هنگام مطالعه دفترچه سوالات، سوالات را به سه دسته تقسیم کنید: سوالاتی که بلافاصله راه‌حل آن‌ها را می‌دانید (پاسخ دهید)، سوالاتی که وقت‌گیرند ولی بلد هستید (علامت ضربدر بگذارید)، و سوالاتی که سخت هستند یا مبحث را نخوانده‌اید (علامت منها بگذارید). این کار مانع از قفل شدن ذهن در ۲۰ دقیقه اول آزمون می‌شود."
                },
                {
                    "heading": "اجرای زمان‌های نقصانی و استراتژی بازگشت",
                    "body": "برای هر درس، ۵ الی ۱۰ دقیقه از وقت قانونی را ذخیره کنید. در دور اول تمام سوالات ساده را پاسخ دهید و در وقت ذخیره‌شده (استراتژی بازگشت)، به سراغ سوالات علامت‌دار بروید. با این روش حداقل ۱۵ الی ۲۰ درصد افزایش درصد را در هر درس تجربه خواهید کرد."
                }
            ]
        )
        BlogImage.objects.create(
            post=p1_post,
            image="blog/2026/10/time_management.jpg",
            alt_text="مدیریت زمان در کنکور",
            order=0,
            after_section=0
        )

        # Post 2
        p2_post = BlogPost.objects.create(
            title="تکنیک مرور فعال و منحنی فراموشی ابینگهاوس در یادگیری دروس تحلیلی",
            summary="بررسی علمی فاصله‌گذاری زمانی در مطالعه و روش‌های بازیابی فعال اطلاعات برای ماندگاری طولانی‌مدت مباحث در حافظه بلندمدت.",
            category="روش‌های مطالعه",
            reading_minutes=5,
            author=consultant,
            status=BlogPost.Status.PUBLISHED,
            approved_by=manager,
            published_at=timezone.now() - datetime.timedelta(days=1),
            sections=[
                {
                    "heading": "منحنی فراموشی چیست و مغز چگونه اطلاعات را پاک می‌کند؟",
                    "body": "هرمان ابینگهاوس نشان داد که بدون مرور فعال، تا ۷۰ درصد اطلاعات آموخته‌شده ظرف ۲۴ ساعت اول از دست می‌رود. اما اگر مرورها در فواصل زمانی مشخص (روز بعد، ۳ روز بعد، ۱۰ روز بعد و ۱ ماه بعد) تکرار شوند، منحنی فراموشی صاف شده و دانش در حافظه دائم ثبت می‌شود."
                },
                {
                    "heading": "تفاوت مرور فعال (Active Recall) با روخوانی غیرفعال",
                    "body": "بزرگ‌ترین خطای دانش‌آموزان این است که جزوه یا کتاب را باز می‌کنند و صرفاً آن را روخوانی می‌کنند. این کار خطای حس یادگیری ایجاد می‌کند. در روش مرور فعال، کتاب را ببندید و تلاش کنید سرفصل‌ها، فرمول‌ها و نکات کلیدی را روی برگه سفید پیاده کنید یا به خودتان تدریس نمایید."
                },
                {
                    "heading": "استفاده از جعبه لایتنر و تست‌های پوششی",
                    "body": "برای دروس زیست، حفظیات شیمی و لغات، استفاده از تست‌های پوششی هفتگی بهترین مکمل مرور است. هر آخر هفته بخشی از زمان مطالعه را به زدن تست از مباحث دو هفته قبل اختصاص دهید تا تسلط حفظ شود."
                }
            ]
        )
        BlogImage.objects.create(
            post=p2_post,
            image="blog/2026/10/ebbinghaus_review.jpg",
            alt_text="منحنی فراموشی و مرور فعال",
            order=0,
            after_section=0
        )

        # Post 3
        p3_post = BlogPost.objects.create(
            title="چگونه شیمی کنکور را بالای ۸۰ درصد بزنیم؟ تحلیل کامل فصول و دام‌های آموزشی",
            summary="دسته‌بندی مباحث حفظی، مفهومی و محاسباتی شیمی سه پایه و راهکارهای غلبه بر دام‌های تست‌های تیپ‌بندی شده کنکور.",
            category="تحلیل دروس کنکور",
            reading_minutes=7,
            author=manager,
            status=BlogPost.Status.PUBLISHED,
            approved_by=manager,
            published_at=timezone.now(),
            sections=[
                {
                    "heading": "تقسیم‌بندی سوالات شیمی کنکور: حفظی، مفاهیم و مسائل",
                    "body": "درس شیمی شامل سه بخش اصلی است: ۳۵٪ متن و حفظیات کتاب، ۳۰٪ مفاهیم ساختاری و واکنش‌ها، و ۳۵٪ مسائل محاسباتی استوکیومتری و محلول‌ها و تعادل. برای درصد بالای ۸۰ باید برای هر بخش استراتژی مجزا داشته باشید."
                },
                {
                    "heading": "تکنیک‌های محاسبات سریع در مسائل استوکیومتری",
                    "body": "بسیاری از داوطلبان روش حل مساله را می‌دانند اما در ضرب و تقسیم اعداد اعشاری وقت کم می‌آورند. تسلط بر ساده‌سازی کسرها، برآورد مرتبه بزرگی اعداد و تکنیک فاکتور تبدیل به شما اجازه می‌دهد هر مسئله را زیر ۹۰ ثانیه حل کنید."
                },
                {
                    "heading": "دام‌های رایج طراحان کنکور در سوالات شمارشی",
                    "body": "سوالات «چند مورد از عبارت‌های زیر درست است؟» بیشترین نمره منفی را می‌سازند. برای پاسخ به این سوالات، با مداد زیر قیدهایی مثل 'همه، هرگز، به طور معمول، اغلب' خط بکشید و بلافاصله استثناهای کتاب درسی را به یاد بیاورید."
                }
            ]
        )
        BlogImage.objects.create(
            post=p3_post,
            image="blog/2026/10/chemistry_strategy.jpg",
            alt_text="تحلیل درس شیمی کنکور",
            order=0,
            after_section=0
        )

        # Post 4 (Pending post for testing manager moderation)
        p4_post = BlogPost.objects.create(
            title="۵ عادت طلایی رتبه‌های تک‌رقمی در ماه‌های پایانی کنکور",
            summary="نکات ناگفته از سبک زندگی، استراحت، تغذیه و شیوه شبیه‌سازی آزمون در روزهای منتهی به کنکور سراسری.",
            category="مقاله‌های پیشنهادی",
            reading_minutes=4,
            author=consultant,
            status=BlogPost.Status.PENDING,
            sections=[
                {
                    "heading": "تنظیم ساعت بیولوژیک خواب و بیداری",
                    "body": "حداقل دو ماه مانده به کنکور باید ساعت بیداری دقیقاً منطبق بر صبح آزمون باشد. خوابیدن بعد از ساعت ۲۳ و بیداری در ساعت ۶ صبح ترشح هورمون‌های هوشیاری را تنظیم می‌کند."
                },
                {
                    "heading": "شبیه‌سازی کامل شرایط حوزه آزمون",
                    "body": "زدن آزمون‌های جامع کنکورهای سال‌های گذشته باید با لباس رسمی، ماسک، روی صندلی غیرراحتی و بدون استپ کردن زمان انجام شود تا بدن به استرس آزمون عادت کند."
                }
            ]
        )
        BlogImage.objects.create(
            post=p4_post,
            image="blog/2026/10/top_rank_habits.jpg",
            alt_text="عادت‌های رتبه‌های برتر",
            order=0,
            after_section=0
        )

        print("--- SEEDING COMPLETED SUCCESSFULLY ---")

seed()
