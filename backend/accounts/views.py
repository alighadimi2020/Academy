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

        phone = valid_phone(data.get("phone"))

        # Optional fields (can be completed later in student profile)
        grade = str(data.get("grade", "")).strip()
        if grade and grade not in GRADE_VALUES:
            raise ValueError("پایه تحصیلی معتبر نیست.")

        major = str(data.get("major", "")).strip()
        if grade in MAJOR_GRADES and major and major not in MAJOR_VALUES:
            raise ValueError("رشته تحصیلی را انتخاب کنید.")
        if grade not in MAJOR_GRADES:
            major = ""

        gender = str(data.get("gender", "")).strip()
        if gender not in {"", "female", "male"}:
            raise ValueError("جنسیت انتخاب‌شده معتبر نیست.")

        national_id = normalize_digits(data.get("national_id", ""))
        if national_id and len(national_id) > 20:
            raise ValueError("کد ملی حداکثر ۲۰ کاراکتر است.")

        email = str(data.get("email", "")).strip().lower()[:100]
        if email and ("@" not in email or "." not in email):
            raise ValueError("فرمت ایمیل نامعتبر است.")

        parent_phone = valid_phone(data.get("parent_phone"), required=False)
        if phone == parent_phone and parent_phone:
            raise ValueError("شماره دانش‌آموز و والد نباید یکسان باشد.")

        raw_password = str(data.get("password", ""))
        if raw_password and len(raw_password) < 8:
            raise ValueError("رمز عبور باید حداقل ۸ کاراکتر باشد.")
        password = raw_password if raw_password else phone
    except ValueError as error:
        return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(phone=phone).exists():
        return Response({"detail": "با این شماره موبایل قبلاً حساب ساخته شده است. لطفاً وارد شوید."}, status=status.HTTP_409_CONFLICT)

    code = f"{secrets.randbelow(900000) + 100000}"
    expires_at = timezone.now() + timedelta(minutes=15)

    try:
        send_verification_code(phone, code)
    except Exception:
        pass

    PendingRegistration.objects.update_or_create(
        phone=phone,
        defaults={
            "full_name": full_name,
            "national_id": national_id,
            "parent_phone": parent_phone,
            "grade": grade,
            "major": major,
            "gender": gender,
            "password_hash": make_password(password),
            "verification_code_hash": make_password(code),
            "expires_at": expires_at,
            "attempts": 0,
        },
    )

    return Response(
        {
            "ok": True,
            "detail": "کد تایید ارسال شد.",
            "phone": phone,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def verify_registration(request):
    if not isinstance(request.data, dict):
        return Response({"detail": "اطلاعات تایید معتبر نیست."}, status=status.HTTP_400_BAD_REQUEST)
    phone = normalize_digits(request.data.get("phone", ""))
    code = normalize_digits(request.data.get("code", ""))
    if not phone:
        return Response({"detail": "شماره موبایل الزامی است."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        pending = PendingRegistration.objects.get(phone=phone)
    except PendingRegistration.DoesNotExist:
        existing = User.objects.filter(phone=phone).first()
        if existing and existing.is_active:
            request.session.flush()
            auth_login(request, existing)
            return Response({
                "ok": True,
                "detail": "وارد حساب کاربری شدید.",
                "redirect_url": "student.html#profile",
            }, status=status.HTTP_200_OK)
        return Response({"detail": "درخواست ثبت‌نام پیدا نشد؛ لطفاً دوباره ثبت‌نام را شروع کنید."}, status=status.HTTP_404_NOT_FOUND)

    # Note: As requested, SMS gateway is currently pending, so clicking confirm passes verification
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
            request.session.flush()
            auth_login(request, user)
            record_event(request, "auth.registration.succeeded", "users", "success", subject=f"user:{user.pk}", details={"target_user_id": user.pk, "role": user.role})
    except IntegrityError:
        return Response({"detail": "با این شماره موبایل قبلاً حساب ساخته شده است."}, status=status.HTTP_409_CONFLICT)

    return Response(
        {
            "ok": True,
            "detail": "ثبت‌نام با موفقیت انجام شد و وارد حساب کاربری شدید.",
            "redirect_url": "student.html#profile",
        },
        status=status.HTTP_201_CREATED,
    )


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
        raw_identifier = str(data.get("phone") or data.get("identifier") or data.get("username") or "").strip()
        identifier = normalize_digits(raw_identifier)
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
        "avatar_url": user.avatar.url if user.avatar else None,
        "email": user.email or "",
        "national_id": user.national_id or "",
        "parent_phone": user.parent_phone or "",
        "grade": user.grade,
        "grade_label": grade_labels.get(user.grade, "تعیین نشده"),
        "major": user.major,
        "major_label": major_labels.get(user.major, "تعیین نشده"),
        "gender": user.gender,
        "gender_label": dict(User.GENDER_CHOICES).get(user.gender, "ثبت نشده"),
    })
    return _add_no_cache_headers(response)


@csrf_protect
@never_cache
def upload_avatar(request):
    import os
    if not request.user.is_authenticated or not request.user.is_active:
        return JsonResponse({"detail": "وارد حساب کاربری شوید."}, status=401)

    if request.method == "DELETE":
        if request.user.avatar:
            try:
                request.user.avatar.delete(save=False)
            except Exception:
                pass
            request.user.avatar = None
            request.user.save(update_fields=["avatar"])
        return JsonResponse({"ok": True, "avatar_url": None, "detail": "تصویر پروفایل حذف شد."})

    if request.method != "POST":
        return JsonResponse({"detail": "متد مجاز نیست."}, status=405)

    file = request.FILES.get("avatar")
    if not file:
        return JsonResponse({"detail": "فایلی برای آپلود انتخاب نشده است."}, status=400)

    # 1. Size validation: max 10MB
    max_size = 10 * 1024 * 1024
    if file.size > max_size:
        return JsonResponse({"detail": "حجم تصویر نباید بیشتر از ۱۰ مگابایت باشد."}, status=400)

    # 2. Format validation: only image formats
    allowed_exts = {".jpg", ".jpeg", ".png", ".webp"}
    file_ext = os.path.splitext(file.name.lower())[1]
    if file_ext not in allowed_exts:
        return JsonResponse({"detail": "فقط فرمت‌های تصویری (JPG, PNG, WEBP) مجاز هستند."}, status=400)

    if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        return JsonResponse({"detail": "نوع فایل ارسالی معتبر نیست."}, status=400)

    try:
        from PIL import Image
        img = Image.open(file)
        img.verify()
        file.seek(0)
    except Exception:
        return JsonResponse({"detail": "فایل ارسالی یک تصویر معتبر و سالم نیست."}, status=400)

    if request.user.avatar:
        try:
            request.user.avatar.delete(save=False)
        except Exception:
            pass

    request.user.avatar = file
    request.user.save(update_fields=["avatar"])
    record_event(request, "user.avatar.uploaded", "users", "success", subject=f"user:{request.user.pk}")

    return JsonResponse({
        "ok": True,
        "avatar_url": request.user.avatar.url,
        "detail": "تصویر پروفایل شما با موفقیت ذخیره شد."
    })


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


@require_POST
@never_cache
@csrf_protect
def update_student_profile(request):
    if not request.user.is_authenticated or not request.user.is_active or request.user.role != "student":
        return JsonResponse({"detail": "فقط دانش‌آموز می‌تواند اطلاعات خودش را ویرایش کند."}, status=403 if request.user.is_authenticated else 401)
    try:
        data = json.loads(request.body or b"{}")
        if not isinstance(data, dict):
            raise ValueError("invalid payload")
    except (ValueError, json.JSONDecodeError):
        return JsonResponse({"detail": "اطلاعات ارسالی نامعتبر است."}, status=400)

    user = request.user
    errors = {}

    if "full_name" in data:
        full_name = str(data.get("full_name", "")).strip()
        if not full_name:
            errors["full_name"] = "نام و نام خانوادگی الزامی است."
        elif len(full_name) > 100:
            errors["full_name"] = "حداکثر ۱۰۰ کاراکتر مجاز است."
        else:
            user.full_name = full_name

    if "grade" in data:
        grade = str(data.get("grade", "")).strip()
        if grade and grade not in GRADE_VALUES:
            errors["grade"] = "پایه تحصیلی معتبر نیست."
        else:
            user.grade = grade
            if grade not in MAJOR_GRADES:
                user.major = ""

    if "major" in data:
        major = str(data.get("major", "")).strip()
        if user.grade in MAJOR_GRADES:
            if major and major not in MAJOR_VALUES:
                errors["major"] = "رشته تحصیلی معتبر نیست."
            else:
                user.major = major
        else:
            user.major = ""

    if "gender" in data:
        gender = str(data.get("gender", "")).strip()
        if gender not in {"", "female", "male"}:
            errors["gender"] = "جنسیت انتخاب‌شده معتبر نیست."
        else:
            user.gender = gender

    if "parent_phone" in data:
        parent_phone = normalize_digits(data.get("parent_phone", ""))
        if parent_phone:
            try:
                valid_phone(parent_phone)
                if parent_phone == user.phone:
                    errors["parent_phone"] = "شماره والد نباید با شماره دانش‌آموز یکسان باشد."
                else:
                    user.parent_phone = parent_phone
            except ValueError as err:
                errors["parent_phone"] = str(err)
        else:
            user.parent_phone = ""

    if "national_id" in data:
        national_id = normalize_digits(data.get("national_id", ""))
        if national_id and len(national_id) > 20:
            errors["national_id"] = "کد ملی حداکثر ۲۰ رقم است."
        else:
            user.national_id = national_id

    if "email" in data:
        email = str(data.get("email", "")).strip().lower()[:100]
        if email and ("@" not in email or "." not in email):
            errors["email"] = "فرمت ایمیل نامعتبر است."
        else:
            user.email = email

    if errors:
        return JsonResponse({"detail": "برخی از اطلاعات وارد شده نامعتبر هستند.", "errors": errors}, status=400)

    user.save()
    record_event(request, "student.profile.updated", "users", "success", subject=f"user:{user.pk}")
    grade_labels = dict(User.GRADE_CHOICES)
    major_labels = dict(User.MAJOR_CHOICES)
    return JsonResponse({
        "ok": True,
        "detail": "اطلاعات پروفایل با موفقیت به‌روزرسانی شد.",
        "user": {
            "id": user.id,
            "phone": user.phone,
            "full_name": user.full_name,
            "grade": user.grade,
            "grade_label": grade_labels.get(user.grade, "تعیین نشده"),
            "major": user.major,
            "major_label": major_labels.get(user.major, "تعیین نشده"),
            "gender": user.gender,
            "gender_label": dict(User.GENDER_CHOICES).get(user.gender, "ثبت نشده"),
            "parent_phone": user.parent_phone,
            "national_id": user.national_id,
            "email": user.email,
        }
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
    users_slice = list(users[:500])
    results = []

    assignment_map = {}
    consultant_student_counts = {}

    if role == "student":
        from consultations.models import ConsultationRequest
        student_ids = [u.id for u in users_slice]
        active_requests = ConsultationRequest.objects.filter(
            student_id__in=student_ids,
            status=ConsultationRequest.Status.APPROVED
        ).select_related("assigned_consultant__user")
        for req in active_requests:
            if req.assigned_consultant and req.assigned_consultant.user:
                assignment_map[req.student_id] = {
                    "assigned_consultant_id": req.assigned_consultant.user_id,
                    "assigned_consultant_name": req.assigned_consultant.user.full_name or req.assigned_consultant.user.phone,
                    "assigned_request_id": req.id,
                }
    elif role == "consultant":
        from consultations.models import ConsultationRequest
        from django.db.models import Count
        consultant_user_ids = [u.id for u in users_slice]
        counts = ConsultationRequest.objects.filter(
            status=ConsultationRequest.Status.APPROVED,
            assigned_consultant__user_id__in=consultant_user_ids
        ).values("assigned_consultant__user_id").annotate(total=Count("id"))
        for c in counts:
            consultant_student_counts[c["assigned_consultant__user_id"]] = c["total"]

    for user in users_slice:
        item = {
            "id": user.id,
            "full_name": user.full_name or "بدون نام",
            "phone": user.phone,
            "role": user.role,
            "is_active": user.is_active,
            "date_joined": user.date_joined.isoformat() if user.date_joined else None,
        }
        if role == "student":
            assign_info = assignment_map.get(user.id, {})
            item.update({
                "grade": user.grade,
                "grade_label": grade_labels.get(user.grade, "ثبت نشده"),
                "major_label": major_labels.get(user.major, ""),
                "parent_phone": user.parent_phone,
                "assigned_consultant_id": assign_info.get("assigned_consultant_id"),
                "assigned_consultant_name": assign_info.get("assigned_consultant_name"),
                "assigned_request_id": assign_info.get("assigned_request_id"),
            })
        elif role == "consultant":
            item["assigned_students_count"] = consultant_student_counts.get(user.id, 0)

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

    # Brute-force protection: rate limit failed attempts per user
    from django.core.cache import cache
    cache_key = f"pwd_fail_count_{request.user.id}"
    fail_count = cache.get(cache_key, 0)
    if fail_count >= 5:
        record_event(request, "auth.password.rate_limited", "auth", "denied", subject=request.user.phone)
        return JsonResponse({"detail": "به دلیل تلاش‌های ناموفق مکرر، دسترسی تغییر رمز عبور موقتاً مسدود شد. لطفاً ۱۵ دقیقه دیگر تلاش کنید."}, status=429)

    if not request.user.check_password(old_password):
        cache.set(cache_key, fail_count + 1, timeout=900)  # 15 minutes cooldown
        record_event(request, "auth.password.change_failed", "auth", "denied", subject=request.user.phone, details={"reason": "wrong_old_password"})
        remaining = max(0, 5 - (fail_count + 1))
        msg = "رمز عبور فعلی اشتباه است."
        if remaining <= 2:
            msg += f" ({remaining} تلاش دیگر تا قفل موقت حساب)"
        return JsonResponse({"detail": msg}, status=400)

    # Clear fail count on correct old password
    cache.delete(cache_key)

    if len(new_password) < 8:
        return JsonResponse({"detail": "رمز عبور جدید باید حداقل ۸ کاراکتر باشد."}, status=400)

    if new_password == old_password:
        return JsonResponse({"detail": "رمز عبور جدید نمی‌تواند همان رمز عبور قبلی شما باشد."}, status=400)

    if new_password != new_password_confirm:
        return JsonResponse({"detail": "تکرار رمز عبور جدید یکسان نیست."}, status=400)

    if new_password.isdigit():
        return JsonResponse({"detail": "رمز عبور نمی‌تواند صرفاً از ارقام عددی تشکیل شود. لطفاً از ترکیب حروف و ارقام استفاده کنید."}, status=400)

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


@require_POST
@csrf_protect
def manager_create_consultant(request):
    if not request.user.is_authenticated or not request.user.is_active:
        return JsonResponse({"detail": "وارد حساب کاربری شوید."}, status=401)
    if request.user.role not in {"manager", "admin"}:
        return JsonResponse({"detail": "دسترسی فقط مخصوص مدیر مجموعه است."}, status=403)

    try:
        data = json.loads(request.body or b"{}")
        full_name = str(data.get("full_name", "")).strip()
        raw_phone = str(data.get("phone", "")).strip()
        password = str(data.get("password", "")).strip()
    except (ValueError, json.JSONDecodeError):
        return JsonResponse({"detail": "اطلاعات ارسالی نامعتبر است."}, status=400)

    if not full_name:
        return JsonResponse({"detail": "نام و نام خانوادگی مشاور الزامی است."}, status=400)
    if len(full_name) > 100:
        return JsonResponse({"detail": "نام و نام خانوادگی نمی‌تواند بیش از ۱۰۰ کاراکتر باشد."}, status=400)

    try:
        phone = valid_phone(raw_phone)
    except ValueError as err:
        return JsonResponse({"detail": str(err)}, status=400)

    if not password:
        password = phone
    elif len(password) < 4:
        password = phone

    if User.objects.filter(phone=phone).exists():
        return JsonResponse({"detail": "کاربری با این شماره موبایل از قبل در سامانه ثبت شده است."}, status=409)

    from consultations.models import ConsultantProfile, ConsultantPlanPrice, PLAN_CHOICES

    try:
        with transaction.atomic():
            user = User.objects.create_user(
                phone=phone,
                full_name=full_name,
                password=password,
                role="consultant",
                is_active=True
            )
            profile, _ = ConsultantProfile.objects.get_or_create(
                user=user,
                defaults={
                    "application_status": "approved",
                    "available_slots": 50,
                    "bio": f"مشاور آکادمی پایه - {full_name}",
                }
            )
            for plan_key, _ in PLAN_CHOICES:
                ConsultantPlanPrice.objects.get_or_create(
                    consultant=profile,
                    plan=plan_key,
                    defaults={"price_toman": 0}
                )

            record_event(
                request,
                "manager.consultant.created",
                "users",
                "success",
                subject=f"user:{user.id}",
                details={"phone": user.phone, "name": user.full_name}
            )

        return JsonResponse({
            "ok": True,
            "detail": f"مشاور «{user.full_name}» با موفقیت افزوده شد.",
            "consultant": {
                "id": user.id,
                "full_name": user.full_name,
                "phone": user.phone,
                "role": user.role,
                "is_active": user.is_active,
                "date_joined": user.date_joined.isoformat() if user.date_joined else None,
                "assigned_students_count": 0,
            }
        }, status=201)
    except Exception as exc:
        return JsonResponse({"detail": f"خطا در ایجاد مشاور: {str(exc)}"}, status=500)


@require_POST
@csrf_protect
def manager_delete_consultant(request, user_id):
    if not request.user.is_authenticated or not request.user.is_active:
        return JsonResponse({"detail": "وارد حساب کاربری شوید."}, status=401)
    if request.user.role not in {"manager", "admin"}:
        return JsonResponse({"detail": "دسترسی فقط مخصوص مدیر مجموعه است."}, status=403)

    try:
        target_user = User.objects.get(pk=user_id, role="consultant")
    except User.DoesNotExist:
        return JsonResponse({"detail": "مشاور مورد نظر پیدا نشد."}, status=404)

    from consultations.models import (
        ConsultantProfile,
        ConsultationRequest,
        ConsultationPreference,
        ConsultationMessage,
        ConsultantManagerConversation,
    )

    try:
        with transaction.atomic():
            profile = getattr(target_user, "consultation_profile", None)
            if profile:
                # 1. Unassign all students assigned to this consultant
                ConsultationRequest.objects.filter(assigned_consultant=profile).update(
                    assigned_consultant=None,
                    status=ConsultationRequest.Status.REJECTED,
                    decision_note="مشاور از مجموعه حذف شد؛ لطفاً جهت تخصیص مشاور جدید با مدیریت تماس بگیرید."
                )
                # 2. Delete preferences referencing this consultant
                ConsultationPreference.objects.filter(consultant=profile).delete()

            # 3. Clean up messages and staff conversations
            ConsultationMessage.objects.filter(sender=target_user).delete()
            ConsultantManagerConversation.objects.filter(consultant=target_user).delete()

            phone_saved = target_user.phone
            name_saved = target_user.full_name or target_user.phone
            target_user.delete()

            record_event(
                request,
                "manager.consultant.deleted",
                "users",
                "success",
                subject=f"user:{user_id}",
                details={"phone": phone_saved, "name": name_saved}
            )

        return JsonResponse({
            "ok": True,
            "detail": f"مشاور «{name_saved}» با موفقیت حذف گردید."
        })
    except Exception as exc:
        return JsonResponse({"detail": f"خطا در حذف مشاور: {str(exc)}"}, status=500)


@require_POST
@csrf_protect
def manager_assign_student(request, student_id):
    if not request.user.is_authenticated or not request.user.is_active:
        return JsonResponse({"detail": "وارد حساب کاربری شوید."}, status=401)
    if request.user.role not in {"manager", "admin"}:
        return JsonResponse({"detail": "دسترسی فقط مخصوص مدیر مجموعه است."}, status=403)

    try:
        student_user = User.objects.get(pk=student_id, role="student")
    except User.DoesNotExist:
        return JsonResponse({"detail": "دانش‌آموز مورد نظر پیدا نشد."}, status=404)

    try:
        data = json.loads(request.body or b"{}")
        consultant_id = data.get("consultant_id")
    except (ValueError, json.JSONDecodeError):
        return JsonResponse({"detail": "اطلاعات ارسالی نامعتبر است."}, status=400)

    from consultations.models import ConsultantProfile, ConsultationRequest

    try:
        with transaction.atomic():
            if consultant_id:
                try:
                    consultant_user = User.objects.get(pk=consultant_id, role="consultant")
                except User.DoesNotExist:
                    return JsonResponse({"detail": "مشاور انتخاب‌شده پیدا نشد."}, status=404)

                profile, _ = ConsultantProfile.objects.get_or_create(
                    user=consultant_user,
                    defaults={"application_status": "approved", "available_slots": 50}
                )

                now = timezone.now()
                existing_req = ConsultationRequest.objects.filter(
                    student=student_user,
                    status__in=(ConsultationRequest.Status.PENDING, ConsultationRequest.Status.APPROVED)
                ).first()

                if existing_req:
                    existing_req.assigned_consultant = profile
                    existing_req.status = ConsultationRequest.Status.APPROVED
                    existing_req.decided_at = now
                    existing_req.decision_note = "تخصیص مستقیم توسط مدیر مجموعه"
                    existing_req.save(update_fields=["assigned_consultant", "status", "decided_at", "decision_note"])
                    req_id = existing_req.id
                else:
                    new_req = ConsultationRequest.objects.create(
                        student=student_user,
                        assigned_consultant=profile,
                        plan="standard",
                        status=ConsultationRequest.Status.APPROVED,
                        decided_at=now,
                        decision_note="تخصیص مستقیم توسط مدیر مجموعه"
                    )
                    req_id = new_req.id

                record_event(
                    request,
                    "manager.student.assigned",
                    "consultation",
                    "success",
                    subject=f"student:{student_id}",
                    details={"consultant_id": consultant_id, "consultant_name": consultant_user.full_name}
                )

                return JsonResponse({
                    "ok": True,
                    "detail": f"دانش‌آموز «{student_user.full_name or student_user.phone}» با موفقیت به «{consultant_user.full_name or consultant_user.phone}» اختصاص یافت.",
                    "assignment": {
                        "student_id": student_user.id,
                        "assigned_consultant_id": consultant_user.id,
                        "assigned_consultant_name": consultant_user.full_name or consultant_user.phone,
                        "assigned_request_id": req_id,
                    }
                })
            else:
                ConsultationRequest.objects.filter(
                    student=student_user,
                    status__in=(ConsultationRequest.Status.PENDING, ConsultationRequest.Status.APPROVED)
                ).update(
                    status=ConsultationRequest.Status.REJECTED,
                    decision_note="لغو تخصیص توسط مدیر مجموعه",
                    decided_at=timezone.now()
                )

                record_event(
                    request,
                    "manager.student.unassigned",
                    "consultation",
                    "success",
                    subject=f"student:{student_id}"
                )

                return JsonResponse({
                    "ok": True,
                    "detail": f"تخصیص مشاور برای دانش‌آموز «{student_user.full_name or student_user.phone}» لغو شد.",
                    "assignment": {
                        "student_id": student_user.id,
                        "assigned_consultant_id": None,
                        "assigned_consultant_name": None,
                        "assigned_request_id": None,
                    }
                })
    except Exception as exc:
        return JsonResponse({"detail": f"خطا در تخصیص مشاور: {str(exc)}"}, status=500)


@require_POST
@csrf_protect
def manager_create_student(request):
    if not request.user.is_authenticated or not request.user.is_active:
        return JsonResponse({"detail": "وارد حساب کاربری شوید."}, status=401)
    if request.user.role not in {"manager", "admin"}:
        return JsonResponse({"detail": "دسترسی فقط مخصوص مدیر مجموعه است."}, status=403)

    try:
        data = json.loads(request.body or b"{}")
        full_name = str(data.get("full_name", "")).strip()
        raw_phone = str(data.get("phone", "")).strip()
        password = str(data.get("password", "")).strip()
        grade = str(data.get("grade", "")).strip()
        major = str(data.get("major", "")).strip()
        parent_phone = str(data.get("parent_phone", "")).strip()
    except (ValueError, json.JSONDecodeError):
        return JsonResponse({"detail": "اطلاعات ارسالی نامعتبر است."}, status=400)

    if not full_name:
        return JsonResponse({"detail": "نام و نام خانوادگی دانش‌آموز الزامی است."}, status=400)
    if len(full_name) > 100:
        return JsonResponse({"detail": "نام و نام خانوادگی نمی‌تواند بیش از ۱۰۰ کاراکتر باشد."}, status=400)

    try:
        phone = valid_phone(raw_phone)
    except ValueError as err:
        return JsonResponse({"detail": str(err)}, status=400)

    if not password:
        password = phone
    elif len(password) < 4:
        password = phone

    if User.objects.filter(phone=phone).exists():
        return JsonResponse({"detail": "کاربری با این شماره موبایل از قبل در سامانه ثبت شده است."}, status=409)

    valid_grades = {str(g) for g in range(2, 13)} | {"graduate"}
    valid_majors = {"math", "experimental", "humanities", "technical"}

    if grade and grade not in valid_grades:
        grade = ""
    if major and major not in valid_majors:
        major = ""

    normalized_parent_phone = ""
    if parent_phone:
        try:
            normalized_parent_phone = valid_phone(parent_phone)
        except ValueError:
            normalized_parent_phone = normalize_digits(parent_phone)[:11]

    try:
        with transaction.atomic():
            user = User.objects.create_user(
                phone=phone,
                full_name=full_name,
                password=password,
                role="student",
                grade=grade,
                major=major,
                parent_phone=normalized_parent_phone,
                is_active=True
            )
            record_event(
                request,
                "manager.student.created",
                "users",
                "success",
                subject=f"user:{user.id}",
                details={"phone": user.phone, "name": user.full_name}
            )

        grade_labels = dict(User.GRADE_CHOICES)
        major_labels = dict(User.MAJOR_CHOICES)

        return JsonResponse({
            "ok": True,
            "detail": f"دانش‌آموز «{user.full_name}» با موفقیت افزوده شد.",
            "student": {
                "id": user.id,
                "full_name": user.full_name,
                "phone": user.phone,
                "role": user.role,
                "grade": user.grade,
                "grade_label": grade_labels.get(user.grade, "ثبت نشده"),
                "major_label": major_labels.get(user.major, ""),
                "parent_phone": user.parent_phone,
                "is_active": user.is_active,
                "date_joined": user.date_joined.isoformat() if user.date_joined else None,
                "assigned_consultant_id": None,
                "assigned_consultant_name": None,
                "assigned_request_id": None,
            }
        }, status=201)
    except Exception as exc:
        return JsonResponse({"detail": f"خطا در ایجاد دانش‌آموز: {str(exc)}"}, status=500)


@require_POST
@csrf_protect
def manager_delete_student(request, user_id):
    if not request.user.is_authenticated or not request.user.is_active:
        return JsonResponse({"detail": "وارد حساب کاربری شوید."}, status=401)
    if request.user.role not in {"manager", "admin"}:
        return JsonResponse({"detail": "دسترسی فقط مخصوص مدیر مجموعه است."}, status=403)

    try:
        target_user = User.objects.get(pk=user_id, role="student")
    except User.DoesNotExist:
        return JsonResponse({"detail": "دانش‌آموز مورد نظر پیدا نشد."}, status=404)

    from consultations.models import (
        ConsultationRequest,
        ConsultationPreference,
        ConsultationMessage,
    )

    try:
        with transaction.atomic():
            # Clean up student consultation requests and messages
            ConsultationMessage.objects.filter(sender=target_user).delete()
            reqs = ConsultationRequest.objects.filter(student=target_user)
            ConsultationPreference.objects.filter(request__in=reqs).delete()
            reqs.delete()

            # Clean up study sessions, timers, reports
            from consultations.study_models import StudyReport, StudyTimer, StudySession
            StudyReport.objects.filter(student=target_user).delete()
            StudyTimer.objects.filter(student=target_user).delete()
            StudySession.objects.filter(student=target_user).delete()

            phone_saved = target_user.phone
            name_saved = target_user.full_name or target_user.phone
            target_user.delete()

            record_event(
                request,
                "manager.student.deleted",
                "users",
                "success",
                subject=f"user:{user_id}",
                details={"phone": phone_saved, "name": name_saved}
            )

        return JsonResponse({
            "ok": True,
            "detail": f"دانش‌آموز «{name_saved}» با موفقیت حذف گردید."
        })
    except Exception as exc:
        return JsonResponse({"detail": f"خطا در حذف دانش‌آموز: {str(exc)}"}, status=500)


