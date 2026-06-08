from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Optional
from urllib.parse import quote

import httpx
from azure.identity import DefaultAzureCredential

from app.config.settings import get_settings

IOTHUB_API_VERSION = "2021-04-12"
IOTHUB_SCOPE = "https://iothubs.azure.net/.default"


@dataclass(frozen=True)
class IoTHubServiceConfig:
    host_name: str


@dataclass(frozen=True)
class _CredentialBundle:
    credential: DefaultAzureCredential
    lock: asyncio.Lock


@lru_cache(maxsize=1)
def _get_credential_bundle() -> _CredentialBundle:
    managed_identity_client_id = os.environ.get("AZURE_CLIENT_ID")

    return _CredentialBundle(
        credential=DefaultAzureCredential(
            managed_identity_client_id=managed_identity_client_id
        ),
        lock=asyncio.Lock(),
    )

def _get_service_config() -> IoTHubServiceConfig:
    settings = get_settings()
    host_name = settings.iothub_host_name.strip()
    if not host_name:
        raise RuntimeError("IOTHUB_HOST_NAME is not configured")
    return IoTHubServiceConfig(host_name=host_name)


async def _get_access_token() -> str:
    bundle = _get_credential_bundle()
    async with bundle.lock:
        token = await bundle.credential.get_token(IOTHUB_SCOPE)
    return token.token


def _extract_twin_state(serial_number: str, twin: dict[str, Any]) -> dict[str, Any]:
    properties = twin.get("properties") or {}
    return {
        "serial_number": twin.get("deviceId") or serial_number,
        "desired_properties": properties.get("desired") or {},
        "reported_properties": properties.get("reported") or {},
        "etag": twin.get("etag"),
    }


async def _request_twin(method: str, serial_number: str, *, json_body: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    config = _get_service_config()
    encoded_serial_number = quote(serial_number, safe="")
    url = f"https://{config.host_name}/twins/{encoded_serial_number}?api-version={IOTHUB_API_VERSION}"
    headers = {
        "Authorization": f"Bearer {await _get_access_token()}",
        "Content-Type": "application/json",
    }
    if method.upper() == "PATCH":
        headers["If-Match"] = "*"

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.request(method.upper(), url, headers=headers, json=json_body)

    response.raise_for_status()
    return response.json()


async def get_device_twin(serial_number: str) -> dict[str, Any]:
    return await _request_twin("GET", serial_number)


async def get_device_twin_state(serial_number: str) -> dict[str, Any]:
    twin = await get_device_twin(serial_number)
    return _extract_twin_state(serial_number, twin)


async def get_device_reported_properties(serial_number: str) -> dict[str, Any]:
    twin = await get_device_twin(serial_number)
    properties = twin.get("properties") or {}
    return properties.get("reported") or {}


async def update_device_desired_properties(
    serial_number: str,
    desired_properties: dict[str, Any],
) -> dict[str, Any]:
    twin = await _request_twin(
        "PATCH",
        serial_number,
        json_body={
            "properties": {
                "desired": desired_properties,
            }
        },
    )
    return _extract_twin_state(serial_number, twin)
