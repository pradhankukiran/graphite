from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
    re_path(
        r"ws/ingestion/(?P<document_id>[0-9a-f-]+)/$",
        consumers.IngestionConsumer.as_asgi(),
    ),
    re_path(
        r"ws/query/stream/$",
        consumers.QueryStreamConsumer.as_asgi(),
    ),
]
