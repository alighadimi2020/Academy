import json
import secrets
from datetime import timedelta

from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout
from django.contrib.auth.hashers import check_password, make_password
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST
from django.http import JsonResponse


def _add_no_cache_headers(response):
    response["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
    response["Pragma"] = "no-cache"
    response["Expires"] = "0"
    return response
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import PendingRegistration, User
from .audit import record_event
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

        gender = str(data.get("gender", "")).strip()
        if gender not in {"", "female", "male"}:
            raise ValueError("جنسیت انتخاب‌شده معتبر نیست.")

        national_id = normalize_digits(data.get("national_id", ""))
        if len(national_id) > 20:
            raise ValueError("کد ملی حداکثر ۲۰ کاراکتر است.")

        email = str(data.get("email", "")).strip().lower()[:100]
        if email and ("@" not in email or "." not in email):
            raise ValueError("فرمت ایمیل نامعتبر است.")

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

    try:
        with transaction.atomic():
            user = User(
                phone=phone,
                email=email,
                full_name=full_name,
                national_id=national_id,
                parent_phone=parent_phone,
                grade=grade,
                major=major,
                gender=gender,
                role="student",
                is_active=True,
                password=make_password(password),
            )
            user.save()
            auth_login(request, user)
            record_event(request, "auth.registration.succeeded", "users", "success", subject=f"user:{user.pk}", details={"target_user_id": user.pk, "role": user.role})
    except IntegrityError:
        return Response({"detail": "با این شماره موبایل قبلاً حساب ساخته شده است."}, status=status.HTTP_409_CONFLICT)

    return Response(
        {
            "ok": True,
            "detail": "حساب کاربری با موفقیت ساخته شد و وارد شدید.",
            "direct_login": True,
            "redirect_url": "student.html",
        },
        status=status.HTTP_201_CREATED,
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
                gender=pending.gender,
                role="student",
                is_active=True,
                password=pending.password_hash,
            )
            user.save()
            pending.delete()
            record_event(request, "auth.registration.succeeded", "users", "success", subject=f"user:{user.pk}", details={"target_user_id": user.pk, "role": user.role})
    except IntegrityError:
        return Response({"detail": "با این شماره موبایل قبلاً حساب ساخته شده است."}, status=status.HTTP_409_CONFLICT)

    return Response({"detail": "شماره تایید شد و حساب کاربری ساخته شد."}, status=status.HTTP_201_CREATED)


@require_GET
@never_cache
@ensure_csrf_cookie
def csrf_token(request):
    from django.middleware.csrf import get_token
    response = JsonResponse({"csrfToken": get_token(request)})
    return _add_no_cache_headers(response)


@require_POST
@never_cache
@csrf_protect
def login_user(request):
    try:
        data = json.loads(request.body or b"{}")
        if not isinstance(data, dict):
            raise ValueError("invalid payload")
        identifier = str(data.get("phone") or data.get("identifier") or data.get("username") or "").strip()
        password = str(data.get("password", ""))
        if not identifier or not password:
            raise ValueError("شماره موبایل، ایمیل یا رمز عبور الزامی است.")

        if "@" in identifier:
            matched_user = User.objects.filter(email__iexact=identifier).first()
            if matched_user:
                phone = matched_user.phone
            else:
                phone = identifier
        else:
            matched_user = User.objects.filter(phone__iexact=identifier).first()
            if matched_user:
                phone = matched_user.phone
            else:
                try:
                    phone = valid_phone(identifier)
                except ValueError:
                    phone = identifier
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
        record_event(request, "auth.login.invalid_request", "auth", "denied", details={"reason": "invalid_login_payload"})
        response = JsonResponse({"detail": "نام کاربری، شماره موبایل، ایمیل یا رمز عبور نادرست است."}, status=400)
        return _add_no_cache_headers(response)

    user = authenticate(request, phone=phone, password=password)
    if user is None or not user.is_active:
        masked = phone[-4:] if len(phone) >= 4 else phone
        record_event(request, "auth.login.failed", "auth", "denied", subject=f"id-ends-{masked}", details={"reason": "invalid_credentials"})
        response = JsonResponse({"detail": "شماره موبایل/ایمیل یا رمز عبور نادرست است."}, status=401)
        return _add_no_cache_headers(response)

    request.session.flush()
    auth_login(request, user)
    record_event(request, "auth.login.succeeded", "auth", "success", subject=user.phone, details={"role": user.role})
    request.session.set_expiry(1209600 if data.get("remember") else 0)
    response = JsonResponse({"detail": "ورود موفق بود.", "role": user.role})
    return _add_no_cache_headers(response)


@require_GET
@never_cache
def current_user(request):
    if not request.user.is_authenticated or not request.user.is_active:
        response = JsonResponse({"detail": "وارد حساب کاربری شوید."}, status=401)
        return _add_no_cache_headers(response)
    user = request.user
    grade_labels = dict(User.GRADE_CHOICES)
    major_labels = dict(User.MAJOR_CHOICES)
    response = JsonResponse({
        "id": user.id,
        "phone": user.phone,
        "role": user.role,
        "full_name": user.full_name,
        "grade": user.grade,
        "grade_label": grade_labels.get(user.grade, ""),
        "major": user.major,
        "major_label": major_labels.get(user.major, ""),
        "gender": user.gender,
        "gender_label": dict(User.GENDER_CHOICES).get(user.gender, "ثبت نشده"),
    })
    return _add_no_cache_headers(response)


@require_POST
@csrf_protect
def update_student_gender(request):
    if not request.user.is_authenticated or not request.user.is_active or request.user.role != "student":
        return JsonResponse({"detail": "فقط دانش‌آموز می‌تواند اطلاعات خودش را ویرایش کند."}, status=403 if request.user.is_authenticated else 401)
    try:
        data = json.loads(request.body or b"{}")
        gender = str(data.get("gender", "")).strip()
    except (ValueError, TypeError, AttributeError):
        return JsonResponse({"detail": "اطلاعات ارسالی معتبر نیست."}, status=400)
    if gender not in {"", "female", "male"}:
        return JsonResponse({"detail": "جنسیت انتخاب‌شده معتبر نیست."}, status=400)
    request.user.gender = gender
    request.user.save(update_fields=["gender"])
    record_event(request, "student.gender.updated", "users", "success", subject=f"user:{request.user.pk}")
    return JsonResponse({"gender": gender, "gender_label": dict(User.GENDER_CHOICES).get(gender, "ثبت نشده")})


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
@never_cache
@csrf_protect
def logout_user(request):
    if request.user.is_authenticated:
        record_event(request, "auth.logout", "auth", "success", subject=request.user.phone)
    auth_logout(request)
    request.session.flush()
    response = JsonResponse({"detail": "خروج انجام شد."})
    return _add_no_cache_headers(response)


@require_POST
@csrf_protect
def change_password(request):
    if not request.user.is_authenticated or not request.user.is_active:
        return JsonResponse({"detail": "وارد حساب کاربری شوید."}, status=401)

    try:
        data = json.loads(request.body or b"{}")
        old_password = str(data.get("old_password", ""))
        new_password = str(data.get("new_password", ""))
        new_password_confirm = str(data.get("new_password_confirm", ""))
    except (ValueError, json.JSONDecodeError):
        return JsonResponse({"detail": "اطلاعات ارسالی نامعتبر است."}, status=400)

    if not old_password:
        return JsonResponse({"detail": "رمز عبور فعلی الزامی است."}, status=400)

    if not request.user.check_password(old_password):
        record_event(request, "auth.password.change_failed", "auth", "denied", subject=request.user.phone, details={"reason": "wrong_old_password"})
        return JsonResponse({"detail": "رمز عبور فعلی اشتباه است."}, status=400)

    if len(new_password) < 8:
        return JsonResponse({"detail": "رمز عبور جدید باید حداقل ۸ کاراکتر باشد."}, status=400)

    if new_password != new_password_confirm:
        return JsonResponse({"detail": "تکرار رمز عبور جدید یکسان نیست."}, status=400)

    request.user.set_password(new_password)
    request.user.save(update_fields=["password"])
    auth_login(request, request.user)
    record_event(request, "auth.password.changed", "auth", "success", subject=request.user.phone)
    return JsonResponse({"ok": True, "detail": "رمز عبور با موفقیت تغییر یافت."})


@require_POST
@csrf_protect
def manager_set_user_password(request, user_id):
    if not request.user.is_authenticated or not request.user.is_active:
        return JsonResponse({"detail": "وارد حساب کاربری شوید."}, status=401)
    if request.user.role not in {"manager", "admin"}:
        return JsonResponse({"detail": "دسترسی فقط مخصوص مدیر مجموعه است."}, status=403)

    try:
        target_user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return JsonResponse({"detail": "کاربر مورد نظر پیدا نشد."}, status=404)

    if (target_user.role in {"manager", "admin"} or target_user.is_superuser) and not request.user.is_superuser and request.user != target_user:
        return JsonResponse({"detail": "شما مجاز به تغییر رمز عبور این مدیر یا ادمین نیستید."}, status=403)

    try:
        data = json.loads(request.body or b"{}")
        password = str(data.get("password", "")).strip()
    except (ValueError, json.JSONDecodeError):
        return JsonResponse({"detail": "اطلاعات ارسالی نامعتبر است."}, status=400)

    if not password:
        password = f"Paye@{secrets.randbelow(900000) + 100000}"
    elif len(password) < 6:
        return JsonResponse({"detail": "رمز عبور باید حداقل ۶ کاراکتر باشد."}, status=400)

    target_user.set_password(password)
    target_user.save(update_fields=["password"])
    record_event(request, "manager.user.password_reset", "users", "success", subject=f"user:{target_user.pk}", details={"phone": target_user.phone})
    return JsonResponse({
        "ok": True,
        "detail": f"رمز عبور جدید برای {target_user.full_name or target_user.phone} با موفقیت تنظیم شد.",
        "credentials": {
            "full_name": target_user.full_name or "کاربر",
            "phone": target_user.phone,
            "password": password
        }
    })

