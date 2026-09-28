from django.db import migrations, models


def keep_existing_images_at_end(apps, schema_editor):
    BlogImage = apps.get_model("blog", "BlogImage")
    for image in BlogImage.objects.select_related("post").iterator():
        image.after_section = len(image.post.sections or [])
        image.save(update_fields=["after_section"])


class Migration(migrations.Migration):
    dependencies = [("blog", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="blogimage",
            name="after_section",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.RunPython(keep_existing_images_at_end, migrations.RunPython.noop),
    ]
