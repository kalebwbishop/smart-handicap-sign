"""Tests for Nginx security headers and hardening.

These tests parse the ``nginx.conf`` file directly and verify that
required security directives are present — no running Nginx needed.
"""

from __future__ import annotations

import pathlib
import pytest


NGINX_CONF = pathlib.Path(__file__).resolve().parents[2] / "nginx" / "nginx.conf"


@pytest.fixture(scope="module")
def nginx_content() -> str:
    return NGINX_CONF.read_text(encoding="utf-8")


class TestNginxSecurityHeaders:
    def test_server_tokens_off(self, nginx_content):
        assert "server_tokens off" in nginx_content

    def test_hsts_header(self, nginx_content):
        assert "Strict-Transport-Security" in nginx_content
        assert "max-age=" in nginx_content

    def test_x_content_type_options(self, nginx_content):
        assert "X-Content-Type-Options" in nginx_content
        assert "nosniff" in nginx_content

    def test_x_frame_options(self, nginx_content):
        assert "X-Frame-Options" in nginx_content

    def test_referrer_policy(self, nginx_content):
        assert "Referrer-Policy" in nginx_content

    def test_client_max_body_size(self, nginx_content):
        assert "client_max_body_size" in nginx_content

    def test_ssl_prefer_server_ciphers(self, nginx_content):
        assert "ssl_prefer_server_ciphers" in nginx_content
