from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.conf import settings
from django.db import models


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, phone, password=None, **extra_fields):
        if not phone:
            raise ValueError("شماره موبایل الزامی است")

        extra_fields.setdefault("full_name", "")
        user = self.model(phone=phone, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, phone, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("role", "admin")

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser باید is_staff=True باشد")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser باید is_superuser=True باشد")

        return self.create_user(phone=phone, password=password, **extra_fields)


class User(AbstractUser):
    username = None

    GRADE_CHOICES = tuple((str(grade), f"پایه {grade}") for grade in range(2, 13)) + (("graduate", "فارغ‌التحصیل"),)
    MAJOR_CHOICES = (
        ("math", "ریاضی فیزیک"),
        ("experimental", "تجربی"),
        ("humanities", "انسانی"),
        ("technical", "فنی"),
    )
    GENDER_CHOICES = (("female", "دختر"), ("male", "پسر"))

    phone = models.CharField(max_length=50, unique=True, verbose_name="نام کاربری یا شماره موبایل")
    full_name = models.CharField(max_length=100, verbose_name="نام و نام خانوادگی")
    national_id = models.CharField(max_length=20, blank=True, verbose_name="کد ملی")
    parent_phone = models.CharField(max_length=11, blank=True, verbose_name="شماره والد")
    grade = models.CharField(max_length=10, choices=GRADE_CHOICES, blank=True, verbose_name="پایه تحصیلی")
    major = models.CharField(max_length=20, choices=MAJOR_CHOICES, blank=True, verbose_name="رشته تحصیلی")
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True, verbose_name="جنسیت")

    ROLE_CHOICES = (
        ("student", "دانش‌آموز"),
        ("instructor", "مدرس"),
        ("consultant", "مشاور"),
        ("applicant", "متقاضی مشاوره"),
        ("manager", "مدیر مجموعه"),
        ("admin", "ادمین سایت"),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="student", verbose_name="نقش")

    USERNAME_FIELD = "phone"
    REQUIRED_FIELDS = []
    objects = UserManager()

    def __str__(self):
        return self.phone


class PendingRegistration(models.Model):
    phone = models.CharField(max_length=11, unique=True)
    full_name = models.CharField(max_length=100)
    national_id = models.CharField(max_length=20, blank=True)
    parent_phone = models.CharField(max_length=11, blank=True)
    grade = models.CharField(max_length=10, blank=True)
    major = models.CharField(max_length=20, blank=True)
    gender = models.CharField(max_length=10, blank=True)
    password_hash = models.CharField(max_length=128)
    verification_code_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.phone


class AuditEvent(models.Model):
    CATEGORY_CHOICES = (("auth", "ورود و حساب"), ("users", "کاربران"), ("consultation", "مشاوره"), ("schedule", "برنامه درسی"), ("content", "محتوا"), ("security", "امنیت"), ("system", "سیستم"))
    OUTCOME_CHOICES = (("success", "موفق"), ("denied", "ردشده"), ("error", "خطا"))
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_events")
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, db_index=True)
    action = models.CharField(max_length=80, db_index=True)
    outcome = models.CharField(max_length=12, choices=OUTCOME_CHOICES, db_index=True)
    subject = models.CharField(max_length=100, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=400, blank=True)
    details = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ("-created_at", "-id")
        indexes = [models.Index(fields=("category", "created_at"), name="audit_category_date_idx"), models.Index(fields=("actor", "created_at"), name="audit_actor_date_idx")]

    def __str__(self):
        return f"{self.action} · {self.created_at:%Y-%m-%d %H:%M:%S}"
