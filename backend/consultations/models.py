from django.conf import settings
from django.db import models
from django.db.models import Q


PLAN_CHOICES = (
    ("standard", "معمولی"),
    ("vip", "VIP"),
    ("super_vip", "Super VIP"),
)


class ConsultantProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="consultation_profile")
    bio = models.TextField(max_length=3000, blank=True, verbose_name="رزومه و معرفی")
    experience_years = models.PositiveSmallIntegerField(default=0, verbose_name="سابقه به سال")
    university_major = models.CharField(max_length=120, blank=True, verbose_name="رشته دانشگاهی")
    current_university = models.CharField(max_length=150, blank=True, verbose_name="دانشگاه فعلی")
    available_slots = models.PositiveSmallIntegerField(default=0, verbose_name="ظرفیت آزاد")
    birth_date = models.CharField(max_length=20, blank=True, verbose_name="تاریخ تولد شمسی")
    konkur_year = models.PositiveSmallIntegerField(null=True, blank=True, verbose_name="سال کنکور")
    konkur_quota = models.CharField(max_length=40, blank=True, verbose_name="سهمیه کنکور")
    quota_rank = models.PositiveIntegerField(null=True, blank=True, verbose_name="رتبه در سهمیه")
    resume_file = models.FileField(upload_to="resumes/", null=True, blank=True, verbose_name="فایل رزومه")
    application_status = models.CharField(
        max_length=20,
        choices=(("pending", "در انتظار بررسی"), ("approved", "تأییدشده"), ("rejected", "ردشده")),
        default="approved",
        verbose_name="وضعیت بررسی"
    )
    telegram_phone = models.CharField(max_length=20, blank=True, verbose_name="شماره تلگرام")
    telegram_chat_id = models.BigIntegerField(null=True, blank=True, db_index=True, verbose_name="شناسه چت تلگرام")
    telegram_link_token = models.CharField(max_length=64, blank=True, null=True, unique=True, verbose_name="توکن اتصال تلگرام")
    telegram_connected_at = models.DateTimeField(null=True, blank=True, verbose_name="زمان اتصال تلگرام")
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"پرونده مشاور {self.user.full_name or self.user.phone}"


class ConsultantApplication(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "در انتظار بررسی مدیر"
        APPROVED = "approved", "تأییدشده"
        REJECTED = "rejected", "ردشده"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="consultant_applications")
    phone = models.CharField(max_length=11, db_index=True, verbose_name="شماره موبایل")
    email = models.EmailField(blank=True, default="", verbose_name="ایمیل")
    full_name = models.CharField(max_length=100, verbose_name="نام و نام خانوادگی")
    national_id = models.CharField(max_length=20, blank=True, verbose_name="کد ملی")
    gender = models.CharField(max_length=10, blank=True, verbose_name="جنسیت")
    birth_date = models.CharField(max_length=20, blank=True, verbose_name="تاریخ تولد شمسی")
    konkur_year = models.PositiveSmallIntegerField(verbose_name="سال کنکور")
    konkur_quota = models.CharField(max_length=40, verbose_name="سهمیه کنکور")
    quota_rank = models.PositiveIntegerField(verbose_name="رتبه در سهمیه")
    university_major = models.CharField(max_length=120, blank=True, verbose_name="رشته دانشگاهی")
    current_university = models.CharField(max_length=150, blank=True, verbose_name="دانشگاه محل تحصیل")
    experience_years = models.PositiveSmallIntegerField(default=0, verbose_name="سابقه مشاوره")
    bio = models.TextField(max_length=3000, blank=True, verbose_name="سوابق و معرفی")
    resume_file = models.FileField(upload_to="resumes/", verbose_name="فایل رزومه")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING, db_index=True)
    decision_note = models.CharField(max_length=500, blank=True, verbose_name="توضیح مدیر")
    created_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"درخواست مشاور: {self.full_name} ({self.phone}) - {self.get_status_display()}"


class PendingConsultantRegistration(models.Model):
    phone = models.CharField(max_length=11, unique=True, verbose_name="شماره موبایل")
    full_name = models.CharField(max_length=100, verbose_name="نام و نام خانوادگی")
    national_id = models.CharField(max_length=20, blank=True, verbose_name="کد ملی")
    gender = models.CharField(max_length=10, blank=True, verbose_name="جنسیت")
    birth_date = models.CharField(max_length=20, blank=True, verbose_name="تاریخ تولد شمسی")
    konkur_year = models.PositiveSmallIntegerField(verbose_name="سال کنکور")
    konkur_quota = models.CharField(max_length=40, verbose_name="سهمیه کنکور")
    quota_rank = models.PositiveIntegerField(verbose_name="رتبه در سهمیه")
    university_major = models.CharField(max_length=120, blank=True, verbose_name="رشته دانشگاهی")
    current_university = models.CharField(max_length=150, blank=True, verbose_name="دانشگاه محل تحصیل")
    experience_years = models.PositiveSmallIntegerField(default=0, verbose_name="سابقه مشاوره")
    bio = models.TextField(max_length=3000, blank=True, verbose_name="سوابق و معرفی")
    resume_file_path = models.CharField(max_length=300, verbose_name="مسیر فایل رزومه")
    password_hash = models.CharField(max_length=128)
    verification_code_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"پیش‌ثبت‌نام مشاور: {self.phone}"


class ConsultantPlanPrice(models.Model):
    consultant = models.ForeignKey(ConsultantProfile, on_delete=models.CASCADE, related_name="plan_prices")
    plan = models.CharField(max_length=12, choices=PLAN_CHOICES)
    price_toman = models.PositiveBigIntegerField(default=0, verbose_name="قیمت به تومان")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("consultant", "plan"), name="unique_consultant_plan_price")]
        ordering = ("plan",)

    def __str__(self):
        return f"{self.consultant} · {self.get_plan_display()}"


class ConsultationRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "در انتظار بررسی مدیر"
        APPROVED = "approved", "تخصیص داده‌شده"
        REJECTED = "rejected", "ردشده"

    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="consultation_requests")
    plan = models.CharField(max_length=12, choices=PLAN_CHOICES)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING, db_index=True)
    assigned_consultant = models.ForeignKey(ConsultantProfile, on_delete=models.PROTECT, null=True, blank=True, related_name="assignments")
    assigned_price_toman = models.PositiveBigIntegerField(default=0)
    decision_note = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("student",),
                condition=Q(status__in=("pending", "approved")),
                name="one_active_consultation_per_student",
            ),
        ]

    def __str__(self):
        return f"درخواست {self.student.full_name} · {self.get_plan_display()}"


class ConsultationPreference(models.Model):
    request = models.ForeignKey(ConsultationRequest, on_delete=models.CASCADE, related_name="preferences")
    consultant = models.ForeignKey(ConsultantProfile, on_delete=models.PROTECT, related_name="preferences")
    order = models.PositiveSmallIntegerField()
    quoted_price_toman = models.PositiveBigIntegerField()

    class Meta:
        ordering = ("order",)
        constraints = [
            models.UniqueConstraint(fields=("request", "consultant"), name="unique_requested_consultant"),
            models.UniqueConstraint(fields=("request", "order"), name="unique_consultant_preference_order"),
        ]


class ConsultantManagerConversation(models.Model):
    consultant = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="manager_conversation")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at", "-id")

    def __str__(self):
        return f"گفت‌وگوی مدیر با {self.consultant.full_name or self.consultant_id}"


class ConsultationMessage(models.Model):
    request = models.ForeignKey(ConsultationRequest, on_delete=models.CASCADE, related_name="messages", null=True, blank=True)
    conversation = models.ForeignKey(ConsultantManagerConversation, on_delete=models.CASCADE, related_name="chat_messages", null=True, blank=True)
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="consultation_messages")
    body = models.CharField(max_length=4000, blank=True)
    image = models.ImageField(upload_to="chat/%Y/%m/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ("created_at", "id")
        constraints = [models.CheckConstraint(condition=(Q(request__isnull=False, conversation__isnull=True) | Q(request__isnull=True, conversation__isnull=False)), name="chat_message_exactly_one_room")]

    def __str__(self):
        return f"پیام {self.sender_id} در گفت‌وگو {self.request_id or self.conversation_id}"

from .study_models import StudySession
