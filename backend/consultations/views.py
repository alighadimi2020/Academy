import json
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
        "student_major": dict(User.MAJOR_CHOICES).get(item.student.major, ""),
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
    if request.method == "GET":
        messages = item.messages.select_related("sender").order_by("-id")
        before = request.GET.get("before", "")
        if before.isdigit():
            messages = messages.filter(id__lt=int(before))
        rows = list(messages[:100])
        rows.reverse()
        day_start, day_end = tehran_day_range()
        used = ConsultationMessage.objects.filter(sender=request.user, created_at__gte=day_start, created_at__lt=day_end).count()
        return JsonResponse({"results": [{
            "id": msg.id,
            "sender_id": msg.sender_id,
            "sender_name": msg.sender.full_name or "کاربر",
            "body": msg.body,
            "created_at": msg.created_at.isoformat(),
        } for msg in rows], "remaining_today": max(0, 1000 - used)})
    try:
        data = json.loads(request.body or b"{}")
        body = str(data.get("body", "")).strip()
        if not body or len(body) > 4000:
            raise ValueError
    except (TypeError, ValueError, json.JSONDecodeError, AttributeError):
        return error("متن پیام الزامی است و حداکثر ۴۰۰۰ کاراکتر می‌تواند باشد.", 400)
    with transaction.atomic():
        sender = get_user_model().objects.select_for_update().get(pk=request.user.pk)
        day_start, day_end = tehran_day_range()
        sent_today = ConsultationMessage.objects.filter(sender=sender, created_at__gte=day_start, created_at__lt=day_end).count()
        if sent_today >= 1000:
            return error("سقف ۱۰۰۰ پیام روزانهٔ شما به پایان رسیده است.", 429)
        message = ConsultationMessage.objects.create(request=item, sender=sender, body=body)
    return JsonResponse({
        "id": message.id,
        "sender_id": sender.id,
        "sender_name": sender.full_name or "کاربر",
        "body": message.body,
        "created_at": message.created_at.isoformat(),
        "remaining_today": 999 - sent_today,
    }, status=201)
