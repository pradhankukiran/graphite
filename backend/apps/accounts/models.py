import hashlib
import secrets

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils import timezone

from apps.core.models import TimestampedModel


class UserManager(BaseUserManager):
    """Custom manager for User model where email is the unique identifier."""

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("The Email field must be set")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    """Custom user model using email as the primary identifier instead of username."""

    username = None
    email = models.EmailField("email address", unique=True)
    full_name = models.CharField(max_length=255)
    organization = models.CharField(max_length=255, blank=True, default="")
    preferences = models.JSONField(default=dict, blank=True)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    class Meta:
        db_table = "accounts_user"
        verbose_name = "user"
        verbose_name_plural = "users"

    def __str__(self):
        return self.email


class APIKey(TimestampedModel):
    """API key model for programmatic access."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="api_keys")
    key_hash = models.CharField(max_length=128)
    prefix = models.CharField(max_length=8, db_index=True)
    name = models.CharField(max_length=255)
    expires_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "accounts_apikey"
        verbose_name = "API key"
        verbose_name_plural = "API keys"

    def __str__(self):
        return f"{self.prefix}... ({self.name})"

    def verify_key(self, raw_key: str) -> bool:
        """Verify that a raw key matches the stored hash."""
        hashed = hashlib.sha256(raw_key.encode()).hexdigest()
        return hashed == self.key_hash

    @classmethod
    def create_key(cls, user: User, name: str, expires_at=None) -> tuple["APIKey", str]:
        """
        Generate a new API key for the given user.

        Returns a tuple of (APIKey instance, raw_key string).
        The raw key is only available at creation time.
        """
        raw_key = secrets.token_urlsafe(48)
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        prefix = raw_key[:8]

        api_key = cls.objects.create(
            user=user,
            key_hash=key_hash,
            prefix=prefix,
            name=name,
            expires_at=expires_at,
        )
        return api_key, raw_key
