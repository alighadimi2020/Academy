from django.conf import settings
from django.core.management.base import BaseCommand

from accounts.audit import prune_old_events


class Command(BaseCommand):
    help = "Delete audit events older than the retention window and enforce the configured row cap."

    def add_arguments(self, parser):
        parser.add_argument("--retention-days", type=int, default=settings.AUDIT_RETENTION_DAYS)
        parser.add_argument("--max-events", type=int, default=settings.AUDIT_MAX_EVENTS)

    def handle(self, *args, **options):
        if options["retention_days"] < 1 or options["max_events"] < 1:
            self.stderr.write("Retention days and max events must both be positive.")
            return
        removed = prune_old_events(retention_days=options["retention_days"], max_events=options["max_events"])
        self.stdout.write(self.style.SUCCESS(f"Removed {removed} audit events; retained at most {options['max_events']} events from the last {options['retention_days']} days."))
