from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [("consultations", "0002_studysession")]
    operations = [
        migrations.AlterField(model_name="consultationmessage", name="body", field=models.CharField(blank=True, max_length=4000)),
        migrations.AddField(model_name="consultationmessage", name="image", field=models.ImageField(blank=True, null=True, upload_to="chat/%Y/%m/")),
    ]
