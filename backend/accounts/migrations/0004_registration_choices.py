from django.db import migrations, models


def populate_default_grade(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    User.objects.filter(grade="").update(grade="2")


class Migration(migrations.Migration):
    dependencies = [("accounts", "0003_student_registration")]

    operations = [
        migrations.RunPython(populate_default_grade, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="user",
            name="grade",
            field=models.CharField(choices=[(str(grade), f"پایه {grade}") for grade in range(2, 13)] + [("graduate", "فارغ‌التحصیل")], max_length=10, verbose_name="پایه تحصیلی"),
        ),
    ]
