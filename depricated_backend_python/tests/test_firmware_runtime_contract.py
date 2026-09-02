from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Any

import pytest


FIRMWARE_HEADERS = {
    "X-Firmware-Version": "1.2.3",
    "X-Firmware-Config-Version": "2026.05.12",
}


class FakeRecord(dict):
    """Small asyncpg.Record stand-in for route/service contract tests."""

    def __getattr__(self, name: str) -> Any:
        try:
            return self[name]
        except KeyError as exc:
            raise AttributeError(name) from exc


@dataclass
class FakeConnection:
    rows: list[FakeRecord] = field(default_factory=list)
    executed: list[tuple[str, tuple[Any, ...]]] = field(default_factory=list)

    async def fetchrow(self, query: str, *args: Any) -> FakeRecord | None:
        self.executed.append((query, args))
        return self.rows.pop(0) if self.rows else None

    async def fetch(self, query: str, *args: Any) -> list[FakeRecord]:
        self.executed.append((query, args))
        rows = self.rows
        self.rows = []
        return rows

    async def execute(self, query: str, *args: Any) -> str:
        self.executed.append((query, args))
        return "UPDATE 1"


@dataclass
class FakePool:
    rows: Iterable[dict[str, Any]] = field(default_factory=list)
    connection: FakeConnection = field(init=False)

    def __post_init__(self) -> None:
        self.connection = FakeConnection([FakeRecord(row) for row in self.rows])

    def acquire(self) -> "FakePool":
        return self

    async def __aenter__(self) -> FakeConnection:
        return self.connection

    async def __aexit__(self, exc_type: object, exc: object, tb: object) -> None:
        return None


def bearer_for(serial_number: str = "SHS-2605-S01-A7K-00003-W", token: str = "fake-device-token") -> str:
    return f"Bearer {serial_number}:{token}"


def firmware_headers(**overrides: str) -> dict[str, str]:
    return {**FIRMWARE_HEADERS, **overrides}


@pytest.fixture
def authenticated_device() -> dict[str, str]:
    return {
        "serial_number": "SHS-2605-S01-A7K-00003-W",
        "device_id": "f0000000-0000-0000-0000-000000000003",
    }
