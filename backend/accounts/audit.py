import ipaddress
import logging

from .models import AuditEvent

logger = logging.getLogger(__name__)


def record_event(request, action, category, outcome, *, subject="", details=None):
    """Store a compact audit record. Never pass passwords, tokens, message text, or file content."""
    try:
        raw_ip = request.META.get("REMOTE_ADDR", "")
        try:
            ip = str(ipaddress.ip_address(raw_ip)) if raw_ip else None
        except ValueError:
            ip = None
        actor = getattr(request, "user", None)
        if not getattr(actor, "is_authenticated", False):
            actor = None
        user_agent = " ".join(request.META.get("HTTP_USER_AGENT", "").split())[:400]
        safe_details = details if isinstance(details, dict) else {}
        event = AuditEvent.objects.create(actor=actor, category=category, action=action[:80], outcome=outcome, subject=subject[:100], ip_address=ip, user_agent=user_agent, details=safe_details)
        from django.conf import settings
        from django.utils import timezone
        from datetime import timedelta
        AuditEvent.objects.filter(created_at__lt=timezone.now() - timedelta(days=settings.AUDIT_RETENTION_DAYS)).delete()
        prune_every = max(1, settings.AUDIT_PRUNE_EVERY)
        if event.pk % prune_every == 0:
            prune_old_events()
    except Exception:
        logger.exception("Could not persist audit event: %s", action)


def prune_old_events(*, retention_days=None, max_events=None):
    from datetime import timedelta

    from django.conf import settings
    from django.utils import timezone

    retention_days = retention_days or settings.AUDIT_RETENTION_DAYS
    max_events = max_events or settings.AUDIT_MAX_EVENTS
    expired = AuditEvent.objects.filter(created_at__lt=timezone.now() - timedelta(days=retention_days))
    expired_count = expired.count()
    if expired_count:
        expired.delete()
    keep_boundary = AuditEvent.objects.order_by("-id").values_list("id", flat=True)[max_events - 1:max_events].first()
    if keep_boundary is None:
        return expired_count
    _, overflow_count = AuditEvent.objects.filter(id__lt=keep_boundary).delete()
    return expired_count + overflow_count
