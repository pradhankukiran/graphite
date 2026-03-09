from django.contrib.auth import authenticate

from apps.accounts.models import User


def create_user(email: str, password: str, full_name: str, organization: str = "") -> User:
    """Create a new user with the given credentials."""
    if User.objects.filter(email=email).exists():
        raise ValueError("A user with this email already exists")

    user = User.objects.create_user(
        email=email,
        password=password,
        full_name=full_name,
        organization=organization,
    )
    return user


def authenticate_user(email: str, password: str) -> User | None:
    """Authenticate a user by email and password. Returns User or None."""
    return authenticate(email=email, password=password)
