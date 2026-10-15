from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [("consultations", "0005_study_reports")]
    operations = [migrations.AddField(model_name="studytimer", name="delivered_at", field=models.DateTimeField(blank=True, null=True))]
