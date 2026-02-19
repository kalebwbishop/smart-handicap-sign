from workos import WorkOSClient
from typing import Union
from app.config.settings import get_settings
from app.utils.logger import logger

_workos_client: Union[WorkOSClient, None] = None


def get_workos_client() -> WorkOSClient:
    """Return a singleton WorkOS client instance."""
    global _workos_client
    if _workos_client is not None:
        return _workos_client

    settings = get_settings()

    if not settings.workos_api_key:
        logger.warning(
            "⚠️  WorkOS API key not configured. Authentication endpoints will not work."
        )

    _workos_client = WorkOSClient(
        api_key=settings.workos_api_key or "not-configured",
        client_id=settings.workos_client_id,
    )
    return _workos_client
