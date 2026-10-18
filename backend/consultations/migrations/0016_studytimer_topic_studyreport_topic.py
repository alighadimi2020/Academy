from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('consultations', '0015_add_test_count_and_announcements'),
    ]

    operations = [
        migrations.AddField(
            model_name='studytimer',
            name='topic',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='studyreport',
            name='topic',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
    ]
