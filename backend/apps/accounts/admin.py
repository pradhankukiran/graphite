from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from apps.accounts.models import APIKey, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Custom admin for User model using email instead of username."""

    list_display = ("email", "full_name", "organization", "is_staff", "date_joined")
    list_filter = ("is_staff", "is_superuser", "is_active")
    search_fields = ("email", "full_name", "organization")
    ordering = ("-date_joined",)

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal info", {"fields": ("full_name", "organization", "preferences")}),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                ),
            },
        ),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "full_name", "password1", "password2"),
            },
        ),
    )


@admin.register(APIKey)
class APIKeyAdmin(admin.ModelAdmin):
    list_display = ("prefix", "name", "user", "is_active", "created_at", "expires_at")
    list_filter = ("is_active",)
    search_fields = ("name", "prefix", "user__email")
    readonly_fields = ("key_hash", "prefix", "created_at", "updated_at")
