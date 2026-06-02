from __future__ import annotations

import base64
import hashlib
import hmac
import time
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Optional
from urllib.parse import quote

import httpx

from app.config.settings import get_settings
from app.utils.logger import logger

IOTHUB_API_VERSION = "2021-04-12"


@dataclass(frozen=True)
class IoTHubServiceConfig:
    host_name: str
    policy_name: str
    shared_access_key: str


def _parse_connection_string(connection_string: str) -> dict[str, str]:
    parsed: dict[str, str] = {}
    for segment in connection_string.split(";"):
        if not segment or "=" not in segment:
            continue
        key, value = segment.split("=", 1)
        parsed[key] = value
    return parsed


@lru_cache(maxsize=1)
def _get_service_config() -> IoTHubServiceConfig:
    settings = get_settings()
    connection_string = settings.iothub_service_connection_string.strip()
    if not connection_string:
        raise RuntimeError("IOTHUB_SERVICE_CONNECTION_STRING is not configured")

    parsed = _parse_connection_string(connection_string)
    try:
        return IoTHubServiceConfig(
            host_name=parsed["HostName"],
            policy_name=parsed["SharedAccessKeyName"],
            shared_access_key=parsed["SharedAccessKey"],
        )
    except KeyError as exc:
        raise RuntimeError("IOTHUB_SERVICE_CONNECTION_STRING is missing required parts") from exc


def _build_sas_token(*, host_name: str, policy_name: str, shared_access_key: str, ttl_seconds: int = 3600) -> str:
    resource_uri = host_name.lower()
    encoded_resource_uri = quote(resource_uri, safe="")
    expiry = int(time.time()) + ttl_seconds
    string_to_sign = f"{encoded_resource_uri}\n{expiry}"
    signature = base64.b64encode(
        hmac.new(
            base64.b64decode(shared_access_key),
            string_to_sign.encode("utf-8"),
            hashlib.sha256,
        ).digest()
    ).decode("utf-8")
    encoded_signature = quote(signature, safe="")
    return f"SharedAccessSignature sr={encoded_resource_uri}&sig={encoded_signature}&se={expiry}&skn={policy_name}"


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
        "Authorization": _build_sas_token(
            host_name=config.host_name,
            policy_name=config.policy_name,
            shared_access_key=config.shared_access_key,
        ),
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
