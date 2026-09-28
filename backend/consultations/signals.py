from django.db.models.signals import post_save
from django.dispatch import receiver

from accounts.models import User
from .models import ConsultantProfile


@receiver(post_save, sender=User)
def ensure_consultant_profile(sender, instance, **kwargs):
    if instance.role == "consultant":
        ConsultantProfile.objects.get_or_create(user=instance)
