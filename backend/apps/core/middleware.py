import logging
import time

logger = logging.getLogger(__name__)


class RequestTimingMiddleware:
    """Middleware that logs the time taken to process each request."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start = time.perf_counter()
        response = self.get_response(request)
        duration_ms = (time.perf_counter() - start) * 1000.0

        logger.info(
            "%s %s %d %.2fms",
            request.method,
            request.get_full_path(),
            response.status_code,
            duration_ms,
        )

        response["X-Request-Duration-Ms"] = f"{duration_ms:.2f}"
        return response
