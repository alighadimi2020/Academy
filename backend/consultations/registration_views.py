import json
import secrets
from datetime import timedelta
from pathlib import Path
from django.conf import settings
from django.contrib.auth import login as auth_login
from django.contrib.auth.hashers import check_password, make_password
from django.db import transaction
from django.http import FileResponse, Http404, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from accounts.audit import record_event
from accounts.models import User
from accounts.sms import send_verification_code
from accounts.views import normalize_digits, valid_phone
from .models import ConsultantApplication, ConsultantProfile, PendingConsultantRegistration
from .resume_security import validate_and_save_resume

ALLOWED_QUOTAS = {"منطقه ۱", "منطقه ۲", "منطقه ۳", "۵ درصد", "۲۵ درصد", "سایر / آزاد"}


def _authenticated_role(request, allowed_roles: set[str]) -> bool:
    return bool(request.user.is_authenticated and request.user.is_active and request.user.role in allowed_roles)


@require_POST
@csrf_protect
def start_consultant_registration(request):
    try:
        full_name = str(request.POST.get("full_name", "")).strip()
        if not full_name:
            raise ValueError("نام و نام خانوادگی را وارد کنید.")
        if len(full_name) > 100:
            raise ValueError("نام و نام خانوادگی حداکثر ۱۰۰ کاراکتر است.")

        phone = valid_phone(request.POST.get("phone"))

        # Check if already an approved active consultant
        if User.objects.filter(phone=phone, role="consultant", is_active=True).exists():
            return JsonResponse({"detail": "با این شماره موبایل قبلاً حساب مشاور فعال ثبت شده است. لطفاً وارد شوید."}, status=409)

        # Check if an application is currently pending
        pending_app = ConsultantApplication.objects.filter(phone=phone, status=ConsultantApplication.Status.PENDING).first()
        if pending_app:
            return JsonResponse({
                "detail": "درخواست همکاری شما با این شماره قبلاً ثبت شده و در انتظار بررسی مدیر مجموعه است.",
                "pending_application": True
            }, status=409)

        national_id = normalize_digits(request.POST.get("national_id", ""))
        if len(national_id) > 20:
            raise ValueError("کد ملی حداکثر ۲۰ رقم است.")

        gender = str(request.POST.get("gender", "")).strip()
        if gender not in {"", "female", "male"}:
            raise ValueError("جنسیت انتخاب‌شده معتبر نیست.")

        birth_date = normalize_digits(request.POST.get("birth_date", "")).strip()
        if not birth_date:
            raise ValueError("تاریخ تولد را انتخاب کنید.")

        raw_konkur_year = normalize_digits(request.POST.get("konkur_year", ""))
        if not raw_konkur_year or not raw_konkur_year.isdigit():
            raise ValueError("سال کنکور الزامی است.")
        konkur_year = int(raw_konkur_year)
        if konkur_year < 1360 or konkur_year > 1410:
            raise ValueError("سال کنکور معتبر نیست.")

        konkur_quota = str(request.POST.get("konkur_quota", "")).strip()
        if konkur_quota not in ALLOWED_QUOTAS:
            raise ValueError("سهمیه کنکور انتخاب‌شده معتبر نیست.")

        raw_quota_rank = normalize_digits(request.POST.get("quota_rank", ""))
        if not raw_quota_rank or not raw_quota_rank.isdigit():
            raise ValueError("رتبه در سهمیه الزامی و باید عدد باشد.")
        quota_rank = int(raw_quota_rank)
        if quota_rank <= 0:
            raise ValueError("رتبه در سهمیه باید بزرگتر از صفر باشد.")

        university_major = str(request.POST.get("university_major", "")).strip()[:120]
        current_university = str(request.POST.get("current_university", "")).strip()[:150]

        raw_experience = normalize_digits(request.POST.get("experience_years", "0"))
        experience_years = int(raw_experience) if raw_experience.isdigit() else 0

        bio = str(request.POST.get("bio", "")).strip()[:3000]

        password = str(request.POST.get("password", ""))
        if len(password) < 8:
            raise ValueError("رمز عبور باید حداقل ۸ کاراکتر باشد.")
        password_confirmation = str(request.POST.get("password_confirmation", ""))
        if password != password_confirmation:
            raise ValueError("تکرار رمز عبور با رمز عبور یکسان نیست.")

        resume_file = request.FILES.get("resume_file")
        if not resume_file:
            raise ValueError("فایل رزومه الزامی است.")

        saved_resume_path = validate_and_save_resume(resume_file)

    except ValueError as error:
        return JsonResponse({"detail": str(error)}, status=400)
    except Exception as exc:
        return JsonResponse({"detail": f"خطا در پردازش اطلاعات: {exc}"}, status=400)

    # Check if a pending registration is currently locked out by rate limiting
    existing_pending = PendingConsultantRegistration.objects.filter(phone=phone).first()
    if existing_pending and existing_pending.attempts >= 4 and existing_pending.last_attempt_at:
        lock_until = existing_pending.last_attempt_at + timedelta(minutes=2)
        now = timezone.now()
        if now < lock_until:
            remaining_seconds = int((lock_until - now).total_seconds())
            return JsonResponse({
                "detail": f"به دلیل بیش از ۴ بار ورود کد اشتباه، تا {remaining_seconds} ثانیه دیگر امکان درخواست جدید ندارید.",
                "locked": True,
                "remaining_seconds": remaining_seconds
            }, status=429)

    code = f"{secrets.randbelow(1_000_000):06d}"
    pending, _ = PendingConsultantRegistration.objects.update_or_create(
        phone=phone,
        defaults={
            "full_name": full_name,
            "national_id": national_id,
            "gender": gender,
            "birth_date": birth_date,
            "konkur_year": konkur_year,
            "konkur_quota": konkur_quota,
            "quota_rank": quota_rank,
            "university_major": university_major,
            "current_university": current_university,
            "experience_years": experience_years,
            "bio": bio,
            "resume_file_path": saved_resume_path,
            "password_hash": make_password(password),
            "verification_code_hash": make_password(code),
            "expires_at": timezone.now() + timedelta(minutes=5),
            "attempts": 0,
            "last_attempt_at": None,
        }
    )

    try:
        send_verification_code(phone, code)
    except Exception:
        pending.delete()
        return JsonResponse({"detail": "ارسال کد تأیید انجام نشد. سرویس پیامک را بررسی کنید."}, status=503)

    return JsonResponse({"ok": True, "detail": "کد تأیید برای شماره شما ارسال شد."})


@require_POST
@csrf_protect
def verify_consultant_registration(request):
    try:
        data = json.loads(request.body or b"{}")
        phone = valid_phone(data.get("phone"))
        code = normalize_digits(data.get("code", ""))
        if not code or len(code) != 6:
            raise ValueError("کد تایید ۶ رقمی را وارد کنید.")
    except (ValueError, json.JSONDecodeError):
        return JsonResponse({"detail": "اطلاعات ارسالی معتبر نیست."}, status=400)

    pending = PendingConsultantRegistration.objects.filter(phone=phone).first()
    if not pending:
        return JsonResponse({"detail": "درخواست ثبت‌نامی برای این شماره یافت نشد؛ دوباره ثبت‌نام را شروع کنید."}, status=404)

    now = timezone.now()

    # Rate limiting: 4 failed attempts -> 2 minutes lockout
    if pending.attempts >= 4 and pending.last_attempt_at:
        lockout_end = pending.last_attempt_at + timedelta(minutes=2)
        if now < lockout_end:
            remaining = int((lockout_end - now).total_seconds())
            return JsonResponse({
                "detail": f"به دلیل بیش از ۴ بار ورود کد اشتباه، تا {remaining} ثانیه دیگر امکان درخواست ندارید.",
                "locked": True,
                "remaining_seconds": remaining
            }, status=429)
        else:
            # 2 minutes passed! Reset attempts to give the user another chance
            pending.attempts = 0
            pending.save(update_fields=["attempts"])

    # Check expiration
    if pending.expires_at <= now:
        return JsonResponse({"detail": "کد تأیید منقضی شده است؛ لطفاً درخواست کد مجدد دهید."}, status=400)

    # Check code correctness
    if not check_password(code, pending.verification_code_hash):
        pending.attempts += 1
        pending.last_attempt_at = now
        pending.save(update_fields=["attempts", "last_attempt_at"])

        if pending.attempts >= 4:
            return JsonResponse({
                "detail": "کد واردشده نادرست است. شما بیش از ۴ بار کد اشتباه وارد کردید؛ لطفاً ۲ دقیقه دیگر دوباره تلاش کنید.",
                "locked": True,
                "remaining_seconds": 120
            }, status=429)
        else:
            remaining_tries = 4 - pending.attempts
            return JsonResponse({
                "detail": f"کد تأیید نادرست است. ({remaining_tries} فرصت دیگر تا قفل ۲ دقیقه‌ای)",
                "attempts_left": remaining_tries
            }, status=400)

    # Correct code! Create user and ConsultantApplication
    with transaction.atomic():
        user = User.objects.filter(phone=phone).first()
        if user:
            user.full_name = pending.full_name
            user.national_id = pending.national_id
            user.gender = pending.gender
            user.role = "applicant"
            user.is_active = True
            user.password = pending.password_hash
            user.save()
        else:
            user = User.objects.create(
                phone=phone,
                full_name=pending.full_name,
                national_id=pending.national_id,
                gender=pending.gender,
                role="applicant",
                is_active=True,
                password=pending.password_hash,
            )

        # Create ConsultantApplication
        application = ConsultantApplication.objects.create(
            user=user,
            phone=phone,
            full_name=pending.full_name,
            national_id=pending.national_id,
            gender=pending.gender,
            birth_date=pending.birth_date,
            konkur_year=pending.konkur_year,
            konkur_quota=pending.konkur_quota,
            quota_rank=pending.quota_rank,
            university_major=pending.university_major,
            current_university=pending.current_university,
            experience_years=pending.experience_years,
            bio=pending.bio,
            resume_file=pending.resume_file_path,
            status=ConsultantApplication.Status.PENDING,
        )

        # Create or update profile
        profile, _ = ConsultantProfile.objects.get_or_create(user=user)
        profile.birth_date = pending.birth_date
        profile.konkur_year = pending.konkur_year
        profile.konkur_quota = pending.konkur_quota
        profile.quota_rank = pending.quota_rank
        profile.university_major = pending.university_major
        profile.current_university = pending.current_university
        profile.experience_years = pending.experience_years
        profile.bio = pending.bio
        profile.resume_file = pending.resume_file_path
        profile.application_status = "pending"
        profile.save()

        pending.delete()

        auth_login(request, user)
        record_event(request, "consultant.registration.submitted", "consultation", "success", subject=user.phone)

    return JsonResponse({
        "ok": True,
        "detail": "شماره تأیید شد و پروندهٔ همکاری شما برای بررسی مدیریت ارسال گردید.",
        "status": "pending",
        "role": user.role
    }, status=201)


@require_GET
def consultant_application_status(request):
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "وارد حساب کاربری شوید."}, status=401)

    app = ConsultantApplication.objects.filter(user=request.user).order_by("-created_at").first()
    if not app:
        return JsonResponse({"has_application": False, "role": request.user.role})

    return JsonResponse({
        "has_application": True,
        "id": app.id,
        "full_name": app.full_name,
        "phone": app.phone,
        "status": app.status,
        "status_label": app.get_status_display(),
        "decision_note": app.decision_note or "",
        "created_at": app.created_at.strftime("%Y/%m/%d - %H:%M"),
        "decided_at": app.decided_at.strftime("%Y/%m/%d - %H:%M") if app.decided_at else None,
        "role": request.user.role,
    })


@require_GET
def manager_consultant_applications(request):
    if not _authenticated_role(request, {"manager", "admin"}):
        return JsonResponse({"detail": "دسترسی مجاز نیست."}, status=403)

    status_filter = request.GET.get("status", "")
    apps = ConsultantApplication.objects.all().select_related("user").order_by("-created_at")
    if status_filter in {ConsultantApplication.Status.PENDING, ConsultantApplication.Status.APPROVED, ConsultantApplication.Status.REJECTED}:
        apps = apps.filter(status=status_filter)

    results = []
    for app in apps:
        resume_filename = Path(app.resume_file.name).name if app.resume_file else ""
        results.append({
            "id": app.id,
            "user_id": app.user_id,
            "full_name": app.full_name,
            "phone": app.phone,
            "national_id": app.national_id,
            "gender": app.gender,
            "birth_date": app.birth_date,
            "konkur_year": app.konkur_year,
            "konkur_quota": app.konkur_quota,
            "quota_rank": app.quota_rank,
            "university_major": app.university_major,
            "current_university": app.current_university,
            "experience_years": app.experience_years,
            "bio": app.bio,
            "status": app.status,
            "status_label": app.get_status_display(),
            "decision_note": app.decision_note or "",
            "resume_filename": resume_filename,
            "resume_url": f"/api/consultations/manager/resumes/{resume_filename}/" if resume_filename else "",
            "created_at": app.created_at.strftime("%Y/%m/%d - %H:%M"),
            "decided_at": app.decided_at.strftime("%Y/%m/%d - %H:%M") if app.decided_at else None,
        })

    return JsonResponse({"results": results, "count": len(results)})


@require_POST
@csrf_protect
def manager_decide_consultant_application(request, application_id):
    if not _authenticated_role(request, {"manager", "admin"}):
        return JsonResponse({"detail": "دسترسی مجاز نیست."}, status=403)

    try:
        data = json.loads(request.body or b"{}")
        action = str(data.get("action", "")).strip()
        decision_note = str(data.get("decision_note", "")).strip()[:500]
        if action not in {"approve", "reject"}:
            raise ValueError("عملیات نامعتبر است.")
    except (ValueError, json.JSONDecodeError):
        return JsonResponse({"detail": "اطلاعات ارسالی نامعتبر است."}, status=400)

    app = ConsultantApplication.objects.filter(pk=application_id).select_related("user").first()
    if not app:
        return JsonResponse({"detail": "درخواست یافت نشد."}, status=404)

    with transaction.atomic():
        if action == "approve":
            chosen_password = str(data.get("password", "")).strip()
            if not chosen_password:
                chosen_password = f"Paye@{secrets.randbelow(900000) + 100000}"
            elif len(chosen_password) < 6:
                return JsonResponse({"detail": "رمز عبور مشاور باید حداقل ۶ کاراکتر باشد."}, status=400)

            user = app.user
            custom_phone = str(data.get("phone", "")).strip()
            if custom_phone and custom_phone != user.phone:
                try:
                    validated_phone = valid_phone(custom_phone)
                except ValueError as err:
                    return JsonResponse({"detail": str(err)}, status=400)
                if User.objects.filter(phone=validated_phone).exclude(pk=user.pk).exists():
                    return JsonResponse({"detail": "کاربر دیگری با این شماره موبایل در سیستم وجود دارد."}, status=409)
                user.phone = validated_phone
                app.phone = validated_phone

            user.set_password(chosen_password)
            user.role = "consultant"
            user.is_active = True
            user.save()

            app.status = ConsultantApplication.Status.APPROVED
            app.decided_at = timezone.now()
            app.decision_note = decision_note
            app.save()

            profile, _ = ConsultantProfile.objects.get_or_create(user=user)
            profile.application_status = "approved"
            profile.university_major = app.university_major or profile.university_major
            profile.current_university = app.current_university or profile.current_university
            profile.experience_years = app.experience_years or profile.experience_years
            profile.bio = app.bio or profile.bio
            profile.birth_date = app.birth_date or profile.birth_date
            profile.konkur_year = app.konkur_year or profile.konkur_year
            profile.konkur_quota = app.konkur_quota or profile.konkur_quota
            profile.quota_rank = app.quota_rank or profile.quota_rank
            if app.resume_file:
                profile.resume_file = app.resume_file
            profile.save()

            record_event(request, "consultant.application.approved", "consultation", "success", subject=f"user:{user.pk}", details={"phone": user.phone})
            return JsonResponse({
                "ok": True,
                "detail": f"مشاور {app.full_name} تأیید شد و حساب کاربری او فعال گردید.",
                "credentials": {
                    "full_name": app.full_name,
                    "phone": user.phone,
                    "password": chosen_password,
                    "login_url": "/login.html"
                }
            })

        elif action == "reject":
            app.status = ConsultantApplication.Status.REJECTED
            app.decided_at = timezone.now()
            app.decision_note = decision_note
            app.save()

            profile = getattr(app.user, "consultation_profile", None)
            if profile:
                profile.application_status = "rejected"
                profile.save(update_fields=["application_status"])

            record_event(request, "consultant.application.rejected", "consultation", "denied", subject=f"user:{app.user.pk}")
            return JsonResponse({"ok": True, "detail": f"درخواست مشاور {app.full_name} رد شد."})


@require_GET
def manager_download_resume(request, filename):
    if not _authenticated_role(request, {"manager", "admin"}):
        return JsonResponse({"detail": "دسترسی غیرمجاز."}, status=403)

    clean_filename = Path(filename).name
    if ".." in clean_filename or "/" in clean_filename:
        raise Http404

    file_path = (Path(settings.MEDIA_ROOT) / "resumes" / clean_filename).resolve()
    try:
        file_path.relative_to(Path(settings.MEDIA_ROOT).resolve())
    except ValueError:
        raise Http404

    if not file_path.is_file():
        raise Http404

    content_type = "application/pdf" if file_path.suffix.lower() == ".pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    return FileResponse(file_path.open("rb"), as_attachment=True, filename=f"resume_{clean_filename}", content_type=content_type)
