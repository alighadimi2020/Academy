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
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"پرونده مشاور {self.user.full_name or self.user.phone}"


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


class ConsultationMessage(models.Model):
    request = models.ForeignKey(ConsultationRequest, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="consultation_messages")
    body = models.CharField(max_length=4000)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ("created_at", "id")

    def __str__(self):
        return f"پیام {self.sender_id} در درخواست {self.request_id}"
