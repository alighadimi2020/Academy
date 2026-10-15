from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    dependencies = [("accounts", "0005_alter_user_role"), ("consultations", "0001_initial")]
    operations = [migrations.CreateModel(name="StudySession", fields=[
        ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
        ("weekday", models.PositiveSmallIntegerField(help_text="شنبه=۰ تا جمعه=۶")), ("start_time", models.TimeField()),
        ("end_time", models.TimeField()), ("subject", models.CharField(max_length=80)),
        ("mode", models.CharField(choices=[("test", "تست"), ("written", "تشریحی"), ("study", "مطالعه")], default="study", max_length=12)),
        ("test_count", models.PositiveSmallIntegerField(default=0)), ("instructions", models.CharField(blank=True, max_length=300)),
        ("color", models.CharField(default="mint", max_length=20)), ("created_at", models.DateTimeField(auto_now_add=True)),
        ("consultant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="created_study_sessions", to=settings.AUTH_USER_MODEL)),
        ("student", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="study_sessions", to=settings.AUTH_USER_MODEL)),
    ], options={"ordering": ["weekday", "start_time"]})]
