"""SMS delivery adapter. Configure SMS_BACKEND to replace the development sender."""
import logging

from django.conf import settings
from django.utils.module_loading import import_string

logger = logging.getLogger(__name__)


class ConsoleSmsSender:
    """Development sender; prints the OTP in the Django server terminal."""

    def send(self, phone, message):
        if not settings.DEBUG:
            raise RuntimeError("برای ارسال پیامک، SMS_BACKEND را روی سرویس پیامکی تنظیم کنید.")
        logger.warning("Development SMS to %s: %s", phone, message)


def send_verification_code(phone, code):
    backend_path = getattr(settings, "SMS_BACKEND", "accounts.sms.ConsoleSmsSender")
    sender = import_string(backend_path)()
    sender.send(phone, f"کد تایید ثبت‌نام آکادمی پایه: {code}")
