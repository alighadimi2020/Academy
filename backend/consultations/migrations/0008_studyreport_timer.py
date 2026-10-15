from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    dependencies = [("consultations", "0007_manual_study_edits")]
    operations = [
        migrations.AddField(
            model_name="studyreport",
            name="timer",
            field=models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="study_report", to="consultations.studytimer"),
        ),
    ]
