import json
import uuid
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

from django.conf import settings
from django.core.files.base import ContentFile
from django.http import FileResponse
from datetime import datetime, time, timedelta, timezone as datetime_timezone
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_POST

from accounts.models import User
from .models import (
    PLAN_CHOICES,
    ConsultantPlanPrice,
    ConsultantProfile,
    ConsultationMessage,
    ConsultationPreference,
    ConsultationRequest,
)

PLAN_LABELS = dict(PLAN_CHOICES)
PLAN_KEYS = set(PLAN_LABELS)
MANAGER_ROLES = {"manager", "admin"}


def error(message, status):
    return JsonResponse({"detail": message}, status=status)


def authenticated_role(request, roles):
    return request.user.is_authenticated and request.user.is_active and request.user.role in roles


def profile_payload(profile, include_phone=False):
    prices = {price.plan: price.price_toman for price in profile.plan_prices.all()}
    assigned_count = profile.assignments.filter(status=ConsultationRequest.Status.APPROVED).count()
    user = profile.user
    result = {
        "id": user.id,
        "full_name": user.full_name or "مشاور آکادمی",
        "bio": profile.bio,
        "experience_years": profile.experience_years,
        "university_major": profile.university_major,
        "current_university": profile.current_university,
        "available_slots": profile.available_slots,
        "assigned_count": assigned_count,
        "is_active": user.is_active,
        "prices": {key: prices.get(key, 0) for key in PLAN_KEYS},
    }
    if include_phone:
        result["phone"] = user.phone
    return result


def get_profile_for(user):
    return ConsultantProfile.objects.get_or_create(user=user)[0]


def request_payload(item, viewer):
    preferences = []
    for choice in item.preferences.select_related("consultant__user").all():
        profile = choice.consultant
        preferences.append({
            "consultant_id": profile.user_id,
            "consultant_name": profile.user.full_name or "مشاور آکادمی",
            "experience_years": profile.experience_years,
            "university_major": profile.university_major,
            "current_university": profile.current_university,
            "quoted_price_toman": choice.quoted_price_toman,
            "order": choice.order,
        })
    data = {
        "id": item.id,
        "student_id": item.student_id,
        "student_name": item.student.full_name or "دانش‌آموز",
        "student_phone": item.student.phone,
        "student_grade": dict(User.GRADE_CHOICES).get(item.student.grade, ""),
        "student_grade_value": item.student.grade,
        "student_major": dict(User.MAJOR_CHOICES).get(item.student.major, ""),
        "student_major_value": item.student.major,
        "student_gender": item.student.gender,
        "student_gender_label": dict(User.GENDER_CHOICES).get(item.student.gender, "ثبت نشده"),
        "plan": item.plan,
        "plan_label": PLAN_LABELS[item.plan],
        "status": item.status,
        "status_label": item.get_status_display(),
        "created_at": item.created_at.isoformat(),
        "decision_note": item.decision_note,
        "preferences": preferences,
        "assigned_consultant_id": item.assigned_consultant.user_id if item.assigned_consultant_id else None,
        "assigned_consultant_name": (item.assigned_consultant.user.full_name or "مشاور آکادمی") if item.assigned_consultant_id else "",
        "assigned_price_toman": item.assigned_price_toman,
    }
    return data


@require_GET
def marketplace(request):
    if not authenticated_role(request, {"student"}):
        return error("برای مشاهده مشاوران وارد حساب دانش‌آموزی شوید.", 401 if not request.user.is_authenticated else 403)
    profiles = ConsultantProfile.objects.filter(user__is_active=True, user__role="consultant").select_related("user").prefetch_related("plan_prices")
    results = [profile_payload(profile) for profile in profiles.order_by("user__full_name", "id")[:100]]
    active_request = ConsultationRequest.objects.filter(student=request.user, status__in=("pending", "approved")).prefetch_related("preferences", "preferences__consultant__user").select_related("student", "assigned_consultant__user").first()
    latest_request = ConsultationRequest.objects.filter(student=request.user).select_related("student", "assigned_consultant__user").prefetch_related("preferences__consultant__user").first()
    return JsonResponse({
        "plans": [{"id": key, "label": label} for key, label in PLAN_CHOICES],
        "consultants": results,
        "active_request": request_payload(active_request, request.user) if active_request else None,
        "latest_request": request_payload(latest_request, request.user) if latest_request else None,
    })


@csrf_protect
def consultant_profile(request):
    if not authenticated_role(request, {"consultant"}):
        return error("این بخش فقط برای حساب مشاور است.", 401 if not request.user.is_authenticated else 403)
    profile = get_profile_for(request.user)
    if request.method == "GET":
        profile.plan_prices.all()  # populate reverse relation for the serializer
        return JsonResponse(profile_payload(profile, include_phone=True))
    if request.method != "PATCH":
        return error("روش درخواست پشتیبانی نمی‌شود.", 405)
    try:
        data = json.loads(request.body or b"{}")
        if not isinstance(data, dict):
            raise ValueError
        full_name = str(data.get("full_name", "")).strip()
        bio = str(data.get("bio", "")).strip()
        university_major = str(data.get("university_major", "")).strip()
        current_university = str(data.get("current_university", "")).strip()
        raw_experience = data.get("experience_years", 0)
        raw_slots = data.get("available_slots", 0)
        if isinstance(raw_experience, bool) or isinstance(raw_slots, bool):
            raise ValueError
        experience = int(raw_experience)
        slots = int(raw_slots)
        if str(experience) != str(raw_experience).strip() or str(slots) != str(raw_slots).strip():
            raise ValueError
        if not full_name or len(full_name) > 100:
            raise ValueError("نام نمایشی الزامی است و حداکثر ۱۰۰ کاراکتر دارد.")
        if len(bio) > 3000 or len(university_major) > 120 or len(current_university) > 150:
            raise ValueError("طول یکی از فیلدها بیشتر از حد مجاز است.")
        if not 0 <= experience <= 60 or not 0 <= slots <= 500:
            raise ValueError("سابقه باید بین ۰ تا ۶۰ سال و ظرفیت بین ۰ تا ۵۰۰ نفر باشد.")
    except (TypeError, ValueError, json.JSONDecodeError):
        return error("اطلاعات رزومه یا ظرفیت معتبر نیست.", 400)
    with transaction.atomic():
        profile = ConsultantProfile.objects.select_for_update().get(pk=profile.pk)
        profile.user.full_name = full_name
        profile.user.save(update_fields=["full_name"])
        profile.bio = bio
        profile.university_major = university_major
        profile.current_university = current_university
        profile.experience_years = experience
        profile.available_slots = slots
        profile.save()
    profile.plan_prices.all()
    return JsonResponse(profile_payload(profile, include_phone=True))


@require_POST
@csrf_protect
def manage_prices(request):
    if not authenticated_role(request, MANAGER_ROLES):
        return error("فقط مدیر مجموعه یا ادمین می‌تواند قیمت‌ها را تعیین کند.", 401 if not request.user.is_authenticated else 403)
    try:
        data = json.loads(request.body or b"{}")
        raw_consultant_id = data.get("consultant_id")
        if isinstance(raw_consultant_id, bool) or not str(raw_consultant_id).isdigit():
            raise ValueError
        consultant_id = int(raw_consultant_id)
        prices = data.get("prices")
        if not isinstance(prices, dict) or set(prices) != PLAN_KEYS:
            raise ValueError
        clean_prices = {}
        for plan, amount in prices.items():
            if isinstance(amount, bool):
                raise ValueError
            if isinstance(amount, bool) or not str(amount).isdigit():
                raise ValueError
            value = int(amount)
            if not 0 <= value <= 1_000_000_000:
                raise ValueError
            clean_prices[plan] = value
        profile = ConsultantProfile.objects.select_related("user").get(user_id=consultant_id, user__role="consultant")
    except ConsultantProfile.DoesNotExist:
        return error("مشاور پیدا نشد.", 404)
    except (TypeError, ValueError, json.JSONDecodeError, AttributeError):
        return error("اطلاعات قیمت معتبر نیست؛ مبلغ را به تومان وارد کنید.", 400)
    with transaction.atomic():
        for plan, amount in clean_prices.items():
            ConsultantPlanPrice.objects.update_or_create(consultant=profile, plan=plan, defaults={"price_toman": amount})
    profile.plan_prices.all()
    return JsonResponse(profile_payload(profile, include_phone=True))


@require_POST
@csrf_protect
def create_request(request):
    if not authenticated_role(request, {"student"}):
        return error("ثبت درخواست فقط برای حساب دانش‌آموزی امکان‌پذیر است.", 401 if not request.user.is_authenticated else 403)
    try:
        data = json.loads(request.body or b"{}")
        plan = data.get("plan")
        raw_ids = data.get("consultant_ids")
        if plan not in PLAN_KEYS or not isinstance(raw_ids, list) or len(raw_ids) < 2 or len(raw_ids) > 10:
            raise ValueError("یک پلن و حداقل دو مشاور انتخاب کنید.")
        if any(isinstance(value, bool) or not str(value).isdigit() for value in raw_ids):
            raise ValueError("شناسه یکی از مشاوران معتبر نیست.")
        consultant_ids = [int(value) for value in raw_ids]
        if len(set(consultant_ids)) != len(consultant_ids):
            raise ValueError("مشاور تکراری انتخاب شده است.")
    except (TypeError, ValueError, json.JSONDecodeError, AttributeError):
        return error("یک پلن و حداقل دو مشاور معتبر انتخاب کنید.", 400)
    if ConsultationRequest.objects.filter(student=request.user, status__in=("pending", "approved")).exists():
        return error("در حال حاضر یک درخواست در انتظار بررسی یا یک مشاور فعال دارید.", 409)
    try:
        with transaction.atomic():
            profiles = list(ConsultantProfile.objects.select_for_update().filter(
                user_id__in=consultant_ids, user__is_active=True, user__role="consultant"
            ).select_related("user").prefetch_related("plan_prices").order_by("pk"))
            by_id = {profile.user_id: profile for profile in profiles}
            if len(by_id) != len(consultant_ids):
                raise ValueError("یکی از مشاوران انتخاب‌شده در دسترس نیست.")
            quoted = []
            for consultant_id in consultant_ids:
                profile = by_id[consultant_id]
                price = profile.plan_prices.filter(plan=plan).first()
                if profile.available_slots < 1:
                    raise ValueError(f"ظرفیت {profile.user.full_name or 'مشاور'} تکمیل شده است.")
                if not price or price.price_toman <= 0:
                    raise ValueError(f"قیمت پلن {PLAN_LABELS[plan]} برای {profile.user.full_name or 'مشاور'} هنوز تعیین نشده است.")
                quoted.append((profile, price.price_toman))
            item = ConsultationRequest.objects.create(student=request.user, plan=plan)
            ConsultationPreference.objects.bulk_create([
                ConsultationPreference(request=item, consultant=profile, order=index, quoted_price_toman=amount)
                for index, (profile, amount) in enumerate(quoted, start=1)
            ])
    except IntegrityError:
        return error("درخواست فعال دیگری برای شما ثبت شده است.", 409)
    except ValueError as exc:
        return error(str(exc), 400)
    item = ConsultationRequest.objects.select_related("student").prefetch_related("preferences__consultant__user").get(pk=item.pk)
    return JsonResponse(request_payload(item, request.user), status=201)


@require_GET
def request_list(request):
    if not request.user.is_authenticated or not request.user.is_active:
        return error("وارد حساب کاربری شوید.", 401)
    queryset = ConsultationRequest.objects.select_related("student", "assigned_consultant__user").prefetch_related("preferences__consultant__user")
    if request.user.role == "student":
        queryset = queryset.filter(student=request.user)
    elif request.user.role == "consultant":
        profile = get_profile_for(request.user)
        queryset = queryset.filter(status=ConsultationRequest.Status.APPROVED, assigned_consultant=profile)
        from django.db.models import Q
        grade = request.GET.get("grade", "").strip()
        major = request.GET.get("major", "").strip()
        gender = request.GET.get("gender", "").strip()
        query = request.GET.get("q", "").strip()[:100].translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789"))
        if grade: queryset = queryset.filter(student__grade=grade)
        if major: queryset = queryset.filter(student__major=major)
        if gender == "unspecified": queryset = queryset.filter(student__gender="")
        elif gender: queryset = queryset.filter(student__gender=gender)
        if query: queryset = queryset.filter(Q(student__full_name__icontains=query) | Q(student__phone__icontains=query))
    elif request.user.role not in MANAGER_ROLES:
        return error("دسترسی مشاهده درخواست‌ها را ندارید.", 403)
    results = [request_payload(item, request.user) for item in queryset[:200]]
    return JsonResponse({"results": results})


@require_POST
@csrf_protect
def decide_request(request, request_id):
    if not authenticated_role(request, MANAGER_ROLES):
        return error("فقط مدیر مجموعه یا ادمین می‌تواند درخواست را بررسی کند.", 401 if not request.user.is_authenticated else 403)
    try:
        data = json.loads(request.body or b"{}")
        action = data.get("action")
        if action not in {"approve", "reject"}:
            raise ValueError
        raw_consultant_id = data.get("consultant_id") if action == "approve" else None
        if action == "approve" and (isinstance(raw_consultant_id, bool) or not str(raw_consultant_id).isdigit()):
            raise ValueError
        consultant_id = int(raw_consultant_id) if action == "approve" else None
        note = str(data.get("note", "")).strip()[:500]
    except (TypeError, ValueError, json.JSONDecodeError, AttributeError):
        return error("تصمیم یا مشاور انتخاب‌شده معتبر نیست.", 400)
    try:
        with transaction.atomic():
            item = ConsultationRequest.objects.select_for_update().select_related("student").get(pk=request_id, status=ConsultationRequest.Status.PENDING)
            if action == "approve":
                preference = ConsultationPreference.objects.filter(request=item, consultant__user_id=consultant_id).select_related("consultant__user").first()
                if not preference:
                    return error("فقط یکی از مشاوران انتخاب‌شده دانش‌آموز قابل تخصیص است.", 400)
                profile = ConsultantProfile.objects.select_for_update().get(pk=preference.consultant_id)
                if not profile.user.is_active or profile.user.role != "consultant":
                    return error("این مشاور دیگر فعال نیست؛ مشاور دیگری انتخاب کنید یا درخواست را رد کنید.", 409)
                if profile.available_slots < 1:
                    return error("ظرفیت این مشاور دیگر آزاد نیست؛ مشاور دیگری انتخاب کنید یا درخواست را رد کنید.", 409)
                item.status = ConsultationRequest.Status.APPROVED
                item.assigned_consultant = profile
                item.assigned_price_toman = preference.quoted_price_toman
                item.decision_note = ""
                profile.available_slots -= 1
                profile.save(update_fields=["available_slots", "updated_at"])
            else:
                item.status = ConsultationRequest.Status.REJECTED
                item.decision_note = note
            item.decided_at = timezone.now()
            item.save(update_fields=["status", "assigned_consultant", "assigned_price_toman", "decision_note", "decided_at"])
    except ConsultationRequest.DoesNotExist:
        return error("درخواست در انتظار بررسی پیدا نشد.", 404)
    result = ConsultationRequest.objects.select_related("student", "assigned_consultant__user").prefetch_related("preferences__consultant__user").get(pk=request_id)
    return JsonResponse(request_payload(result, request.user))


@require_GET
def manager_overview(request):
    if not authenticated_role(request, MANAGER_ROLES):
        return error("فقط مدیر مجموعه یا ادمین می‌تواند مدیریت مشاوره را ببیند.", 401 if not request.user.is_authenticated else 403)
    profiles = ConsultantProfile.objects.filter(user__role="consultant").select_related("user").prefetch_related("plan_prices").order_by("user__full_name")
    requests = ConsultationRequest.objects.filter(status=ConsultationRequest.Status.PENDING).select_related("student").prefetch_related("preferences__consultant__user").order_by("created_at")
    return JsonResponse({
        "consultants": [profile_payload(profile, include_phone=True) for profile in profiles[:500]],
        "pending_requests": [request_payload(item, request.user) for item in requests[:200]],
    })


def tehran_day_range():
    tehran = ZoneInfo("Asia/Tehran")
    today = timezone.now().astimezone(tehran).date()
    start = datetime.combine(today, time.min, tzinfo=tehran)
    end = start + timedelta(days=1)
    return start.astimezone(datetime_timezone.utc), end.astimezone(datetime_timezone.utc)


def can_access_request(user, item):
    if item.status != ConsultationRequest.Status.APPROVED or not item.assigned_consultant_id:
        return False
    return (
        (user.role == "student" and item.student_id == user.id)
        or (user.role == "consultant" and item.assigned_consultant.user_id == user.id)
    )


def _chat_message_payload(message):
    return {
        "id": message.id,
        "sender_id": message.sender_id,
        "sender_name": message.sender.full_name or "کاربر",
        "body": message.body,
        "created_at": message.created_at.isoformat(),
        "image_url": (f"/api/consultations/requests/{message.request_id}/images/{message.id}/" if message.request_id else f"/api/consultations/staff-conversations/{message.conversation_id}/images/{message.id}/") if message.image else None,
    }


def _prepare_chat_image(upload):
    max_bytes = 5 * 1024 * 1024
    if upload.size > max_bytes:
        raise ValueError("حجم هر تصویر نباید بیشتر از ۵ مگابایت باشد.")
    try:
        upload.seek(0)
        with Image.open(upload) as probe:
            if probe.format not in {"JPEG", "PNG", "WEBP"}:
                raise ValueError("فقط تصویرهای JPEG، PNG یا WebP پذیرفته می‌شوند.")
            if getattr(probe, "n_frames", 1) != 1:
                raise ValueError("تصویر متحرک پذیرفته نمی‌شود؛ یک تصویر ثابت انتخاب کنید.")
            if probe.width < 1 or probe.height < 1 or probe.width * probe.height > 20_000_000:
                raise ValueError("ابعاد تصویر معتبر نیست یا بیش از حد بزرگ است.")
            probe.verify()
        upload.seek(0)
        with Image.open(upload) as source:
            image = ImageOps.exif_transpose(source).convert("RGB")
            output = BytesIO()
            image.save(output, format="JPEG", quality=88, optimize=True)
        return ContentFile(output.getvalue(), name=f"{uuid.uuid4().hex}.jpg")
    except ValueError:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise ValueError("فایل انتخاب‌شده تصویر معتبر نیست.") from exc


def _parse_chat_submission(request):
    upload = None
    if request.content_type == "application/json":
        try:
            data = json.loads(request.body or b"{}")
            body = str(data.get("body", "")).strip()
        except (TypeError, ValueError, json.JSONDecodeError, AttributeError):
            return None, None, error("درخواست پیام معتبر نیست.", 400)
    elif request.content_type and request.content_type.startswith("multipart/form-data"):
        if int(request.META.get("CONTENT_LENGTH") or 0) > 6 * 1024 * 1024:
            return None, None, error("حجم درخواست بیش از حد مجاز است.", 413)
        body = request.POST.get("body", "").strip()
        upload = request.FILES.get("image")
    else:
        return None, None, error("نوع درخواست پشتیبانی نمی‌شود.", 415)
    if len(body) > 4000 or (not body and not upload):
        return None, None, error("متن پیام الزامی است مگر اینکه تصویر پیوست کرده باشید؛ حداکثر متن ۴۰۰۰ کاراکتر است.", 400)
    safe_image = None
    if upload:
        try:
            safe_image = _prepare_chat_image(upload)
        except ValueError as exc:
            return None, None, error(str(exc), 400)
    return body, safe_image, None


def _store_chat_message(request, body, safe_image, *, consultation=None, conversation=None):
    day_start, day_end = tehran_day_range()
    with transaction.atomic():
        sender = get_user_model().objects.select_for_update().get(pk=request.user.pk)
        sent_today = ConsultationMessage.objects.filter(sender=sender, created_at__gte=day_start, created_at__lt=day_end).count()
        images_today = ConsultationMessage.objects.filter(sender=sender, created_at__gte=day_start, created_at__lt=day_end).exclude(image="").count()
        if sent_today >= 1000:
            return None, None, error("سقف ۱۰۰۰ پیام روزانهٔ شما به پایان رسیده است.", 429)
        if safe_image and images_today >= 5:
            return None, None, error("سقف ۵ تصویر روزانهٔ شما به پایان رسیده است.", 429)
        message = ConsultationMessage.objects.create(request=consultation, conversation=conversation, sender=sender, body=body)
        if safe_image:
            message.image.save(safe_image.name, safe_image, save=True)
        if conversation:
            conversation.save(update_fields=["updated_at"])
    quotas = {"remaining_today": max(0, 999 - sent_today), "images_sent_today": images_today + (1 if safe_image else 0), "remaining_images_today": max(0, 5 - images_today - (1 if safe_image else 0))}
    return message, quotas, None


@csrf_protect
def chat_image(request, request_id, message_id):
    if request.method != "GET":
        return error("روش درخواست پشتیبانی نمی‌شود.", 405)
    if not request.user.is_authenticated or not request.user.is_active:
        return error("وارد حساب کاربری شوید.", 401)
    try:
        item = ConsultationRequest.objects.select_related("assigned_consultant__user").get(pk=request_id)
        message = ConsultationMessage.objects.get(pk=message_id, request=item)
    except (ConsultationRequest.DoesNotExist, ConsultationMessage.DoesNotExist):
        return error("تصویر پیدا نشد.", 404)
    if not can_access_request(request.user, item):
        return error("فقط دانش‌آموز و مشاور تخصیص‌یافته می‌توانند تصویر را ببینند.", 403)
    if not message.image:
        return error("این پیام تصویر ندارد.", 404)
    response = FileResponse(message.image.open("rb"), content_type="image/jpeg")
    response["X-Content-Type-Options"] = "nosniff"
    response["Content-Disposition"] = "inline; filename=chat-image.jpg"
    response["Cache-Control"] = "private, no-store"
    response["Content-Security-Policy"] = "default-src 'none'; sandbox"
    return response


@csrf_protect
def chat_messages(request, request_id):
    if request.method not in {"GET", "POST"}:
        return error("روش درخواست پشتیبانی نمی‌شود.", 405)
    if not request.user.is_authenticated or not request.user.is_active:
        return error("وارد حساب کاربری شوید.", 401)
    try:
        item = ConsultationRequest.objects.select_related("student", "assigned_consultant__user").get(pk=request_id)
    except ConsultationRequest.DoesNotExist:
        return error("گفت‌وگو پیدا نشد.", 404)
    if not can_access_request(request.user, item):
        return error("فقط دانش‌آموز و مشاور تخصیص‌یافته می‌توانند این گفت‌وگو را ببینند.", 403)
    day_start, day_end = tehran_day_range()
    if request.method == "GET":
        messages = item.messages.select_related("sender").order_by("-id")
        before = request.GET.get("before", "")
        if before.isdigit():
            messages = messages.filter(id__lt=int(before))
        rows = list(messages[:100])
        rows.reverse()
        sent_today = ConsultationMessage.objects.filter(sender=request.user, created_at__gte=day_start, created_at__lt=day_end).count()
        images_today = ConsultationMessage.objects.filter(sender=request.user, created_at__gte=day_start, created_at__lt=day_end).exclude(image="").count()
        return JsonResponse({"results": [_chat_message_payload(message) for message in rows], "remaining_today": max(0, 1000 - sent_today), "images_sent_today": images_today, "remaining_images_today": max(0, 5 - images_today)})

    body, safe_image, failure = _parse_chat_submission(request)
    if failure:
        return failure
    message, quotas, failure = _store_chat_message(request, body, safe_image, consultation=item)
    if failure:
        return failure
    result = _chat_message_payload(message)
    result.update(quotas)
    return JsonResponse(result, status=201)


@csrf_protect
def staff_conversations(request):
    if request.method not in {"GET", "POST"}:
        return error("روش درخواست پشتیبانی نمی‌شود.", 405)
    if not request.user.is_authenticated or not request.user.is_active:
        return error("وارد حساب کاربری شوید.", 401)
    if request.method == "POST":
        if request.user.role != "consultant":
            return error("فقط مشاور می‌تواند اتاق پشتیبانی بسازد.", 403)
        from .models import ConsultantManagerConversation
        conversation, created = ConsultantManagerConversation.objects.get_or_create(consultant=request.user)
        return JsonResponse({"conversation": _staff_conversation_payload(conversation)}, status=201 if created else 200)
    if request.user.role == "consultant":
        from .models import ConsultantManagerConversation
        conversation = ConsultantManagerConversation.objects.filter(consultant=request.user).first()
        return JsonResponse({"conversation": _staff_conversation_payload(conversation) if conversation else None})
    if request.user.role in MANAGER_ROLES:
        from .models import ConsultantManagerConversation
        conversations = ConsultantManagerConversation.objects.select_related("consultant").prefetch_related("chat_messages__sender")
        rows = [_staff_conversation_payload(conversation) for conversation in conversations[:500]]
        return JsonResponse({"results": rows})
    return error("دسترسی مشاهدهٔ اتاق‌های پشتیبانی را ندارید.", 403)


def _staff_conversation_payload(conversation):
    if not conversation:
        return None
    last = conversation.chat_messages.select_related("sender").order_by("-created_at", "-id").first()
    return {
        "id": conversation.id,
        "consultant_id": conversation.consultant_id,
        "consultant_name": conversation.consultant.full_name or "مشاور",
        "updated_at": conversation.updated_at.isoformat(),
        "last_message": (last.body[:160] if last and last.body else "تصویر پیوست‌شده" if last and last.image else ""),
        "last_sender_id": last.sender_id if last else None,
        "last_message_at": last.created_at.isoformat() if last else None,
        "message_count": conversation.chat_messages.count(),
    }


@csrf_protect
def staff_conversation_messages(request, conversation_id):
    if request.method not in {"GET", "POST"}:
        return error("روش درخواست پشتیبانی نمی‌شود.", 405)
    if not request.user.is_authenticated or not request.user.is_active:
        return error("وارد حساب کاربری شوید.", 401)
    from .models import ConsultantManagerConversation
    try:
        conversation = ConsultantManagerConversation.objects.select_related("consultant").get(pk=conversation_id)
    except ConsultantManagerConversation.DoesNotExist:
        return error("اتاق گفت‌وگو پیدا نشد.", 404)
    if not ((request.user.role == "consultant" and conversation.consultant_id == request.user.id) or request.user.role in MANAGER_ROLES):
        return error("فقط مشاور این اتاق و مدیر مجموعه می‌توانند پیام‌ها را ببینند.", 403)
    day_start, day_end = tehran_day_range()
    if request.method == "GET":
        messages = conversation.chat_messages.select_related("sender").order_by("-id")
        before = request.GET.get("before", "")
        if before.isdigit(): messages = messages.filter(id__lt=int(before))
        rows = list(messages[:100]); rows.reverse()
        sent_today = ConsultationMessage.objects.filter(sender=request.user, created_at__gte=day_start, created_at__lt=day_end).count()
        images_today = ConsultationMessage.objects.filter(sender=request.user, created_at__gte=day_start, created_at__lt=day_end).exclude(image="").count()
        return JsonResponse({"results": [_chat_message_payload(message) for message in rows], "remaining_today": max(0, 1000-sent_today), "images_sent_today": images_today, "remaining_images_today": max(0, 5-images_today)})
    body, safe_image, failure = _parse_chat_submission(request)
    if failure: return failure
    message, quotas, failure = _store_chat_message(request, body, safe_image, conversation=conversation)
    if failure: return failure
    result = _chat_message_payload(message); result.update(quotas)
    return JsonResponse(result, status=201)


@csrf_protect
def staff_chat_image(request, conversation_id, message_id):
    if request.method != "GET": return error("روش درخواست پشتیبانی نمی‌شود.", 405)
    if not request.user.is_authenticated or not request.user.is_active: return error("وارد حساب کاربری شوید.", 401)
    from .models import ConsultantManagerConversation
    try:
        conversation = ConsultantManagerConversation.objects.get(pk=conversation_id)
        message = ConsultationMessage.objects.get(pk=message_id, conversation=conversation)
    except (ConsultantManagerConversation.DoesNotExist, ConsultationMessage.DoesNotExist):
        return error("تصویر پیدا نشد.", 404)
    if not ((request.user.role == "consultant" and conversation.consultant_id == request.user.id) or request.user.role in MANAGER_ROLES):
        return error("به این تصویر دسترسی ندارید.", 403)
    if not message.image: return error("این پیام تصویر ندارد.", 404)
    response = FileResponse(message.image.open("rb"), content_type="image/jpeg")
    response["X-Content-Type-Options"] = "nosniff"; response["Content-Disposition"] = "inline; filename=chat-image.jpg"
    response["Cache-Control"] = "private, no-store"; response["Content-Security-Policy"] = "default-src 'none'; sandbox"
    return response


@require_GET
def study_sessions(request):
    from .study_models import StudySession
    from django.db.models import Q
    if not request.user.is_authenticated or not request.user.is_active: return error("وارد حساب کاربری شوید.", 401)
    if request.user.role == "student": rows = StudySession.objects.filter(student=request.user)
    elif request.user.role == "consultant":
        rows = StudySession.objects.filter(consultant=request.user)
        if request.GET.get("student"): rows = rows.filter(student_id=request.GET["student"])
    elif request.user.role in MANAGER_ROLES:
        rows = StudySession.objects.all()
        if request.GET.get("student"): rows = rows.filter(student_id=request.GET["student"])
    else: return error("دسترسی مشاهده برنامه را ندارید.", 403)

    now = timezone.now()
    days_since_saturday = (now.weekday() - 5) % 7
    this_saturday = (now - timedelta(days=days_since_saturday)).date()

    week_start = request.GET.get("week_start")
    if week_start:
        try:
            ws_date = datetime.strptime(week_start, "%Y-%m-%d").date()
            if ws_date == this_saturday:
                rows = rows.filter(Q(week_start_date=ws_date) | Q(week_start_date__isnull=True))
            else:
                rows = rows.filter(week_start_date=ws_date)
        except (ValueError, TypeError):
            pass
    elif request.user.role == "student":
        rows = rows.filter(Q(week_start_date=this_saturday) | Q(week_start_date__isnull=True))

    return JsonResponse({
        "results": [
            {
                "id": x.id,
                "student_id": x.student_id,
                "weekday": x.weekday,
                "start_time": x.start_time.strftime("%H:%M") if x.start_time else None,
                "end_time": x.end_time.strftime("%H:%M") if x.end_time else None,
                "planned_minutes": x.planned_minutes,
                "subject": x.subject,
                "mode": x.mode,
                "test_count": x.test_count,
                "instructions": x.instructions,
                "color": x.color,
                "week_start_date": x.week_start_date.isoformat() if x.week_start_date else None,
            }
            for x in rows
        ]
    })


@require_GET
def study_session_weeks(request):
    from .study_models import StudySession
    from django.db.models import Min, Max, Count, Sum
    if not request.user.is_authenticated or not request.user.is_active:
        return error("وارد حساب کاربری شوید.", 401)

    student_id = request.GET.get("student")
    if request.user.role == "student":
        target_student_id = request.user.id
    elif student_id:
        try:
            target_student_id = int(student_id)
        except ValueError:
            return error("شناسه دانش‌آموز نامعتبر است.", 400)
    else:
        return error("شناسه دانش‌آموز الزامی است.", 400)

    if request.user.role == "consultant":
        rows = StudySession.objects.filter(student_id=target_student_id, consultant=request.user)
    elif request.user.role in MANAGER_ROLES:
        rows = StudySession.objects.filter(student_id=target_student_id)
    elif request.user.role == "student":
        rows = StudySession.objects.filter(student=request.user)
    else:
        return error("دسترسی ندارید.", 403)

    now = timezone.now()
    days_since_saturday = (now.weekday() - 5) % 7
    this_saturday = (now - timedelta(days=days_since_saturday)).date()

    agg = rows.aggregate(min_ws=Min("week_start_date"), max_ws=Max("week_start_date"), total_count=Count("id"))
    min_ws = agg["min_ws"]
    max_ws = agg["max_ws"]

    null_count = rows.filter(week_start_date__isnull=True).count()
    if null_count > 0:
        if not min_ws or min_ws > this_saturday:
            min_ws = this_saturday

    start_sat = min_ws if min_ws else this_saturday
    future_limit = this_saturday + timedelta(weeks=4)
    end_sat = max_ws if (max_ws and max_ws > future_limit) else future_limit

    start_days_since_sat = (start_sat.weekday() - 5) % 7
    start_sat = start_sat - timedelta(days=start_days_since_sat)

    session_counts = {}
    for item in rows.exclude(week_start_date__isnull=True).values("week_start_date").annotate(cnt=Count("id"), total_min=Sum("planned_minutes")):
        ws = item["week_start_date"]
        session_counts[ws] = (item["cnt"], item["total_min"] or 0)

    if null_count > 0:
        cur_cnt, cur_min = session_counts.get(this_saturday, (0, 0))
        null_min = rows.filter(week_start_date__isnull=True).aggregate(m=Sum("planned_minutes"))["m"] or 0
        session_counts[this_saturday] = (cur_cnt + null_count, cur_min + null_min)

    def _gregorian_to_jalali(gy, gm, gd):
        g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
        gy2 = gy - 1600 if gm > 2 else gy - 1601
        days = 365 * gy2 + (gy2 + 3) // 4 - (gy2 + 99) // 100 + (gy2 + 399) // 400 - 80 + gd + g_d_m[gm - 1]
        jy = 979 + 33 * (days // 12053) + 4 * ((days % 12053) // 1461)
        days %= 1461
        if days >= 366:
            jy += (days - 1) // 365
            days = (days - 1) % 365
        for i in range(11):
            d = 31 if i < 6 else 30
            if days < d:
                return jy, i + 1, days + 1
            days -= d
        return jy, 12, days + 1

    fa_months = ['', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']

    weeks_list = []
    curr = start_sat
    while curr <= end_sat:
        fri = curr + timedelta(days=6)
        cnt, total_min = session_counts.get(curr, (0, 0))
        is_cur = (curr == this_saturday)
        is_past = (curr < this_saturday)
        is_fut = (curr > this_saturday)

        s_y, s_m, s_d = _gregorian_to_jalali(curr.year, curr.month, curr.day)
        f_y, f_m, f_d = _gregorian_to_jalali(fri.year, fri.month, fri.day)
        w_label = f"شنبه {s_d} {fa_months[s_m]} تا جمعه {f_d} {fa_months[f_m]}"

        weeks_list.append({
            "week_start": curr.isoformat(),
            "week_end": fri.isoformat(),
            "label": w_label,
            "session_count": cnt,
            "total_minutes": total_min,
            "total_planned_minutes": total_min,
            "is_current": is_cur,
            "is_past": is_past,
            "is_future": is_fut,
        })
        curr += timedelta(days=7)

    return JsonResponse({
        "results": weeks_list,
        "current_week_start": this_saturday.isoformat(),
        "first_week_start": start_sat.isoformat(),
        "latest_week_start": end_sat.isoformat(),
        "total_sessions": agg["total_count"] or 0
    })


@require_POST
@csrf_protect
def study_sessions_create(request):
    from .study_models import StudySession
    from django.contrib.auth import get_user_model
    if not request.user.is_authenticated or not request.user.is_active: return error("وارد حساب کاربری شوید.", 401)
    if request.user.role != "consultant": return error("فقط مشاور می‌تواند برنامه ثبت کند.", 403)
    try:
        data=json.loads(request.body or b"{}"); student_id=int(data.get("student_id")); weekday=int(data.get("weekday")); minutes=int(data.get("planned_minutes",60)); subject=str(data.get("subject","")).strip(); mode=data.get("mode","study"); tests=int(data.get("test_count",0) or 0)
        if not 0 <= weekday <= 6 or not 1 <= minutes <= 1440 or not subject or len(subject)>150 or mode not in {"test","written","study"} or not 0 <= tests <= 500: raise ValueError
        student=get_user_model().objects.get(pk=student_id,role="student",is_active=True)
        if not ConsultationRequest.objects.filter(student=student,assigned_consultant__user=request.user,status="approved").exists(): return error("این دانش‌آموز به شما تخصیص داده نشده است.",403)
        week_start_date = None
        ws_str = data.get("week_start_date")
        if ws_str:
            try:
                week_start_date = datetime.strptime(str(ws_str).strip(), "%Y-%m-%d").date()
            except (ValueError, TypeError):
                pass
        item=StudySession.objects.create(
            student=student,
            consultant=request.user,
            weekday=weekday,
            planned_minutes=minutes,
            subject=subject,
            mode=mode,
            test_count=tests if mode=="test" else 0,
            instructions=str(data.get("instructions",""))[:500],
            color=data.get("color") if data.get("color") in {"mint","blue","peach","lavender","rose","yellow"} else "mint",
            week_start_date=week_start_date
        )
        return JsonResponse({"id":item.id, "week_start_date": item.week_start_date.isoformat() if item.week_start_date else None},status=201)
    except (ValueError,TypeError,KeyError,get_user_model().DoesNotExist): return error("اطلاعات برنامه معتبر نیست.",400)


@require_POST
@csrf_protect
def study_sessions_delete(request, session_id):
    from .study_models import StudySession
    if not request.user.is_authenticated or not request.user.is_active: return error("وارد حساب کاربری شوید.", 401)
    if request.user.role not in {"consultant", "manager", "admin"}: return error("دسترسی ندارید.", 403)
    try:
        if request.user.role in {"manager", "admin"}:
            item = StudySession.objects.get(pk=session_id)
        else:
            item = StudySession.objects.get(pk=session_id, consultant=request.user)
        item.delete()
        return JsonResponse({"detail": "سهمیهٔ مطالعه با موفقیت حذف شد.", "ok": True})
    except StudySession.DoesNotExist:
        return error("برنامه پیدا نشد.", 404)


@require_POST
@csrf_protect
def study_sessions_update(request, session_id):
    from .study_models import StudySession
    if not request.user.is_authenticated or not request.user.is_active: return error("وارد حساب کاربری شوید.", 401)
    if request.user.role not in {"consultant", "manager", "admin"}: return error("دسترسی ندارید.", 403)
    try:
        if request.user.role in {"manager", "admin"}:
            item = StudySession.objects.get(pk=session_id)
        else:
            item = StudySession.objects.get(pk=session_id, consultant=request.user)
        data = json.loads(request.body or b"{}")
        if "weekday" in data:
            wd = int(data["weekday"])
            if 0 <= wd <= 6:
                item.weekday = wd
        if "planned_minutes" in data:
            mins = int(data["planned_minutes"])
            if 1 <= mins <= 1440:
                item.planned_minutes = mins
        if "color" in data and data["color"] in {"mint","blue","peach","lavender","rose","yellow"}:
            item.color = data["color"]
        if "instructions" in data:
            item.instructions = str(data["instructions"])[:500]
        if "week_start_date" in data:
            ws = data["week_start_date"]
            if ws:
                item.week_start_date = datetime.strptime(str(ws).strip(), "%Y-%m-%d").date()
            else:
                item.week_start_date = None
        item.save()
        return JsonResponse({
            "id": item.id,
            "weekday": item.weekday,
            "planned_minutes": item.planned_minutes,
            "subject": item.subject,
            "mode": item.mode,
            "instructions": item.instructions,
            "color": item.color,
            "week_start_date": item.week_start_date.isoformat() if item.week_start_date else None,
        })
    except (StudySession.DoesNotExist, ValueError, TypeError):
        return error("ویرایش برنامه انجام نشد.", 400)


def _tehran_today():
    return timezone.localtime(timezone.now(), ZoneInfo("Asia/Tehran")).date()

def _timer_seconds(timer):
    return timer.elapsed_seconds + (max(0, int((timezone.now() - timer.running_since).total_seconds())) if timer.running_since else 0)

@require_GET
def study_timers_today(request):
    from .study_models import StudySession, StudyTimer
    from django.db.models import Q
    if not authenticated_role(request, {"student"}):
        return error("فقط دانش‌آموز می‌تواند زمان‌سنج را ببیند.", 403)
    today = _tehran_today()
    weekday = (today.weekday() + 2) % 7
    this_saturday = today - timedelta(days=weekday)
    scheduled_sessions = StudySession.objects.filter(
        student=request.user,
        weekday=weekday
    ).filter(
        Q(week_start_date=this_saturday) | Q(week_start_date__isnull=True)
    )
    existing_timers = list(StudyTimer.objects.filter(student=request.user, study_date=today).order_by("created_at", "id"))
    existing_plan_ids = {t.plan_id for t in existing_timers if t.plan_id}
    
    # Auto-initialize today's scheduled sessions as boxes if not already created
    if len(existing_timers) < 30:
        created_any = False
        for session in scheduled_sessions:
            if session.id not in existing_plan_ids and len(existing_timers) < 30:
                timer = StudyTimer.objects.create(
                    student=request.user,
                    plan=session,
                    subject=session.subject,
                    study_date=today,
                )
                existing_timers.append(timer)
                existing_plan_ids.add(session.id)
                created_any = True

    results = []
    for x in existing_timers:
        subj = x.subject or (x.plan.subject if x.plan else "مطالعه")
        results.append({
            "id": x.id,
            "plan_id": x.plan_id,
            "subject": subj,
            "elapsed_seconds": _timer_seconds(x),
            "running": bool(x.running_since),
            "finished": bool(x.finished_at),
            "delivered": bool(x.delivered_at),
            "notes": x.notes,
            "manual_edits": x.manual_edits,
            "edits_remaining": max(0, 5 - x.manual_edits),
            "is_planned": bool(x.plan_id and x.plan and x.plan.weekday == weekday),
            "planned_minutes": x.plan.planned_minutes if x.plan else None,
        })
    return JsonResponse({
        "results": results,
        "box_count": len(results),
        "max_boxes": 30,
        "can_add": len(results) < 30,
    })

@require_POST
@csrf_protect
def study_timer_create_box(request):
    from .study_models import StudySession, StudyTimer
    if not authenticated_role(request, {"student"}):
        return error("فقط دانش‌آموز می‌تواند باکس مطالعه اضافه کند.", 403)
    try:
        data = json.loads(request.body or b"{}")
        if not isinstance(data, dict):
            raise ValueError
        subject = str(data.get("subject", "")).strip()[:80]
        if not subject:
            raise ValueError("نام درس الزامی است.")
    except (ValueError, TypeError, json.JSONDecodeError):
        return error("اطلاعات ارسال‌شده معتبر نیست.", 400)
    
    today = _tehran_today()
    count = StudyTimer.objects.filter(student=request.user, study_date=today).count()
    if count >= 30:
        return error("سقف مجاز ۳۰ باکس مطالعه برای امروز تکمیل شده است.", 429)

    matching_plan = StudySession.objects.filter(student=request.user, subject=subject).first()
    timer = StudyTimer.objects.create(
        student=request.user,
        plan=matching_plan,
        subject=subject,
        study_date=today,
    )
    weekday = (today.weekday() + 2) % 7
    return JsonResponse({
        "id": timer.id,
        "plan_id": timer.plan_id,
        "subject": timer.subject,
        "elapsed_seconds": 0,
        "running": False,
        "finished": False,
        "delivered": False,
        "notes": "",
        "manual_edits": 0,
        "edits_remaining": 5,
        "is_planned": bool(timer.plan_id and timer.plan and timer.plan.weekday == weekday),
        "planned_minutes": timer.plan.planned_minutes if timer.plan else None,
    }, status=201)

@require_POST
@csrf_protect
def study_timer_action(request):
    from django.db import transaction
    from .study_models import StudySession, StudyTimer
    if not authenticated_role(request, {"student"}):
        return error("فقط دانش‌آموز می‌تواند زمان‌سنج را ثبت کند.", 403)
    try:
        data = json.loads(request.body or b"{}")
        if not isinstance(data, dict):
            raise ValueError
        timer_id = data.get("timer_id")
        plan_id = data.get("plan_id")
        action = str(data.get("action", "")).strip()
        if action not in {"start", "pause", "finish", "edit"}:
            raise ValueError("عملیات نامعتبر است.")
    except (ValueError, TypeError, json.JSONDecodeError):
        return error("درخواست نامعتبر است.", 400)

    today = _tehran_today()
    with transaction.atomic():
        timer = None
        if timer_id:
            try:
                timer = StudyTimer.objects.select_for_update().get(pk=int(timer_id), student=request.user, study_date=today)
            except (StudyTimer.DoesNotExist, ValueError):
                return error("باکس مطالعه پیدا نشد.", 404)
        elif plan_id:
            try:
                timer = StudyTimer.objects.select_for_update().filter(plan_id=int(plan_id), student=request.user, study_date=today).first()
                if not timer:
                    if StudyTimer.objects.filter(student=request.user, study_date=today).count() >= 30:
                        return error("سقف ۳۰ باکس امروز پر شده است.", 429)
                    plan = StudySession.objects.get(pk=int(plan_id), student=request.user)
                    timer = StudyTimer.objects.create(student=request.user, plan=plan, subject=plan.subject, study_date=today)
            except (StudySession.DoesNotExist, ValueError):
                return error("درس انتخاب‌شده پیدا نشد.", 404)
        else:
            return error("شناسه باکس الزامی است.", 400)

        # Before midnight check: once delivered, no more modifications allowed
        if timer.delivered_at:
            return error("گزارش این درس ساعت ۱۲ شب ارسال شده و قابل ویرایش نیست.", 409)

        now = timezone.now()
        if action == "edit":
            if timer.running_since:
                timer.elapsed_seconds += max(0, int((now - timer.running_since).total_seconds()))
                timer.running_since = None

            if "notes" in data:
                timer.notes = str(data.get("notes", ""))[:1000].strip()

            minutes_raw = data.get("minutes")
            if minutes_raw is not None and str(minutes_raw).strip() != "":
                try:
                    minutes = int(minutes_raw)
                    if not 0 <= minutes <= 1440:
                        raise ValueError
                except (ValueError, TypeError):
                    return error("مدت باید بین صفر تا ۱۴۴۰ دقیقه باشد.", 400)

                new_seconds = minutes * 60
                if new_seconds != timer.elapsed_seconds:
                    if timer.manual_edits >= 5:
                        return error("سهمیهٔ ویرایش زمان این درس برای امروز تمام شده است (حداکثر ۵ بار).", 429)
                    timer.elapsed_seconds = new_seconds
                    timer.manual_edits += 1

            timer.save(update_fields=("elapsed_seconds", "running_since", "notes", "manual_edits", "updated_at"))
            return JsonResponse({
                "id": timer.id,
                "elapsed_seconds": timer.elapsed_seconds,
                "running": bool(timer.running_since),
                "finished": bool(timer.finished_at),
                "delivered": bool(timer.delivered_at),
                "notes": timer.notes,
                "manual_edits": timer.manual_edits,
                "edits_remaining": max(0, 5 - timer.manual_edits),
            })

        if "notes" in data:
            timer.notes = str(data.get("notes", ""))[:1000].strip()

        if action == "start":
            # Before midnight, if timer was previously marked finished, clear finished_at to resume
            if timer.finished_at:
                timer.finished_at = None
            # Seamless pause for any other running timer
            other_running = StudyTimer.objects.select_for_update().filter(
                student=request.user,
                study_date=today,
                running_since__isnull=False
            ).exclude(pk=timer.pk)
            for other in other_running:
                other.elapsed_seconds += max(0, int((now - other.running_since).total_seconds()))
                other.running_since = None
                other.save(update_fields=("elapsed_seconds", "running_since", "updated_at"))
            if not timer.running_since:
                timer.running_since = now
        elif action in {"pause", "finish"}:
            if timer.running_since:
                timer.elapsed_seconds += max(0, int((now - timer.running_since).total_seconds()))
                timer.running_since = None
            if action == "finish":
                timer.finished_at = now
        timer.save()

    return JsonResponse({
        "id": timer.id,
        "elapsed_seconds": _timer_seconds(timer),
        "running": bool(timer.running_since),
        "finished": bool(timer.finished_at),
        "delivered": bool(timer.delivered_at),
        "notes": timer.notes,
        "manual_edits": timer.manual_edits,
        "edits_remaining": max(0, 5 - timer.manual_edits),
    })

@require_GET
def study_reports(request):
    from .management.commands.send_daily_study_reports import deliver_pending_daily_reports
    from .study_models import StudyReport
    from accounts.models import User
    from django.db.models import Q

    if not request.user.is_authenticated or not request.user.is_active:
        return error("وارد حساب کاربری شوید.", 401)
    
    # Process any midnight roll-over deliveries
    deliver_pending_daily_reports()

    if request.user.role == "student":
        rows = StudyReport.objects.filter(student=request.user).select_related("student")
    elif request.user.role == "consultant":
        rows = StudyReport.objects.filter(consultant=request.user).select_related("student")
        student_param = request.GET.get("student", "").strip()
        if student_param.isdigit():
            rows = rows.filter(student_id=int(student_param))
        grade = request.GET.get("grade", "").strip()
        if grade:
            rows = rows.filter(student__grade=grade)
        major = request.GET.get("major", "").strip()
        if major:
            rows = rows.filter(student__major=major)
        q = request.GET.get("q", "").strip()[:100].translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789"))
        if q:
            rows = rows.filter(Q(student__full_name__icontains=q) | Q(student__phone__icontains=q))
    elif request.user.role in MANAGER_ROLES:
        rows = StudyReport.objects.all().select_related("student")
        student_param = request.GET.get("student", "").strip()
        if student_param.isdigit():
            rows = rows.filter(student_id=int(student_param))
        grade = request.GET.get("grade", "").strip()
        if grade:
            rows = rows.filter(student__grade=grade)
        major = request.GET.get("major", "").strip()
        if major:
            rows = rows.filter(student__major=major)
        q = request.GET.get("q", "").strip()[:100].translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧۸۹", "01234567890123456789"))
        if q:
            rows = rows.filter(Q(student__full_name__icontains=q) | Q(student__phone__icontains=q))
    else:
        return error("دسترسی مشاهده گزارش را ندارید.", 403)

    from_date = request.GET.get("from_date", "").strip()
    to_date = request.GET.get("to_date", "").strip()
    if from_date:
        rows = rows.filter(study_date__gte=from_date)
    if to_date:
        rows = rows.filter(study_date__lte=to_date)

    grade_labels = dict(User.GRADE_CHOICES)
    major_labels = dict(User.MAJOR_CHOICES)

    latest = []
    seen = set()
    for item in rows.order_by("-study_date", "-created_at", "-id")[:1000]:
        key = (item.student_id, item.consultant_id, item.study_date, item.subject)
        if key in seen:
            continue
        seen.add(key)
        latest.append(item)
        if len(latest) >= 200:
            break

    results = []
    for x in latest:
        results.append({
            "id": x.id,
            "student_id": x.student_id,
            "student_name": x.student.full_name or "دانش‌آموز",
            "student_phone": x.student.phone,
            "student_grade": grade_labels.get(x.student.grade, "ثبت نشده"),
            "student_grade_value": x.student.grade,
            "student_major": major_labels.get(x.student.major, ""),
            "student_major_value": x.student.major,
            "study_date": x.study_date.isoformat(),
            "subject": x.subject,
            "minutes": x.minutes,
            "notes": x.notes,
            "manual_edits": x.manual_edits,
            "edits_remaining": max(0, 5 - x.manual_edits),
            "created_at": timezone.localtime(x.created_at, ZoneInfo("Asia/Tehran")).isoformat(),
        })
    return JsonResponse({"results": results})


@require_POST
@csrf_protect
@transaction.atomic
def study_report_edit(request, report_id):
    from .study_models import StudyReport
    from django.db.models import Q
    if not authenticated_role(request, {"student"}):
        return error("فقط دانش‌آموز می‌تواند گزارش خودش را ویرایش کند.", 403)
    try:
        data = json.loads(request.body or b"{}")
        minutes = int(data.get("minutes"))
    except (ValueError, TypeError, json.JSONDecodeError):
        return error("اطلاعات ارسالی معتبر نیست.", 400)
    try:
        report = StudyReport.objects.select_for_update().get(pk=report_id, student=request.user)
    except StudyReport.DoesNotExist:
        return error("گزارش پیدا نشد.", 404)
    if StudyReport.objects.filter(student=report.student, consultant=report.consultant, study_date=report.study_date, subject=report.subject).filter(Q(created_at__gt=report.created_at) | Q(created_at=report.created_at, id__gt=report.id)).exists():
        return error("این نسخه قدیمی است؛ آخرین نسخهٔ گزارش را ویرایش کنید.", 409)
    if not 0 <= minutes <= 1440:
        return error("مدت باید بین صفر تا ۱۴۴۰ دقیقه باشد.", 400)
    if report.manual_edits >= 5:
        return error("سهمیهٔ ویرایش این درس امروز تمام شده است. تعداد ویرایش باقی‌مانده: ۰", 429)
    report.minutes = minutes
    report.notes = str(data.get("notes", report.notes))[:1000]
    report.manual_edits += 1
    update_fields = ["minutes", "notes", "manual_edits"]
    if "test_count" in data:
        try:
            report.test_count = max(0, min(5000, int(data.get("test_count", 0))))
            update_fields.append("test_count")
        except (ValueError, TypeError):
            pass
    report.save(update_fields=update_fields)
    return JsonResponse({
        "id": report.id,
        "minutes": report.minutes,
        "test_count": report.test_count,
        "notes": report.notes,
        "manual_edits": report.manual_edits,
        "edits_remaining": 5 - report.manual_edits
    })


@csrf_protect
def announcements(request):
    if not request.user.is_authenticated or not request.user.is_active:
        return error("وارد حساب کاربری شوید.", 401)

    from .models import AcademyAnnouncement

    if request.method == "GET":
        qs = AcademyAnnouncement.objects.select_related("author").order_by("-created_at")[:100]
        rows = []
        for a in qs:
            author_title = "مدیر مجموعه"
            if a.author.role in {"admin", "manager"}:
                author_title = a.author.full_name or "مدیریت آکادمی پایه"
            rows.append({
                "id": a.id,
                "author_id": a.author_id,
                "author_name": author_title,
                "title": a.title,
                "body": a.body,
                "image_url": a.image.url if a.image else None,
                "created_at": a.created_at.isoformat(),
            })
        return JsonResponse({"results": rows})

    if request.method == "POST":
        if request.user.role not in MANAGER_ROLES and not request.user.is_staff:
            return error("تنها مدیر مجموعه امکان ارسال پیام در کانال اطلاع‌رسانی را دارد.", 403)

        title = ""
        body = ""
        upload = None
        if request.content_type and request.content_type.startswith("application/json"):
            try:
                data = json.loads(request.body or b"{}")
                title = str(data.get("title", "")).strip()[:250]
                body = str(data.get("body", "")).strip()[:4000]
            except Exception:
                return error("درخواست نامعتبر است.", 400)
        elif request.content_type and request.content_type.startswith("multipart/form-data"):
            title = str(request.POST.get("title", "")).strip()[:250]
            body = str(request.POST.get("body", "")).strip()[:4000]
            upload = request.FILES.get("image")
        else:
            return error("نوع درخواست پشتیبانی نمی‌شود.", 415)

        if not body:
            return error("متن اطلاعیه الزامی است.", 400)

        announcement = AcademyAnnouncement.objects.create(
            author=request.user,
            title=title,
            body=body,
        )
        if upload:
            try:
                safe_img = _prepare_chat_image(upload)
                announcement.image.save(safe_img.name, safe_img, save=True)
            except Exception as e:
                announcement.delete()
                return error(str(e), 400)

        return JsonResponse({
            "id": announcement.id,
            "author_name": request.user.full_name or "مدیر مجموعه",
            "title": announcement.title,
            "body": announcement.body,
            "image_url": announcement.image.url if announcement.image else None,
            "created_at": announcement.created_at.isoformat(),
        }, status=201)

    return error("روش درخواست پشتیبانی نمی‌شود.", 405)


@require_GET
def ranking_list(request):
    if not request.user.is_authenticated or not request.user.is_active:
        return error("وارد حساب کاربری شوید.", 401)

    from .study_models import StudyReport
    from accounts.models import User
    from django.db.models import Sum, Count

    metric = request.GET.get("metric", "hours").strip().lower()
    if metric not in {"hours", "tests", "avg_tests"}:
        metric = "hours"

    students = User.objects.filter(role="student", is_active=True)
    report_stats = StudyReport.objects.values("student_id").annotate(
        total_mins=Sum("minutes"),
        total_tests=Sum("test_count"),
        active_days=Count("study_date", distinct=True)
    )
    stats_by_student = {
        s["student_id"]: {
            "total_minutes": s["total_mins"] or 0,
            "total_hours": round((s["total_mins"] or 0) / 60.0, 1),
            "total_tests": s["total_tests"] or 0,
            "active_days": s["active_days"] or 1,
            "avg_tests": round((s["total_tests"] or 0) / max(s["active_days"] or 1, 1), 1),
        }
        for s in report_stats
    }

    grade_labels = dict(User.GRADE_CHOICES)
    major_labels = dict(User.MAJOR_CHOICES)

    ranked_items = []
    for student in students:
        st = stats_by_student.get(student.id, {
            "total_minutes": 0,
            "total_hours": 0.0,
            "total_tests": 0,
            "active_days": 1,
            "avg_tests": 0.0,
        })
        if metric == "hours":
            score = st["total_hours"]
        elif metric == "tests":
            score = st["total_tests"]
        else:
            score = st["avg_tests"]

        display_name = student.full_name or f"دانش‌آموز {student.id}"
        is_me = (student.id == request.user.id)

        ranked_items.append({
            "student_id": student.id,
            "name": display_name,
            "grade": grade_labels.get(student.grade, "ثبت نشده"),
            "major": major_labels.get(student.major, ""),
            "avatar_index": student.id % 8,
            "total_hours": st["total_hours"],
            "total_tests": st["total_tests"],
            "avg_tests": st["avg_tests"],
            "score": score,
            "is_me": is_me,
        })

    ranked_items.sort(key=lambda x: (x["score"], x["total_hours"], x["total_tests"]), reverse=True)

    my_rank_info = None
    for index, item in enumerate(ranked_items, start=1):
        item["rank"] = index
        if item["is_me"]:
            my_rank_info = item

    total_count = len(ranked_items)
    if not my_rank_info and request.user.role == "student":
        my_rank_info = {
            "rank": total_count + 1,
            "student_id": request.user.id,
            "name": request.user.full_name or "شما",
            "grade": grade_labels.get(request.user.grade, ""),
            "major": major_labels.get(request.user.major, ""),
            "avatar_index": request.user.id % 8,
            "total_hours": 0.0,
            "total_tests": 0,
            "avg_tests": 0.0,
            "score": 0,
            "is_me": True,
        }

    gap_to_next = None
    if my_rank_info and my_rank_info["rank"] > 1 and len(ranked_items) >= my_rank_info["rank"]:
        prev_student = ranked_items[my_rank_info["rank"] - 2]
        diff = round(prev_student["score"] - my_rank_info["score"], 1)
        gap_to_next = {
            "target_rank": my_rank_info["rank"] - 1,
            "points_needed": max(0.1, diff) if metric == "hours" else max(1, int(diff)),
            "metric": metric,
        }

    return JsonResponse({
        "metric": metric,
        "total_students": total_count,
        "my_stats": my_rank_info,
        "gap_to_next": gap_to_next,
        "top_three": ranked_items[:3],
        "leaderboard": ranked_items[:50],
    })


@require_GET
def student_performance(request):
    if not request.user.is_authenticated or not request.user.is_active:
        return error("وارد حساب کاربری شوید.", 401)

    from .study_models import StudyReport
    from datetime import date, timedelta
    from collections import defaultdict

    student = request.user
    if request.user.role in MANAGER_ROLES or request.user.role == "consultant":
        student_id = request.GET.get("student_id", "").strip()
        if student_id.isdigit():
            from accounts.models import User
            s = User.objects.filter(pk=int(student_id), role="student").first()
            if s:
                student = s

    interval = request.GET.get("interval", "weekly").strip().lower()
    metric = request.GET.get("metric", "hours").strip().lower()
    if metric not in {"hours", "tests"}:
        metric = "hours"

    today = date.today()
    if interval == "daily":
        start_date = today - timedelta(days=6)
    elif interval == "weekly":
        start_date = today - timedelta(days=27)
    elif interval == "monthly":
        start_date = today - timedelta(days=29)
    elif interval in {"3months", "quarterly"}:
        interval = "3months"
        start_date = today - timedelta(days=89)
    elif interval in {"6months", "biannual"}:
        interval = "6months"
        start_date = today - timedelta(days=179)
    else:
        interval = "weekly"
        start_date = today - timedelta(days=27)

    reports = list(StudyReport.objects.filter(
        student=student,
        study_date__gte=start_date,
        study_date__lte=today,
    ).order_by("study_date"))

    subject_map = defaultdict(lambda: {"minutes": 0, "tests": 0})
    total_minutes = 0
    total_tests = 0
    active_days_set = set()

    for r in reports:
        subject_map[r.subject]["minutes"] += r.minutes
        subject_map[r.subject]["tests"] += r.test_count
        total_minutes += r.minutes
        total_tests += r.test_count
        active_days_set.add(r.study_date)

    total_hours = round(total_minutes / 60.0, 1)
    active_days_count = len(active_days_set) or 1
    avg_daily_hours = round(total_hours / max(active_days_count, 1), 1)
    avg_daily_tests = round(total_tests / max(active_days_count, 1), 1)

    subject_breakdown = []
    subject_palette = [
        {"bg": "#6366f1", "name": "indigo"},
        {"bg": "#10b981", "name": "emerald"},
        {"bg": "#f59e0b", "name": "amber"},
        {"bg": "#0ea5e9", "name": "sky"},
        {"bg": "#ec4899", "name": "pink"},
        {"bg": "#8b5cf6", "name": "violet"},
        {"bg": "#14b8a6", "name": "teal"},
        {"bg": "#f97316", "name": "orange"},
    ]
    sub_items = sorted(subject_map.items(), key=lambda kv: kv[1]["minutes" if metric == "hours" else "tests"], reverse=True)
    palette_idx = 0
    for subj, vals in sub_items:
        val_hours = round(vals["minutes"] / 60.0, 1)
        val_tests = vals["tests"]
        cur_val = val_hours if metric == "hours" else val_tests
        base_tot = total_hours if metric == "hours" else total_tests
        pct = round((cur_val / base_tot * 100), 1) if base_tot > 0 else 0
        color = subject_palette[palette_idx % len(subject_palette)]
        palette_idx += 1
        subject_breakdown.append({
            "subject": subj,
            "hours": val_hours,
            "tests": val_tests,
            "value": cur_val,
            "percentage": pct,
            "color": color["bg"],
        })

    timeline = []
    def _jalali_day_name(d):
        weekdays = ["دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه", "شنبه", "یکشنبه"]
        return weekdays[d.weekday()]

    if interval == "daily":
        day_lookup = defaultdict(lambda: {"minutes": 0, "tests": 0})
        for r in reports:
            day_lookup[r.study_date]["minutes"] += r.minutes
            day_lookup[r.study_date]["tests"] += r.test_count
        for i in range(7):
            d = start_date + timedelta(days=i)
            st = day_lookup[d]
            h = round(st["minutes"] / 60.0, 1)
            t = st["tests"]
            timeline.append({
                "label": _jalali_day_name(d),
                "date": d.isoformat(),
                "hours": h,
                "tests": t,
                "value": h if metric == "hours" else t,
            })
    elif interval == "weekly":
        for w in range(4):
            w_start = start_date + timedelta(days=w * 7)
            w_end = w_start + timedelta(days=6)
            w_mins = sum(r.minutes for r in reports if w_start <= r.study_date <= w_end)
            w_tests = sum(r.test_count for r in reports if w_start <= r.study_date <= w_end)
            h = round(w_mins / 60.0, 1)
            timeline.append({
                "label": f"هفته {w + 1}",
                "start": w_start.isoformat(),
                "end": w_end.isoformat(),
                "hours": h,
                "tests": w_tests,
                "value": h if metric == "hours" else w_tests,
            })
    elif interval == "monthly":
        for p in range(6):
            p_start = start_date + timedelta(days=p * 5)
            p_end = p_start + timedelta(days=4)
            p_mins = sum(r.minutes for r in reports if p_start <= r.study_date <= p_end)
            p_tests = sum(r.test_count for r in reports if p_start <= r.study_date <= p_end)
            h = round(p_mins / 60.0, 1)
            timeline.append({
                "label": f"بازه ۵ روزه {p + 1}",
                "hours": h,
                "tests": p_tests,
                "value": h if metric == "hours" else p_tests,
            })
    elif interval == "3months":
        for m in range(3):
            m_start = start_date + timedelta(days=m * 30)
            m_end = m_start + timedelta(days=29)
            m_mins = sum(r.minutes for r in reports if m_start <= r.study_date <= m_end)
            m_tests = sum(r.test_count for r in reports if m_start <= r.study_date <= m_end)
            h = round(m_mins / 60.0, 1)
            timeline.append({
                "label": f"ماه {m + 1}",
                "hours": h,
                "tests": m_tests,
                "value": h if metric == "hours" else m_tests,
            })
    else: # 6months
        for m in range(6):
            m_start = start_date + timedelta(days=m * 30)
            m_end = m_start + timedelta(days=29)
            m_mins = sum(r.minutes for r in reports if m_start <= r.study_date <= m_end)
            m_tests = sum(r.test_count for r in reports if m_start <= r.study_date <= m_end)
            h = round(m_mins / 60.0, 1)
            timeline.append({
                "label": f"ماه {m + 1}",
                "hours": h,
                "tests": m_tests,
                "value": h if metric == "hours" else m_tests,
            })

    top_subject = sub_items[0][0] if sub_items else "ثبت نشده"

    return JsonResponse({
        "interval": interval,
        "metric": metric,
        "kpi": {
            "total_hours": total_hours,
            "total_tests": total_tests,
            "active_days": active_days_count,
            "avg_daily_hours": avg_daily_hours,
            "avg_daily_tests": avg_daily_tests,
            "top_subject": top_subject,
        },
        "timeline": timeline,
        "subject_breakdown": subject_breakdown,
    })

