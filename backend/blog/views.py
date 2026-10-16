import json
import math
import re
from datetime import datetime, time, timedelta, timezone as datetime_timezone
from zoneinfo import ZoneInfo
from pathlib import Path
from urllib.parse import urlsplit

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.http import FileResponse, Http404, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_POST
from PIL import Image, UnidentifiedImageError

from .models import BlogImage, BlogPost, BlogSubmission


MAX_IMAGE_BYTES = 4 * 1024 * 1024
MAX_IMAGE_PIXELS = 25_000_000
MAX_IMAGES = 10
MAX_DAILY_CONSULTANT_SUBMISSIONS = 5
IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}
AUTHOR_ROLES = {"consultant", "manager", "admin"}
MODERATOR_ROLES = {"manager", "admin"}


def json_error(message, code):
    return JsonResponse({"detail": message}, status=code)


def user_has_role(user, roles):
    return user.is_authenticated and user.is_active and user.role in roles


def tehran_day_bounds():
    tehran = ZoneInfo("Asia/Tehran")
    today = timezone.localtime(timezone.now(), tehran).date()
    start = datetime.combine(today, time.min, tzinfo=tehran).astimezone(datetime_timezone.utc)
    end = datetime.combine(today + timedelta(days=1), time.min, tzinfo=tehran).astimezone(datetime_timezone.utc)
    return start, end


def consultant_submission_count(user):
    if user.role != "consultant":
        return 0
    start, end = tehran_day_bounds()
    return BlogSubmission.objects.filter(author_id=user.pk, submitted_at__gte=start, submitted_at__lt=end).count()


def consultant_submission_limit_reached(user):
    if user.role != "consultant":
        return False
    get_user_model().objects.select_for_update().only("id").get(pk=user.pk)
    return consultant_submission_count(user) >= MAX_DAILY_CONSULTANT_SUBMISSIONS


def daily_limit_error():
    return json_error("سقف ارسال مقالهٔ امروز تکمیل شده است؛ هر مشاور حداکثر ۵ مقاله در روز می‌تواند ارسال کند.", 429)


def read_aparat_hash(url):
    if not url:
        return ""
    try:
        parsed = urlsplit(url.strip())
    except ValueError:
        raise ValueError("لینک ویدیو معتبر نیست.")
    if parsed.scheme != "https" or parsed.hostname not in {"aparat.com", "www.aparat.com"}:
        raise ValueError("فقط لینک HTTPS آپارات قابل قبول است.")
    patterns = (
        r"^/v/([A-Za-z0-9_-]{3,64})/?$",
        r"^/video/video/embed/videohash/([A-Za-z0-9_-]{3,64})/vt/frame/?$",
    )
    for pattern in patterns:
        match = re.fullmatch(pattern, parsed.path)
        if match:
            return match.group(1)
    raise ValueError("لینک باید به شکل aparat.com/v/شناسه باشد.")


def validate_sections(raw_value):
    try:
        sections = json.loads(raw_value)
    except (TypeError, json.JSONDecodeError):
        raise ValueError("بخش‌های مقاله درست ارسال نشده‌اند.")
    if not isinstance(sections, list) or not 1 <= len(sections) <= 20:
        raise ValueError("مقاله باید بین ۱ تا ۲۰ بخش داشته باشد.")

    cleaned = []
    for item in sections:
        if not isinstance(item, dict):
            raise ValueError("ساختار یکی از بخش‌های مقاله معتبر نیست.")
        heading = str(item.get("heading", "")).strip()
        body = str(item.get("body", "")).strip()
        if not heading or len(heading) > 140:
            raise ValueError("عنوان هر بخش الزامی است و حداکثر ۱۴۰ کاراکتر دارد.")
        if not body or len(body) > 20_000:
            raise ValueError("متن هر بخش الزامی است و حداکثر ۲۰٬۰۰۰ کاراکتر دارد.")
        cleaned.append({"heading": heading, "body": body})
    return cleaned


def validate_images(files):
    if len(files) > MAX_IMAGES:
        raise ValueError("حداکثر ۱۰ تصویر می‌توانید بارگذاری کنید.")
    for image_file in files:
        if image_file.size > MAX_IMAGE_BYTES:
            raise ValueError("حجم هر تصویر باید حداکثر ۴ مگابایت باشد.")
        try:
            image_file.seek(0)
            with Image.open(image_file) as image:
                if image.format not in IMAGE_FORMATS:
                    raise ValueError("فرمت تصویر باید JPG، PNG یا WebP باشد.")
                if image.width * image.height > MAX_IMAGE_PIXELS:
                    raise ValueError("ابعاد تصویر بیش از حد مجاز است.")
                image.verify()
            image_file.seek(0)
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
            raise ValueError("یکی از فایل‌ها تصویر معتبر نیست.")
    return files


def serialize_post(post, include_sections=False, include_review_note=False):
    item = {
        "id": post.id,
        "title": post.title,
        "summary": post.summary,
        "category": post.category,
        "author": post.author.full_name or post.author.phone,
        "reading_minutes": post.reading_minutes,
        "status": post.status,
        "created_at": post.created_at.isoformat(),
        "published_at": post.published_at.isoformat() if post.published_at else None,
        "video_url": post.video_url,
        "video_embed_url": "",
        "images": [
            {"url": picture.image.url, "alt_text": picture.alt_text, "after_section": picture.after_section}
            for picture in post.images.all()
        ],
    }
    if post.video_url:
        try:
            video_hash = read_aparat_hash(post.video_url)
            item["video_embed_url"] = f"https://www.aparat.com/video/video/embed/videohash/{video_hash}/vt/frame"
        except ValueError:
            pass
    if include_sections:
        item["sections"] = post.sections
    if include_review_note:
        item["review_note"] = post.review_note
    return item


@require_GET
def published_posts(request):
    from django.db.models import Q
    posts = BlogPost.objects.filter(status=BlogPost.Status.PUBLISHED).select_related("author").prefetch_related("images")
    query = request.GET.get("q", "").strip()[:100]
    if query:
        posts = posts.filter(Q(title__icontains=query) | Q(summary__icontains=query))
    return JsonResponse({"results": [serialize_post(post) for post in posts[:100]]})


@require_GET
def published_post_detail(request, post_id):
    try:
        post = BlogPost.objects.select_related("author").prefetch_related("images").get(
            pk=post_id, status=BlogPost.Status.PUBLISHED
        )
    except BlogPost.DoesNotExist:
        raise Http404
    return JsonResponse(serialize_post(post, include_sections=True))


@require_GET
def my_posts(request):
    if not user_has_role(request.user, AUTHOR_ROLES):
        return json_error("برای دیدن نوشته‌ها وارد حساب مشاور یا مدیر شوید.", 403 if request.user.is_authenticated else 401)
    posts = BlogPost.objects.filter(author=request.user).select_related("author").prefetch_related("images")
    return JsonResponse({"results": [serialize_post(post, include_sections=post.status == BlogPost.Status.REJECTED, include_review_note=True) for post in posts[:100]]})


@require_GET
def pending_posts(request):
    if not user_has_role(request.user, MODERATOR_ROLES):
        return json_error("دسترسی تأیید مقاله ندارید.", 403 if request.user.is_authenticated else 401)
    posts = BlogPost.objects.filter(status=BlogPost.Status.PENDING).select_related("author").prefetch_related("images")
    return JsonResponse({"results": [serialize_post(post, include_sections=True) for post in posts[:100]]})


@require_POST
@csrf_protect
def create_post(request):
    if not user_has_role(request.user, AUTHOR_ROLES):
        return json_error("فقط مشاوران و مدیران می‌توانند مقاله ثبت کنند.", 403 if request.user.is_authenticated else 401)
    if consultant_submission_count(request.user) >= MAX_DAILY_CONSULTANT_SUBMISSIONS:
        return daily_limit_error()
    try:
        title = request.POST.get("title", "").strip()
        summary = request.POST.get("summary", "").strip()
        category = request.POST.get("category", "").strip()
        if not title or len(title) > 180:
            raise ValueError("عنوان مقاله الزامی است و حداکثر ۱۸۰ کاراکتر دارد.")
        if not summary or len(summary) > 500:
            raise ValueError("خلاصه مقاله الزامی است و حداکثر ۵۰۰ کاراکتر دارد.")
        if len(category) > 80:
            raise ValueError("دسته‌بندی حداکثر ۸۰ کاراکتر دارد.")
        sections = validate_sections(request.POST.get("sections", "[]"))
        video_url = request.POST.get("video_url", "").strip()
        if len(video_url) > 500:
            raise ValueError("لینک آپارات حداکثر ۵۰۰ کاراکتر دارد.")
        if video_url:
            read_aparat_hash(video_url)
        images = validate_images(request.FILES.getlist("images"))
        raw_positions = request.POST.getlist("image_positions")
        if not raw_positions:
            image_positions = [0] * len(images)
        else:
            if len(raw_positions) != len(images):
                raise ValueError("برای هر تصویر باید جایگاه آن را انتخاب کنید.")
            try:
                image_positions = [int(value) for value in raw_positions]
            except (TypeError, ValueError):
                raise ValueError("جایگاه یکی از تصاویر معتبر نیست.")
            if any(position < 0 or position > len(sections) for position in image_positions):
                raise ValueError("جایگاه تصویر باید بعد از خلاصه یا یکی از بخش‌های مقاله باشد.")
    except ValueError as error:
        return json_error(str(error), 400)

    words = len(re.findall(r"\S+", f"{title} {summary} " + " ".join(s["body"] for s in sections)))
    reading_minutes = max(1, math.ceil(words / 200))
    is_moderator = request.user.role in MODERATOR_ROLES
    status_value = BlogPost.Status.PUBLISHED if is_moderator else BlogPost.Status.PENDING

    with transaction.atomic():
        if consultant_submission_limit_reached(request.user):
            return daily_limit_error()
        post = BlogPost.objects.create(
            title=title,
            summary=summary,
            category=category,
            sections=sections,
            video_url=video_url,
            reading_minutes=reading_minutes,
            author=request.user,
            status=status_value,
            approved_by=request.user if is_moderator else None,
            published_at=timezone.now() if is_moderator else None,
        )
        if request.user.role == "consultant":
            BlogSubmission.objects.create(post=post, author=request.user)
        for index, image_file in enumerate(images):
            picture = BlogImage(
                post=post, order=index, after_section=image_positions[index],
                alt_text=f"تصویر {index + 1} برای {title}"[:160],
            )
            image_file.seek(0)
            with Image.open(image_file) as checked_image:
                fmt = checked_image.format.lower()
            image_file.seek(0)
            picture.image.save(f"image-{index + 1}.{fmt}", image_file, save=False)
            picture.save()

    return JsonResponse(serialize_post(post, include_sections=True), status=201)


@require_POST
@csrf_protect
def revise_rejected_post(request, post_id):
    if not user_has_role(request.user, AUTHOR_ROLES):
        return json_error("برای ویرایش مقاله وارد حساب مشاور یا مدیر شوید.", 403 if request.user.is_authenticated else 401)
    try:
        post = BlogPost.objects.get(pk=post_id, author=request.user, status=BlogPost.Status.REJECTED)
    except BlogPost.DoesNotExist:
        raise Http404
    if consultant_submission_count(request.user) >= MAX_DAILY_CONSULTANT_SUBMISSIONS:
        return daily_limit_error()

    try:
        title = request.POST.get("title", "").strip()
        summary = request.POST.get("summary", "").strip()
        category = request.POST.get("category", "").strip()
        if not title or len(title) > 180:
            raise ValueError("عنوان مقاله الزامی است و حداکثر ۱۸۰ کاراکتر دارد.")
        if not summary or len(summary) > 500:
            raise ValueError("خلاصه مقاله الزامی است و حداکثر ۵۰۰ کاراکتر دارد.")
        if len(category) > 80:
            raise ValueError("دسته‌بندی حداکثر ۸۰ کاراکتر دارد.")
        sections = validate_sections(request.POST.get("sections", "[]"))
        video_url = request.POST.get("video_url", "").strip()
        if len(video_url) > 500:
            raise ValueError("لینک آپارات حداکثر ۵۰۰ کاراکتر دارد.")
        if video_url:
            read_aparat_hash(video_url)
        images = validate_images(request.FILES.getlist("images"))
        raw_positions = request.POST.getlist("image_positions")
        if raw_positions and len(raw_positions) != len(images):
            raise ValueError("برای هر تصویر باید جایگاه آن را انتخاب کنید.")
        try:
            image_positions = [int(value) for value in raw_positions] if raw_positions else [0] * len(images)
        except (TypeError, ValueError):
            raise ValueError("جایگاه یکی از تصاویر معتبر نیست.")
        if any(position < 0 or position > len(sections) for position in image_positions):
            raise ValueError("جایگاه تصویر باید بعد از خلاصه یا یکی از بخش‌های مقاله باشد.")
    except ValueError as error:
        return json_error(str(error), 400)

    words = len(re.findall(r"\S+", f"{title} {summary} " + " ".join(section["body"] for section in sections)))
    post.title = title
    post.summary = summary
    post.category = category
    post.sections = sections
    post.video_url = video_url
    post.reading_minutes = max(1, math.ceil(words / 200))
    post.status = BlogPost.Status.PENDING
    post.approved_by = None
    post.published_at = None
    post.review_note = ""
    with transaction.atomic():
        if consultant_submission_limit_reached(request.user):
            return daily_limit_error()
        post.save(update_fields=["title", "summary", "category", "sections", "video_url", "reading_minutes", "status", "approved_by", "published_at", "review_note"])
        if request.user.role == "consultant":
            BlogSubmission.objects.create(post=post, author=request.user)
        if images:
            old_images = list(post.images.all())
            for index, image_file in enumerate(images):
                image_file.seek(0)
                with Image.open(image_file) as checked_image:
                    image_format = checked_image.format.lower()
                image_file.seek(0)
                picture = BlogImage(post=post, order=index, after_section=image_positions[index], alt_text=f"تصویر {index + 1} برای {title}"[:160])
                picture.image.save(f"image-{index + 1}.{image_format}", image_file, save=False)
                picture.save()
            for picture in old_images:
                picture.image.delete(save=False)
            post.images.filter(pk__in=[picture.pk for picture in old_images]).delete()
    return JsonResponse(serialize_post(post, include_sections=True, include_review_note=True))


@require_POST
@csrf_protect
def moderate_post(request, post_id):
    if not user_has_role(request.user, MODERATOR_ROLES):
        return json_error("فقط مدیر مجموعه یا ادمین سایت می‌تواند مقاله را بررسی کند.", 403 if request.user.is_authenticated else 401)
    try:
        data = json.loads(request.body or b"{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        return json_error("درخواست معتبر نیست.", 400)
    action = data.get("action") if isinstance(data, dict) else None
    try:
        post = BlogPost.objects.get(pk=post_id, status=BlogPost.Status.PENDING)
    except BlogPost.DoesNotExist:
        raise Http404
    if action == "approve":
        post.status = BlogPost.Status.PUBLISHED
        post.approved_by = request.user
        post.published_at = timezone.now()
        post.review_note = ""
    elif action == "reject":
        post.status = BlogPost.Status.REJECTED
        post.approved_by = request.user
        post.review_note = str(data.get("note", "")).strip()[:500]
    else:
        return json_error("عملیات تأیید یا رد را انتخاب کنید.", 400)
    post.save(update_fields=["status", "approved_by", "published_at", "review_note"])
    return JsonResponse(serialize_post(post))


def serve_blog_media(request, path):
    if not settings.DEBUG:
        raise Http404
    requested = Path(path)
    if ".." in requested.parts or requested.parts[0] != "blog":
        raise Http404
    root = Path(settings.MEDIA_ROOT).resolve()
    file_path = (root / requested).resolve()
    try:
        file_path.relative_to(root)
    except ValueError:
        raise Http404
    if not file_path.is_file():
        raise Http404
    content_type = "image/jpeg" if file_path.suffix.lower() in {".jpg", ".jpeg"} else None
    return FileResponse(file_path.open("rb"), content_type=content_type)
