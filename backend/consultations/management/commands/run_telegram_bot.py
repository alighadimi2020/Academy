import time
from django.core.management.base import BaseCommand
from consultations.telegram_service import call_telegram_api, get_bot_token, process_telegram_update


class Command(BaseCommand):
    help = "Run Telegram bot in polling mode (useful for development and local testing)."

    def handle(self, *args, **options):
        token = get_bot_token()
        if not token:
            self.stdout.write(self.style.ERROR("TELEGRAM_BOT_TOKEN is not configured in settings or .env."))
            return

        self.stdout.write(self.style.SUCCESS("Starting Academy Telegram bot polling... Press Ctrl+C to stop."))
        last_offset = 0

        while True:
            try:
                res = call_telegram_api("getUpdates", {"offset": last_offset, "timeout": 20})
                if res.get("ok"):
                    for update in res.get("result", []):
                        update_id = update["update_id"]
                        last_offset = update_id + 1
                        try:
                            result = process_telegram_update(update)
                            self.stdout.write(f"Processed update {update_id}: {result}")
                        except Exception as e:
                            self.stdout.write(self.style.ERROR(f"Error processing update {update_id}: {e}"))
                else:
                    self.stdout.write(self.style.WARNING(f"getUpdates error: {res.get('description')}"))
                    time.sleep(3)
            except KeyboardInterrupt:
                self.stdout.write(self.style.SUCCESS("\nStopped bot polling."))
                break
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Polling loop exception: {e}"))
                time.sleep(3)
