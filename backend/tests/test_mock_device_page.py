from __future__ import annotations


def test_mock_device_page_serves_html(client_anon):
    response = client_anon.get("/mock-device")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert "Hazard Hero Device Mock" in response.text
    assert "/api/v1/inference/classify" in response.text
    assert "Operational status flow" in response.text
