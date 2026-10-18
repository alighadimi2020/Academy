from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('consultations', '0014_studysession_week_start_date'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='studytimer',
            name='test_count',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='studyreport',
            name='test_count',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.CreateModel(
            name='AcademyAnnouncement',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(blank=True, max_length=250)),
                ('body', models.CharField(max_length=4000)),
                ('image', models.ImageField(blank=True, null=True, upload_to='announcements/%Y/%m/')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('author', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='academy_announcements', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ('-created_at', '-id'),
            },
        ),
    ]
