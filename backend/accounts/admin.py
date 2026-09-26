from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    ordering = ("phone",)

    list_display = (
        "phone",
        "role",
        "is_active",
        "is_staff",
        "date_joined",
    )

    list_filter = (
        "role",
        "is_active",
        "is_staff",
        "is_superuser",
    )

    search_fields = (
        "phone",
        "first_name",
        "last_name",
        "email",
    )

    fieldsets = (
        (
            "اطلاعات ورود",
            {
                "fields": (
                    "phone",
                    "password",
                )
            },
        ),
        (
            "اطلاعات شخصی",
            {
                "fields": (
                    "first_name",
                    "last_name",
                    "email",
                )
            },
        ),
        (
            "نقش و دسترسی",
            {
                "fields": (
                    "role",
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        (
            "اطلاعات زمانی",
            {
                "fields": (
                    "last_login",
                    "date_joined",
                )
            },
        ),
    )

    add_fieldsets = (
        (
            "ایجاد کاربر",
            {
                "classes": ("wide",),
                "fields": (
                    "phone",
                    "password1",
                    "password2",
                    "role",
                    "is_staff",
                    "is_active",
                ),
            },
        ),
    )
