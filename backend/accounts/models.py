from django.contrib.auth.models import AbstractUser, BaseUserManager
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

    phone = models.CharField(max_length=11, unique=True, verbose_name="شماره موبایل")
    full_name = models.CharField(max_length=100, verbose_name="نام و نام خانوادگی")
    national_id = models.CharField(max_length=20, blank=True, verbose_name="کد ملی")
    parent_phone = models.CharField(max_length=11, blank=True, verbose_name="شماره والد")
    grade = models.CharField(max_length=10, choices=GRADE_CHOICES, verbose_name="پایه تحصیلی")
    major = models.CharField(max_length=20, choices=MAJOR_CHOICES, blank=True, verbose_name="رشته تحصیلی")

    ROLE_CHOICES = (
        ("student", "دانش‌آموز"),
        ("instructor", "مدرس"),
        ("consultant", "مشاور"),
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
    grade = models.CharField(max_length=10)
    major = models.CharField(max_length=20, blank=True)
    password_hash = models.CharField(max_length=128)
    verification_code_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.phone
