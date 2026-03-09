from django.contrib.auth import authenticate
from django.http import HttpRequest
from ninja import Router
from ninja.errors import HttpError
from ninja_jwt.authentication import JWTAuth
from ninja_jwt.tokens import RefreshToken

from apps.accounts.schemas import LoginIn, RefreshIn, RegisterIn, TokenOut, UserOut
from apps.accounts.services import create_user

router = Router(tags=["Auth"])


@router.post("/register", response={201: TokenOut})
def register(request: HttpRequest, payload: RegisterIn):
    """Register a new user and return JWT tokens."""
    user = create_user(
        email=payload.email,
        password=payload.password,
        full_name=payload.full_name,
        organization=payload.organization,
    )
    refresh = RefreshToken.for_user(user)
    return 201, {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }


@router.post("/login", response=TokenOut)
def login(request: HttpRequest, payload: LoginIn):
    """Authenticate a user and return JWT tokens."""
    user = authenticate(request, username=payload.email, password=payload.password)
    if user is None:
        raise HttpError(401, "Invalid email or password")

    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }


@router.post("/refresh", response=TokenOut)
def refresh(request: HttpRequest, payload: RefreshIn):
    """Exchange a refresh token for a fresh access token."""
    try:
        refresh_token = RefreshToken(payload.refresh)
    except Exception as exc:
        raise HttpError(401, "Invalid refresh token") from exc

    return {
        "access": str(refresh_token.access_token),
        "refresh": str(refresh_token),
    }


@router.get("/me", response=UserOut, auth=JWTAuth())
def me(request: HttpRequest):
    """Get the current authenticated user's profile."""
    user = request.auth
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "organization": user.organization,
    }
