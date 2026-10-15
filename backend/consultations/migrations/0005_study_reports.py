from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    dependencies = [("consultations", "0004_alter_consultationmessage_request_and_more")]
    operations = [
        migrations.AlterField(model_name="studysession", name="start_time", field=models.TimeField(blank=True, null=True)),
        migrations.AlterField(model_name="studysession", name="end_time", field=models.TimeField(blank=True, null=True)),
        migrations.AddField(model_name="studysession", name="planned_minutes", field=models.PositiveSmallIntegerField(default=60, help_text="مدت مطالعه در روز به دقیقه")),
        migrations.CreateModel(name="StudyTimer", fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("study_date", models.DateField()), ("elapsed_seconds", models.PositiveIntegerField(default=0)),
            ("running_since", models.DateTimeField(blank=True, null=True)), ("finished_at", models.DateTimeField(blank=True, null=True)),
            ("notes", models.CharField(blank=True, max_length=1000)), ("updated_at", models.DateTimeField(auto_now=True)),
            ("plan", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="timers", to="consultations.studysession")),
            ("student", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="study_timers", to=settings.AUTH_USER_MODEL)),
        ], options={"ordering": ["-updated_at"]}),
        migrations.AddConstraint(model_name="studytimer", constraint=models.UniqueConstraint(fields=("plan", "study_date"), name="unique_study_timer_day")),
        migrations.CreateModel(name="StudyReport", fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("study_date", models.DateField()), ("subject", models.CharField(max_length=80)), ("minutes", models.PositiveIntegerField(default=0)),
            ("notes", models.CharField(blank=True, max_length=1000)), ("created_at", models.DateTimeField(auto_now_add=True)),
            ("consultant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="received_study_reports", to=settings.AUTH_USER_MODEL)),
            ("student", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="study_reports", to=settings.AUTH_USER_MODEL)),
        ], options={"ordering": ["-study_date", "-created_at"]}),
    ]
