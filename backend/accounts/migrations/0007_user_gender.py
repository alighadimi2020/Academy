from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [("accounts", "0006_auditevent")]
    operations = [
        migrations.AddField(model_name="user", name="gender", field=models.CharField(blank=True, choices=[("female", "دختر"), ("male", "پسر")], max_length=10, verbose_name="جنسیت")),
        migrations.AddField(model_name="pendingregistration", name="gender", field=models.CharField(blank=True, max_length=10)),
    ]
