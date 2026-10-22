import json
import secrets
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt, csrf_protect
from django.views.decorators.http import require_GET, require_POST
from zoneinfo import ZoneInfo
from django.utils import timezone
from .models import ConsultantProfile
from .study_models import StudyReportFeedback
from .telegram_service import get_bot_username, process_telegram_update, send_telegram_message

TEHRAN = ZoneInfo("Asia/Tehran")


def _authenticated_role(request, allowed_roles: set[str]) -> bool:
    return bool(request.user.is_authenticated and request.user.is_active and request.user.role in allowed_roles)


@csrf_exempt
@require_POST
def telegram_webhook(request):
    secret = getattr(settings, "TELEGRAM_WEBHOOK_SECRET", "").strip()
    if secret:
        header_secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
        if header_secret != secret:
            return JsonResponse({"detail": "Forbidden"}, status=403)

    try:
        data = json.loads(request.body or b"{}")
    except Exception:
        return JsonResponse({"detail": "Invalid JSON"}, status=400)

    result = process_telegram_update(data)
    return JsonResponse({"ok": True, "result": result})


@require_GET
def consultant_telegram_status(request):
    if not _authenticated_role(request, {"consultant"}):
        return JsonResponse({"detail": "دسترسی مجاز نیست."}, status=403)

    profile, _ = ConsultantProfile.objects.get_or_create(user=request.user)
    if not profile.telegram_chat_id and not profile.telegram_link_token:
        profile.telegram_link_token = secrets.token_urlsafe(24)
        profile.save(update_fields=("telegram_link_token",))

    bot_username = get_bot_username()
    deep_link = ""
    if bot_username and profile.telegram_link_token:
        deep_link = f"https://t.me/{bot_username}?start={profile.telegram_link_token}"

    return JsonResponse({
        "is_connected": bool(profile.telegram_chat_id),
        "connected_at": profile.telegram_connected_at.isoformat() if profile.telegram_connected_at else None,
        "telegram_phone": profile.telegram_phone or "",
        "bot_username": bot_username,
        "deep_link": deep_link,
    })


@require_POST
@csrf_protect
def consultant_telegram_disconnect(request):
    if not _authenticated_role(request, {"consultant"}):
        return JsonResponse({"detail": "دسترسی مجاز نیست."}, status=403)

    profile, _ = ConsultantProfile.objects.get_or_create(user=request.user)
    profile.telegram_chat_id = None
    profile.telegram_connected_at = None
    profile.telegram_link_token = secrets.token_urlsafe(24)
    profile.save(update_fields=("telegram_chat_id", "telegram_connected_at", "telegram_link_token"))

    return JsonResponse({"ok": True, "detail": "اتصال تلگرام قطع شد."})


@require_POST
@csrf_protect
def consultant_telegram_test(request):
    if not _authenticated_role(request, {"consultant"}):
        return JsonResponse({"detail": "دسترسی مجاز نیست."}, status=403)

    profile, _ = ConsultantProfile.objects.get_or_create(user=request.user)
    if not profile.telegram_chat_id:
        return JsonResponse({"detail": "حساب تلگرام شما متصل نیست."}, status=400)

    name = request.user.full_name or "مشاور"
    test_text = (
        f"🧪 <b>پیام آزمایشی آکادمی</b>\n\n"
        f"همکار گرامی جناب/سرکار {name}،\n"
        "اتصال تلگرام شما با پنل مشاور فعال و برقرار است.\n"
        "گزارش‌های شبانه مطالعهٔ دانش‌آموزان به این صفحه ارسال خواهد شد."
    )
    res = send_telegram_message(profile.telegram_chat_id, test_text)
    if res.get("ok"):
        return JsonResponse({"ok": True, "detail": "پیام تستی به تلگرام شما ارسال شد."})
    else:
        desc = res.get("description", "خطا در ارسال پیام تستی تلگرام")
        return JsonResponse({"detail": f"ارسال نشد: {desc}"}, status=502)


def study_feedbacks_list(request):
    import os
    from datetime import date
    from accounts.models import User
    from .models import ConsultationRequest

    if not request.user.is_authenticated or not request.user.is_active:
        return JsonResponse({"detail": "وارد حساب شوید."}, status=401)

    if request.method == "POST":
        if request.user.role != "consultant":
            return JsonResponse({"detail": "فقط مشاور مجاز به ثبت بازخورد است."}, status=403)

        student_id = request.POST.get("student_id")
        study_date_str = request.POST.get("study_date")
        feedback_text = (request.POST.get("feedback_text") or "").strip()[:3000]
        voice_file = request.FILES.get("voice")

        if not student_id or not study_date_str:
            return JsonResponse({"detail": "شناسه دانش‌آموز و تاریخ مطالعه الزامی است."}, status=400)

        try:
            student = User.objects.get(id=int(student_id), role="student")
        except (User.DoesNotExist, ValueError):
            return JsonResponse({"detail": "دانش‌آموز یافت نشد."}, status=404)

        # Verify consultant is assigned to this student
        is_assigned = ConsultationRequest.objects.filter(
            student=student,
            assigned_consultant__user=request.user,
            status=ConsultationRequest.Status.APPROVED
        ).exists()
        if not is_assigned:
            return JsonResponse({"detail": "این دانش‌آموز به شما اختصاص داده نشده است."}, status=403)

        try:
            study_date = date.fromisoformat(study_date_str)
        except ValueError:
            return JsonResponse({"detail": "فرمت تاریخ نامعتبر است (YYYY-MM-DD)."}, status=400)

        # Validate voice file if present
        voice_duration = 0
        if voice_file:
            if voice_file.size > 10 * 1024 * 1024:
                return JsonResponse({"detail": "حجم فایل صوتی نباید بیشتر از ۱۰ مگابایت باشد."}, status=400)
            allowed_audio = {".ogg", ".mp3", ".wav", ".m4a", ".webm"}
            ext = os.path.splitext(voice_file.name.lower())[1]
            if ext not in allowed_audio and not (voice_file.content_type and voice_file.content_type.startswith("audio/")):
                return JsonResponse({"detail": "فرمت فایل صوتی نامعتبر است."}, status=400)
            try:
                voice_duration = int(request.POST.get("voice_duration") or 0)
            except ValueError:
                voice_duration = 0

        if not feedback_text and not voice_file:
            return JsonResponse({"detail": "متن یا فایل صوتی بازخورد الزامی است."}, status=400)

        feedback = StudyReportFeedback.objects.create(
            student=student,
            consultant=request.user,
            study_date=study_date,
            feedback_text=feedback_text or "پیام صوتی ارزیابی مشاور",
            voice_file=voice_file,
            voice_duration=voice_duration,
            source="panel",
        )

        return JsonResponse({
            "ok": True,
            "detail": "بازخورد با موفقیت ثبت شد.",
            "feedback_id": feedback.id,
            "voice_url": feedback.voice_file.url if feedback.voice_file else None,
        })

    # GET handling
    if request.user.role == "student":
        feedbacks = StudyReportFeedback.objects.filter(student=request.user).select_related("consultant")[:50]
    elif request.user.role == "consultant":
        feedbacks = StudyReportFeedback.objects.filter(consultant=request.user).select_related("student")
        student_id = request.GET.get("student")
        if student_id and student_id.isdigit():
            feedbacks = feedbacks.filter(student_id=int(student_id))
        feedbacks = feedbacks[:100]
    else:
        return JsonResponse({"detail": "دسترسی غیرمجاز."}, status=403)

    results = []
    for f in feedbacks:
        results.append({
            "id": f.id,
            "student_id": f.student_id,
            "student_name": f.student.full_name or "دانش‌آموز",
            "consultant_id": f.consultant_id,
            "consultant_name": f.consultant.full_name or "مشاور",
            "consultant_avatar_url": f.consultant.avatar.url if (hasattr(f.consultant, "avatar") and f.consultant.avatar) else None,
            "study_date": f.study_date.isoformat(),
            "feedback_text": f.feedback_text,
            "voice_url": f.voice_file.url if f.voice_file else None,
            "voice_duration": f.voice_duration or 0,
            "source": f.source,
            "created_at": timezone.localtime(f.created_at, TEHRAN).strftime("%Y/%m/%d - %H:%M"),
        })

    return JsonResponse({"results": results})
