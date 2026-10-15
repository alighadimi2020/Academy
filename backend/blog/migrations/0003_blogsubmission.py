from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


def seed_existing_submissions(apps, schema_editor):
    BlogPost = apps.get_model("blog", "BlogPost")
    BlogSubmission = apps.get_model("blog", "BlogSubmission")
    batch = []
    for post in BlogPost.objects.filter(author__role="consultant").only("id", "author_id", "created_at").iterator():
        batch.append(BlogSubmission(post_id=post.id, author_id=post.author_id, submitted_at=post.created_at))
        if len(batch) >= 1000:
            BlogSubmission.objects.bulk_create(batch)
            batch = []
    if batch:
        BlogSubmission.objects.bulk_create(batch)


class Migration(migrations.Migration):
    dependencies = [("blog", "0002_blogimage_after_section")]

    operations = [
        migrations.CreateModel(
            name="BlogSubmission",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("submitted_at", models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ("author", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="blog_submissions", to=settings.AUTH_USER_MODEL)),
                ("post", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="submissions", to="blog.blogpost")),
            ],
            options={
                "ordering": ("-submitted_at",),
                "indexes": [models.Index(fields=["author", "submitted_at"], name="blogsub_author_date_idx")],
            },
        ),
        migrations.RunPython(seed_existing_submissions, migrations.RunPython.noop),
    ]
