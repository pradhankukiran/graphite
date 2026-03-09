from ninja.errors import HttpError


class ServiceUnavailableError(HttpError):
    """Raised when an external service (Neo4j, Redis, etc.) is unavailable."""

    def __init__(self, service: str, detail: str = ""):
        message = f"Service unavailable: {service}"
        if detail:
            message += f" - {detail}"
        super().__init__(503, message)


class BadRequestError(HttpError):
    """Raised for malformed or invalid client requests."""

    def __init__(self, detail: str = "Bad request"):
        super().__init__(400, detail)


class NotFoundError(HttpError):
    """Raised when a requested resource does not exist."""

    def __init__(self, resource: str = "Resource", detail: str = ""):
        message = f"{resource} not found"
        if detail:
            message += f": {detail}"
        super().__init__(404, message)


class ConflictError(HttpError):
    """Raised when a request conflicts with existing state (e.g., duplicate)."""

    def __init__(self, detail: str = "Conflict"):
        super().__init__(409, detail)


class ForbiddenError(HttpError):
    """Raised when the user does not have permission for the action."""

    def __init__(self, detail: str = "Forbidden"):
        super().__init__(403, detail)
