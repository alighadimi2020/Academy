import json
import secrets
from datetime import timedelta

from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout
from django.contrib.auth.hashers import check_password, make_password
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST
from django.http import JsonResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import PendingRegistration, User
from .sms import send_verification_code


GRADE_VALUES = {str(grade) for grade in range(2, 13)} | {"graduate"}
MAJOR_VALUES = {"math", "experimental", "humanities", "technical"}
MAJOR_GRADES = {"10", "11", "12", "graduate"}


def normalize_digits(value):
    translation = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
    return str(value or "").translate(translation).strip()


def valid_phone(value, required=True):
    value = normalize_digits(value)
    if not value and not required:
        return value
    if len(value) != 11 or not value.startswith("09") or not value.isdigit():
        raise ValueError("شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.")
    return value


@api_view(["POST"])
@permission_classes([AllowAny])
def start_registration(request):
    data = request.data
    if not isinstance(data, dict):
        return Response({"detail": "اطلاعات ثبت‌نام معتبر نیست."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        full_name = str(data.get("full_name", "")).strip()
        if not full_name:
            raise ValueError("نام و نام خانوادگی را وارد کنید.")
        if len(full_name) > 100:
            raise ValueError("نام و نام خانوادگی حداکثر ۱۰۰ کاراکتر است.")

        grade = str(data.get("grade", "")).strip()
        if grade not in GRADE_VALUES:
            raise ValueError("پایه تحصیلی معتبر نیست.")

        major = str(data.get("major", "")).strip()
        if grade in MAJOR_GRADES and major not in MAJOR_VALUES:
            raise ValueError("رشته تحصیلی را انتخاب کنید.")
        if grade not in MAJOR_GRADES:
            major = ""

        national_id = normalize_digits(data.get("national_id", ""))
        if len(national_id) > 20:
            raise ValueError("کد ملی حداکثر ۲۰ کاراکتر است.")

        phone = valid_phone(data.get("phone"))
        parent_phone = valid_phone(data.get("parent_phone"), required=False)
        if phone == parent_phone and parent_phone:
            raise ValueError("شماره دانش‌آموز و والد نباید یکسان باشد.")

        password = str(data.get("password", ""))
        if len(password) < 8:
            raise ValueError("رمز عبور باید حداقل ۸ کاراکتر باشد.")
        if password != str(data.get("password_confirmation", "")):
            raise ValueError("تکرار رمز عبور با رمز عبور یکسان نیست.")
    except ValueError as error:
        return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(phone=phone).exists():
        return Response({"detail": "با این شماره موبایل قبلاً حساب ساخته شده است."}, status=status.HTTP_409_CONFLICT)

    code = f"{secrets.randbelow(1_000_000):06d}"
    pending, _ = PendingRegistration.objects.update_or_create(
        phone=phone,
        defaults={
            "full_name": full_name,
            "national_id": national_id,
            "parent_phone": parent_phone,
            "grade": grade,
            "major": major,
            "password_hash": make_password(password),
            "verification_code_hash": make_password(code),
            "expires_at": timezone.now() + timedelta(minutes=5),
            "attempts": 0,
        },
    )

    try:
        send_verification_code(phone, code)
    except Exception:
        pending.delete()
        return Response({"detail": "ارسال کد تایید انجام نشد. تنظیمات سرویس پیامک را بررسی کنید."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    return Response(
        {"detail": "کد تایید آماده ارسال است. در حالت توسعه، ترمینال بک‌اند را بررسی کنید."},
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def verify_registration(request):
    if not isinstance(request.data, dict):
        return Response({"detail": "اطلاعات تایید معتبر نیست."}, status=status.HTTP_400_BAD_REQUEST)
    phone = normalize_digits(request.data.get("phone", ""))
    code = normalize_digits(request.data.get("code", ""))
    if not phone or not code:
        return Response({"detail": "شماره موبایل و کد تایید الزامی است."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        pending = PendingRegistration.objects.get(phone=phone)
    except PendingRegistration.DoesNotExist:
        return Response({"detail": "درخواست ثبت‌نام پیدا نشد؛ دوباره ثبت‌نام را شروع کنید."}, status=status.HTTP_404_NOT_FOUND)

    if pending.expires_at <= timezone.now():
        pending.delete()
        return Response({"detail": "کد تایید منقضی شده است؛ دوباره درخواست کد کنید."}, status=status.HTTP_400_BAD_REQUEST)
    if pending.attempts >= 5:
        pending.delete()
        return Response({"detail": "تعداد تلاش‌ها بیش از حد مجاز بود؛ ثبت‌نام را دوباره شروع کنید."}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    if not check_password(code, pending.verification_code_hash):
        pending.attempts += 1
        pending.save(update_fields=["attempts"])
        return Response({"detail": "کد تایید نادرست است."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        with transaction.atomic():
            user = User(
                phone=pending.phone,
                full_name=pending.full_name,
                national_id=pending.national_id,
                parent_phone=pending.parent_phone,
                grade=pending.grade,
                major=pending.major,
                role="student",
                is_active=True,
                password=pending.password_hash,
            )
            user.save()
            pending.delete()
    except IntegrityError:
        return Response({"detail": "با این شماره موبایل قبلاً حساب ساخته شده است."}, status=status.HTTP_409_CONFLICT)

    return Response({"detail": "شماره تایید شد و حساب کاربری ساخته شد."}, status=status.HTTP_201_CREATED)


@require_GET
@ensure_csrf_cookie
def csrf_token(request):
    from django.middleware.csrf import get_token
    return JsonResponse({"csrfToken": get_token(request)})


@require_POST
@csrf_protect
def login_user(request):
    try:
        data = json.loads(request.body or b"{}")
        if not isinstance(data, dict):
            raise ValueError("invalid payload")
        phone = valid_phone(data.get("phone"))
        password = str(data.get("password", ""))
        if not password:
            raise ValueError("شماره موبایل یا رمز عبور نادرست است.")
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({"detail": "شماره موبایل یا رمز عبور نادرست است."}, status=400)

    user = authenticate(request, phone=phone, password=password)
    if user is None or not user.is_active:
        return JsonResponse({"detail": "شماره موبایل یا رمز عبور نادرست است."}, status=401)

    auth_login(request, user)
    request.session.set_expiry(1209600 if data.get("remember") else 0)
    return JsonResponse({"detail": "ورود موفق بود.", "role": user.role})


@require_GET
def current_user(request):
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "وارد حساب کاربری شوید."}, status=401)
    user = request.user
    grade_labels = dict(User.GRADE_CHOICES)
    major_labels = dict(User.MAJOR_CHOICES)
    return JsonResponse({
        "id": user.id,
        "phone": user.phone,
        "role": user.role,
        "full_name": user.full_name,
        "grade": user.grade,
        "grade_label": grade_labels.get(user.grade, ""),
        "major": user.major,
        "major_label": major_labels.get(user.major, ""),
    })


@require_GET
def manager_user_list(request):
    if not request.user.is_authenticated or not request.user.is_active:
        return JsonResponse({"detail": "وارد حساب کاربری شوید."}, status=401)
    if request.user.role not in {"manager", "admin"}:
        return JsonResponse({"detail": "دسترسی مشاهده فهرست کاربران را ندارید."}, status=403)
    role = request.GET.get("role", "")
    if role not in {"student", "consultant"}:
        return JsonResponse({"detail": "نوع فهرست معتبر نیست."}, status=400)
    query = request.GET.get("q", "").strip()[:100]
    users = User.objects.filter(role=role).order_by("full_name", "id")
    if query:
        from django.db.models import Q
        users = users.filter(Q(full_name__icontains=query) | Q(phone__icontains=query))
    grade_labels = dict(User.GRADE_CHOICES)
    major_labels = dict(User.MAJOR_CHOICES)
    results = []
    for user in users[:500]:
        item = {
            "id": user.id,
            "full_name": user.full_name or "بدون نام",
            "phone": user.phone,
            "role": user.role,
            "is_active": user.is_active,
            "date_joined": user.date_joined.isoformat() if user.date_joined else None,
        }
        if role == "student":
            item.update({
                "grade": user.grade,
                "grade_label": grade_labels.get(user.grade, "ثبت نشده"),
                "major_label": major_labels.get(user.major, ""),
                "parent_phone": user.parent_phone,
            })
        results.append(item)
    return JsonResponse({"results": results, "count": len(results)})


@require_POST
@csrf_protect
def logout_user(request):
    auth_logout(request)
    return JsonResponse({"detail": "خروج انجام شد."})
