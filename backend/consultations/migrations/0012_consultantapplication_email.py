from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('consultations', '0011_pendingconsultantregistration_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='consultantapplication',
            name='email',
            field=models.EmailField(blank=True, default='', max_length=254, verbose_name='ایمیل'),
        ),
    ]
