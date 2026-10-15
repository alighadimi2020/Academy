from django.conf import settings
from django.db import models
from django.utils import timezone


class BlogPost(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "در انتظار بررسی"
        PUBLISHED = "published", "منتشرشده"
        REJECTED = "rejected", "ردشده"

    title = models.CharField(max_length=180)
    summary = models.CharField(max_length=500)
    category = models.CharField(max_length=80, blank=True)
    sections = models.JSONField(default=list)
    video_url = models.URLField(max_length=500, blank=True)
    reading_minutes = models.PositiveSmallIntegerField(default=1)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="blog_posts")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING, db_index=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_blog_posts",
    )
    review_note = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-published_at", "-created_at")

    def __str__(self):
        return self.title


class BlogImage(models.Model):
    post = models.ForeignKey(BlogPost, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="blog/%Y/%m/")
    alt_text = models.CharField(max_length=160, blank=True)
    order = models.PositiveSmallIntegerField(default=0)
    after_section = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ("order", "id")

    def __str__(self):
        return f"تصویر {self.order + 1} برای {self.post.title}"


class BlogSubmission(models.Model):
    post = models.ForeignKey(BlogPost, on_delete=models.CASCADE, related_name="submissions")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="blog_submissions")
    submitted_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ("-submitted_at",)
        indexes = [models.Index(fields=("author", "submitted_at"), name="blogsub_author_date_idx")]

    def __str__(self):
        return f"ارسال {self.post_id} توسط {self.author_id}"
