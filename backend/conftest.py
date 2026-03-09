import os

import django
import pytest

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()

from apps.accounts.models import User  # noqa: E402


@pytest.fixture
def user_factory(db):
    """Factory fixture for creating test users."""

    def _create_user(
        email="test@example.com",
        password="testpassword123",
        full_name="Test User",
        organization="Test Org",
        **kwargs,
    ):
        return User.objects.create_user(
            email=email,
            password=password,
            full_name=full_name,
            organization=organization,
            **kwargs,
        )

    return _create_user


@pytest.fixture
def user(user_factory):
    """Create and return a default test user."""
    return user_factory()


@pytest.fixture
def api_client():
    """Return a Django test client."""
    from django.test import Client

    return Client()
