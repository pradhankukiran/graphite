from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from urllib.parse import parse_qs


class JWTAuthMiddleware(BaseMiddleware):
    """Authenticate WebSocket connections via JWT token in query params."""

    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"").decode()
        params = parse_qs(query_string)
        token = params.get("token", [None])[0]

        if token:
            scope["user"] = await self.get_user_from_token(token)
        else:
            scope["user"] = AnonymousUser()

        return await super().__call__(scope, receive, send)

    @database_sync_to_async
    def get_user_from_token(self, token):
        try:
            # Use ninja_jwt's token validation
            from ninja_jwt.tokens import AccessToken

            validated = AccessToken(token)
            user_id = validated.get("user_id")

            from apps.accounts.models import User

            return User.objects.get(id=user_id)
        except Exception:
            return AnonymousUser()
