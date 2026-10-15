from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [("consultations", "0006_studytimer_delivered_at")]
    operations = [
        migrations.AddField(model_name="studytimer", name="manual_edits", field=models.PositiveSmallIntegerField(default=0)),
        migrations.AddField(model_name="studyreport", name="manual_edits", field=models.PositiveSmallIntegerField(default=0)),
    ]
