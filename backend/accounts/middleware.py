import logging
import re

from .audit import record_event

logger = logging.getLogger(__name__)


class SecurityAuditMiddleware:
    """Record API mutations and denied/server-error responses without capturing request bodies."""
    WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        self._record_response(request, response.status_code)
        return response

    def process_exception(self, request, exception):
        if request.path.startswith("/api/"):
            request._security_audit_exception_recorded = True
            record_event(request, "server.exception", "system", "error", details={"method": request.method, "path": request.path[:240], "exception": type(exception).__name__})
            logger.exception("Unhandled API exception on %s %s", request.method, request.path)
        return None

    def _record_response(self, request, status_code):
        path = request.path
        if not path.startswith("/api/") or getattr(request, "_security_audit_exception_recorded", False):
            return
        if path in {"/api/auth/login/", "/api/auth/logout/"}:
            return
        if status_code == 401 and path == "/api/auth/me/":
            return
        if request.method not in self.WRITE_METHODS and status_code not in {401, 403, 429} and status_code < 500:
            return
        if path.startswith("/api/auth/"):
            category = "auth"
        elif path.startswith("/api/manager/"):
            category = "users"
        elif "/study-sessions" in path:
            category = "schedule"
        elif path.startswith("/api/consultations/"):
            category = "consultation"
        elif path.startswith("/api/blog/"):
            category = "content"
        else:
            category = "security" if status_code in {401, 403, 429} or status_code >= 500 else "system"
        outcome = "success" if status_code < 400 else "denied" if status_code < 500 else "error"
        target = re.findall(r"\d+", path)
        record_event(request, f"api.{request.method.lower()}", category, outcome, details={"method": request.method, "path": path[:240], "status": status_code, "target_id": target[-1] if target else ""})
