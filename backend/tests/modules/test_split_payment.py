"""Cobertura de /api/split-payment (seed + preview de rateio)."""

from __future__ import annotations

import pytest


pytestmark = pytest.mark.integration


class TestSplitPaymentSeed:
    def test_seed_returns_quote_token_and_modes(self, client):
        """Rota pública usada como primeiro passo do rateio."""
        response = client.get("/api/split-payment")
        assert response.status_code == 200
        body = response.get_json()
        assert body["quote_token"]
        assert body["currency"] == "BRL"
        assert set(body["modes"]) == {"equal", "manual"}

    def test_seed_returns_unique_tokens(self, client):
        a = client.get("/api/split-payment").get_json()["quote_token"]
        b = client.get("/api/split-payment").get_json()["quote_token"]
        assert a != b, "quote_token deve ser único por chamada"


class TestSplitPaymentPreview:
    def test_equal_mode_divides_share_evenly(self, client):
        seed = client.get("/api/split-payment").get_json()
        response = client.post(
            "/api/split-payment/preview",
            json={
                "quote_token": seed["quote_token"],
                "mode": "equal",
                "parties": [
                    {"name": "A"},
                    {"name": "B"},
                    {"name": "C"},
                    {"name": "D"},
                ],
            },
        )
        assert response.status_code == 200
        body = response.get_json()
        assert body["is_valid"] is True
        percentages = [p["percentage"] for p in body["parties"]]
        # Cada parte fica com 25.0 (100/4)
        assert all(round(p, 2) == 25.0 for p in percentages)

    def test_manual_mode_with_valid_total(self, client):
        seed = client.get("/api/split-payment").get_json()
        response = client.post(
            "/api/split-payment/preview",
            json={
                "quote_token": seed["quote_token"],
                "mode": "manual",
                "parties": [
                    {"name": "Cliente", "percentage": 70},
                    {"name": "Sócio", "percentage": 30},
                ],
            },
        )
        assert response.status_code == 200
        assert response.get_json()["is_valid"] is True

    def test_manual_mode_must_total_100_percent(self, client):
        seed = client.get("/api/split-payment").get_json()
        response = client.post(
            "/api/split-payment/preview",
            json={
                "quote_token": seed["quote_token"],
                "mode": "manual",
                "parties": [
                    {"name": "X", "percentage": 60},
                    {"name": "Y", "percentage": 30},
                ],
            },
        )
        assert response.status_code == 400
        assert "100" in response.get_json()["message"]

    def test_unknown_mode_is_400(self, client):
        seed = client.get("/api/split-payment").get_json()
        response = client.post(
            "/api/split-payment/preview",
            json={"quote_token": seed["quote_token"], "mode": "bizarro"},
        )
        assert response.status_code == 400

    def test_missing_quote_token_is_400(self, client):
        response = client.post(
            "/api/split-payment/preview",
            json={"mode": "equal", "parties": [{"name": "X"}]},
        )
        assert response.status_code == 400

    def test_non_dict_body_is_400(self, client):
        response = client.post("/api/split-payment/preview", json=[1, 2, 3])
        assert response.status_code == 400
