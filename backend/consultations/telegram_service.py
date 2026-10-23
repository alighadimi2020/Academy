import json
import logging
import os
import urllib.error
import urllib.request
import uuid
from zoneinfo import ZoneInfo
from django.conf import settings
from django.utils import timezone
from accounts.models import User
from consultations.models import ConsultantProfile
from consultations.study_models import StudyReportFeedback, TelegramReportLog

logger = logging.getLogger(__name__)

TEHRAN = ZoneInfo("Asia/Tehran")


def get_bot_token():
    return getattr(settings, "TELEGRAM_BOT_TOKEN", "").strip()


def get_bot_username():
    return getattr(settings, "TELEGRAM_BOT_USERNAME", "").strip()


def call_telegram_api(method: str, payload: dict = None, timeout: int = 25) -> dict:
    token = get_bot_token()
    if not token:
        logger.warning("Telegram Bot Token is not configured.")
        return {"ok": False, "description": "TELEGRAM_BOT_TOKEN not configured."}

    # Ensure socket timeout exceeds long-polling wait duration
    if payload and "timeout" in payload:
        try:
            timeout = max(timeout, int(payload["timeout"]) + 15)
        except (ValueError, TypeError):
            pass

    url = f"https://api.telegram.org/bot{token}/{method}"
    data = json.dumps(payload or {}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", "User-Agent": "AcademyBot/1.0"},
    )
    proxy = getattr(settings, "TELEGRAM_PROXY", "").strip() or os.getenv("TELEGRAM_PROXY", "").strip()
    if proxy:
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({"http": proxy, "https": proxy}))
    else:
        opener = urllib.request.build_opener()

    try:
        with opener.open(req, timeout=timeout) as response:
            body = response.read().decode("utf-8")
            return json.loads(body)
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="ignore")
        logger.error(f"Telegram API HTTPError {e.code}: {err_body}")
        try:
            return json.loads(err_body)
        except Exception:
            return {"ok": False, "description": f"HTTP {e.code}: {err_body}"}
    except Exception as exc:
        logger.error(f"Telegram API Exception: {exc}")
        return {"ok": False, "description": str(exc)}


def download_telegram_voice_file(file_id: str) -> str | None:
    token = get_bot_token()
    if not token or not file_id:
        return None
    try:
        res = call_telegram_api("getFile", {"file_id": file_id})
        if not res.get("ok"):
            logger.error(f"Failed getFile from telegram: {res}")
            return None
        file_path = res["result"].get("file_path")
        if not file_path:
            return None

        file_url = f"https://api.telegram.org/file/bot{token}/{file_path}"
        ext = os.path.splitext(file_path)[1] or ".ogg"
        filename = f"voice_{uuid.uuid4().hex[:12]}{ext}"
        rel_path = os.path.join("study_feedbacks", "voices", filename)
        abs_path = os.path.join(settings.MEDIA_ROOT, rel_path)
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)

        proxy = getattr(settings, "TELEGRAM_PROXY", "").strip() or os.getenv("TELEGRAM_PROXY", "").strip()
        if proxy:
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({"http": proxy, "https": proxy}))
        else:
            opener = urllib.request.build_opener()

        with opener.open(file_url, timeout=30) as resp:
            content = resp.read()
            with open(abs_path, "wb") as f:
                f.write(content)

        return rel_path
    except Exception as e:
        logger.error(f"Error downloading voice file from Telegram: {e}")
        return None


def send_telegram_message(chat_id: int | str, text: str, parse_mode: str = "HTML", reply_to_message_id: int = None) -> dict:
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": parse_mode,
        "disable_web_page_preview": True,
    }
    if reply_to_message_id:
        payload["reply_to_message_id"] = reply_to_message_id
    return call_telegram_api("sendMessage", payload)


def format_daily_study_report_html(student: User, study_date, reports_list) -> str:
    grade_labels = dict(User.GRADE_CHOICES)
    major_labels = dict(User.MAJOR_CHOICES)

    student_name = student.full_name or "دانش‌آموز"
    student_phone = student.phone or "—"
    grade_str = grade_labels.get(student.grade, "ثبت نشده")
    major_str = major_labels.get(student.major, "ثبت نشده")

    total_minutes = sum(r.minutes for r in reports_list)
    total_hours = total_minutes // 60
    rem_mins = total_minutes % 60

    lines = [
        "📊 <b>گزارش مطالعه روزانه دانش‌آموز</b>",
        "━━━━━━━━━━━━━━━━━━━━",
        f"👤 <b>دانش‌آموز:</b> {student_name}",
        f"📞 <b>شماره تماس:</b> <code>{student_phone}</code>",
        f"🎓 <b>پایه و رشته:</b> {grade_str} · {major_str}",
        f"📅 <b>تاریخ مطالعه:</b> {study_date}",
        "",
        f"⏱ <b>مجموع ساعت مطالعه:</b> {total_hours} ساعت و {rem_mins} دقیقه (<b>{total_minutes} دقیقه</b>)",
        "",
        "📚 <b>ریز دروس مطالعه‌شده:</b>",
    ]

    for idx, r in enumerate(reports_list, 1):
        subj = r.subject or "درس"
        manual_tag = " <i>(اصلاح دستی)</i>" if r.manual_edits > 0 else ""
        lines.append(f"{idx}. ▫️ <b>{subj}</b>: {r.minutes} دقیقه{manual_tag}")
        if r.notes:
            escaped_notes = r.notes.replace("<", "&lt;").replace(">", "&gt;").replace("&", "&amp;")
            lines.append(f"   📝 یادداشت: <i>{escaped_notes}</i>")

    lines.extend([
        "━━━━━━━━━━━━━━━━━━━━",
        "💬 <b>ثبت بازخورد مشاوره:</b>",
        "برای ارسال بازخورد، روی همین پیام <b>Reply</b> زده و پیام خود را ارسال فرمایید تا در پنل دانش‌آموز نمایش یابد.",
    ])

    return "\n".join(lines)


def send_student_daily_report_to_consultant(consultant_user: User, student_user: User, study_date, reports_list) -> tuple[bool, str]:
    profile = ConsultantProfile.objects.filter(user=consultant_user).first()

    if not profile or not profile.telegram_chat_id:
        return False, "تلگرام مشاور متصل نیست."

    if not reports_list:
        return False, "گزارشی برای ارسال وجود ندارد."

    msg_html = format_daily_study_report_html(student_user, study_date, reports_list)
    res = send_telegram_message(chat_id=profile.telegram_chat_id, text=msg_html)

    if res.get("ok"):
        telegram_message_id = res["result"]["message_id"]
        TelegramReportLog.objects.create(
            consultant=consultant_user,
            student=student_user,
            study_date=study_date,
            telegram_message_id=telegram_message_id,
        )
        return True, str(telegram_message_id)
    else:
        desc = res.get("description", "خطا در ارسال تلگرام")
        logger.error(f"Failed to send study report to Telegram chat {profile.telegram_chat_id}: {desc}")
        return False, desc


def process_telegram_update(update: dict) -> dict:
    if "message" not in update:
        return {"status": "ignored", "reason": "No message field"}

    msg = update["message"]
    chat = msg.get("chat", {})
    chat_id = chat.get("id")
    text = (msg.get("text") or "").strip()

    if not chat_id:
        return {"status": "ignored", "reason": "No chat_id"}

    # Case 1: Start with deep-link token e.g. /start <token>
    if text.startswith("/start"):
        parts = text.split(maxsplit=1)
        if len(parts) > 1:
            token = parts[1].strip()
            profile = ConsultantProfile.objects.filter(telegram_link_token=token).select_related("user").first()
            if profile:
                profile.telegram_chat_id = chat_id
                profile.telegram_connected_at = timezone.now()
                profile.telegram_link_token = None
                profile.save(update_fields=("telegram_chat_id", "telegram_connected_at", "telegram_link_token"))

                name = profile.user.full_name or "همکار گرامی"
                welcome_msg = (
                    f"👋 <b>سلام جناب/سرکار {name} عزیز،</b>\n\n"
                    "حساب تلگرام شما با موفقیت به پنل آکادمی متصل شد. ✅\n\n"
                    "از این پس:\n"
                    "۱. گزارش‌های روزانهٔ مطالعهٔ دانش‌آموزان اختصاص‌یافته به شما، هر شب ساعت ۱۲ به این صفحه ارسال می‌شود.\n"
                    "۲. شما می‌توانید با زدن <b>Reply</b> روی پیام گزارش هر دانش‌آموز، بازخورد و راهنمایی‌های خود را ارسال کنید تا در پنل شخصی همان دانش‌آموز قرار گیرد."
                )
                send_telegram_message(chat_id, welcome_msg)
                return {"status": "linked", "consultant_id": profile.user.id}
            else:
                send_telegram_message(
                    chat_id,
                    "❌ <b>توکن اتصال نامعتبر یا منقضی شده است.</b>\n"
                    "لطفاً وارد پنل مشاور آکادمی شوید و دکمهٔ «اتصال مستقیم به تلگرام» را مجدداً کلیک کنید."
                )
                return {"status": "invalid_token"}
        else:
            send_telegram_message(
                chat_id,
                "👋 <b>به ربات پشتیبانی آکادمی خوش آمدید.</b>\n\n"
                "برای اتصال حساب مشاوره خود، لطفاً از داخل پنل مشاور در سایت، روی دکمهٔ «اتصال مستقیم به تلگرام» کلیک فرمایید."
            )
            return {"status": "welcome_only"}

    # Case 2: Contact shared
    if "contact" in msg:
        contact = msg["contact"]
        phone = contact.get("phone_number", "").strip().replace("+", "")
        if phone.startswith("98") and len(phone) == 12:
            phone_alt = "0" + phone[2:]
        else:
            phone_alt = phone
        user = User.objects.filter(role="consultant", phone__in=[phone, phone_alt, "+" + phone]).first()
        if user:
            profile = user.consultation_profile
            profile.telegram_chat_id = chat_id
            profile.telegram_phone = phone
            profile.telegram_connected_at = timezone.now()
            profile.save(update_fields=("telegram_chat_id", "telegram_phone", "telegram_connected_at"))
            send_telegram_message(
                chat_id,
                f"✅ شماره تلفن <code>{phone}</code> تأیید شد و حساب شما با موفقیت متصل گردید."
            )
            return {"status": "contact_linked", "consultant_id": user.id}

    # Case 3: Reply to a report message -> Record feedback!
    reply_to = msg.get("reply_to_message")
    if reply_to:
        reply_to_msg_id = reply_to.get("message_id")
        log = TelegramReportLog.objects.filter(telegram_message_id=reply_to_msg_id).select_related("student", "consultant").first()
        if log:
            voice = msg.get("voice") or msg.get("audio")
            caption = (msg.get("caption") or "").strip()
            feedback_text = (text or caption)[:3000].strip()

            voice_file_path = None
            voice_duration = 0
            voice_file_id = ""

            if voice:
                voice_file_id = voice.get("file_id", "")
                voice_duration = voice.get("duration", 0)
                downloaded_file = download_telegram_voice_file(voice_file_id)
                if downloaded_file:
                    voice_file_path = downloaded_file
                if not feedback_text:
                    feedback_text = "پیام صوتی ارزیابی مشاور"

            if not feedback_text and not voice_file_path:
                send_telegram_message(chat_id, "⚠️ متن یا صوت بازخورد نمی‌تواند خالی باشد.", reply_to_message_id=msg.get("message_id"))
                return {"status": "empty_feedback"}

            feedback = StudyReportFeedback.objects.create(
                student=log.student,
                consultant=log.consultant,
                study_date=log.study_date,
                feedback_text=feedback_text,
                voice_file=voice_file_path,
                voice_duration=voice_duration,
                voice_telegram_file_id=voice_file_id,
                source="telegram",
                telegram_message_id=msg.get("message_id"),
            )

            student_name = log.student.full_name or "دانش‌آموز"
            voice_notice = " 🎙 (همراه با ویس تحلیلی)" if voice_file_path else ""
            confirm_msg = (
                f"✅ <b>بازخورد شما با موفقیت ثبت شد!</b>{voice_notice}\n\n"
                f"👤 دانش‌آموز: <b>{student_name}</b>\n"
                f"📅 مربوط به مطالعهٔ تاریخ: <b>{log.study_date}</b>\n\n"
                "این بازخورد در بخش «بازخوردهای مشاور» پنل دانش‌آموز نمایش داده می‌شود."
            )
            send_telegram_message(chat_id, confirm_msg, reply_to_message_id=msg.get("message_id"))
            return {"status": "feedback_saved", "feedback_id": feedback.id, "student_id": log.student.id}

    # Fallback for plain messages
    send_telegram_message(
        chat_id,
        "💡 <b>راهنما:</b>\n"
        "برای ثبت بازخورد روی گزارش مطالعهٔ دانش‌آموز، لطفاً مستقیماً روی همان پیام گزارش <b>Reply</b> (پاسخ) بزنید."
    )
    return {"status": "prompted_reply"}
