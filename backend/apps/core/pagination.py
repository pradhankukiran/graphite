from typing import Any

from ninja import Schema
from ninja.pagination import PaginationBase


class PageNumberPagination(PaginationBase):
    """Custom page-number pagination for Django Ninja."""

    class Input(Schema):
        page: int = 1
        page_size: int = 20

    class Output(Schema):
        items: list[Any]
        count: int
        page: int
        page_size: int
        total_pages: int

    def paginate_queryset(self, queryset, pagination: Input, **params):
        page = max(pagination.page, 1)
        page_size = min(max(pagination.page_size, 1), 100)

        count = queryset.count() if hasattr(queryset, "count") else len(queryset)
        total_pages = max((count + page_size - 1) // page_size, 1)

        offset = (page - 1) * page_size
        items = list(queryset[offset : offset + page_size])

        return {
            "items": items,
            "count": count,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
        }
