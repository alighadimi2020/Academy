from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0002_alter_user_managers")]

    operations = [
        migrations.AddField(
            model_name="user",
            name="full_name",
            field=models.CharField(default="", max_length=100, verbose_name="نام و نام خانوادگی"),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="user",
            name="national_id",
            field=models.CharField(blank=True, max_length=20, verbose_name="کد ملی"),
        ),
        migrations.AddField(
            model_name="user",
            name="parent_phone",
            field=models.CharField(blank=True, max_length=11, verbose_name="شماره والد"),
        ),
        migrations.AddField(
            model_name="user",
            name="grade",
            field=models.CharField(choices=[(str(grade), f"پایه {grade}") for grade in range(2, 13)] + [("graduate", "فارغ‌التحصیل")], default="2", max_length=10, verbose_name="پایه تحصیلی"),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="user",
            name="major",
            field=models.CharField(blank=True, choices=[("math", "ریاضی فیزیک"), ("experimental", "تجربی"), ("humanities", "انسانی"), ("technical", "فنی")], max_length=20, verbose_name="رشته تحصیلی"),
        ),
        migrations.CreateModel(
            name="PendingRegistration",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("phone", models.CharField(max_length=11, unique=True)),
                ("full_name", models.CharField(max_length=100)),
                ("national_id", models.CharField(blank=True, max_length=20)),
                ("parent_phone", models.CharField(blank=True, max_length=11)),
                ("grade", models.CharField(max_length=10)),
                ("major", models.CharField(blank=True, max_length=20)),
                ("password_hash", models.CharField(max_length=128)),
                ("verification_code_hash", models.CharField(max_length=128)),
                ("expires_at", models.DateTimeField()),
                ("attempts", models.PositiveSmallIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now=True)),
            ],
        ),
    ]
