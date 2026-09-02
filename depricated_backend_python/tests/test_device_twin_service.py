from __future__ import annotations

import asyncio

from app.services.device_twin_service import _get_credential_bundle


def test_iothub_credential_uses_async_get_token() -> None:
    bundle = _get_credential_bundle()

    assert asyncio.iscoroutinefunction(bundle.credential.get_token)