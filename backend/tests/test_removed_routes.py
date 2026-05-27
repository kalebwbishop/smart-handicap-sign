"""Tests that removed non-pilot backend routes stay unavailable."""

from __future__ import annotations

import pytest


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/api/v1/organizations"),
        ("get", "/api/v1/notifications"),
        ("post", "/api/v1/device-claims/validate"),
        ("get", "/api/v1/sites"),
        ("get", "/api/v1/parking-spaces"),
        ("get", "/api/v1/push-tokens"),
    ],
)
def test_non_pilot_routes_are_gone(client_anon, method, path):
    response = getattr(client_anon, method)(path)
    assert response.status_code == 404
