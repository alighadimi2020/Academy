from django import forms
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import ReadOnlyPasswordHashField
from django.core.exceptions import ValidationError
from .models import User


class CustomUserCreationForm(forms.ModelForm):
    password1 = forms.CharField(label="رمز عبور", widget=forms.PasswordInput)
    password2 = forms.CharField(label="تکرار رمز عبور", widget=forms.PasswordInput)

    class Meta:
        model = User
        fields = ("phone", "full_name", "role", "email", "is_staff", "is_active")

    def clean_password2(self):
        p1 = self.cleaned_data.get("password1")
        p2 = self.cleaned_data.get("password2")
        if p1 and p2 and p1 != p2:
            raise ValidationError("تکرار رمز عبور یکسان نیست.")
        return p2

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data["password1"])
        if commit:
            user.save()
        return user


class CustomUserChangeForm(forms.ModelForm):
    password = ReadOnlyPasswordHashField(
        label="رمز عبور",
        help_text="رمزهای عبور با الگوریتم امن هش ذخیره شده‌اند.",
    )

    class Meta:
        model = User
        fields = "__all__"


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    add_form = CustomUserCreationForm
    form = CustomUserChangeForm
    ordering = ("phone",)

    list_display = (
        "phone",
        "full_name",
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
        "full_name",
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
                    "full_name",
                    "email",
                    "national_id",
                    "gender",
                )
            },
        ),
        (
            "اطلاعات تحصیلی",
            {
                "fields": (
                    "grade",
                    "major",
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
            "ایجاد کاربر جدید",
            {
                "classes": ("wide",),
                "fields": (
                    "phone",
                    "full_name",
                    "role",
                    "email",
                    "password1",
                    "password2",
                    "is_staff",
                    "is_active",
                ),
            },
        ),
    )

from .models import AuditEvent


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = ("created_at", "actor", "category", "action", "outcome", "ip_address")
    list_filter = ("category", "outcome", "created_at")
    search_fields = ("actor__full_name", "actor__phone", "subject", "action", "ip_address")
    date_hierarchy = "created_at"
    ordering = ("-created_at", "-id")
    list_select_related = ("actor",)
    readonly_fields = ("created_at", "actor", "category", "action", "outcome", "subject", "ip_address", "user_agent", "details")
    fields = readonly_fields
    actions = None

    def has_module_permission(self, request):
        return request.user.is_superuser

    def has_view_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
