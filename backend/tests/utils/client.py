"""Wrapper sobre `Flask.test_client` que injeta JWT automaticamente.

Exemplo:
    api = ApiClient(client, user=admin_user)
    resp = api.get("/api/admin/profile")
    assert resp.status_code == 200
"""

from __future__ import annotations

from typing import Any

from flask.testing import FlaskClient

from app.models import User
from tests.utils.auth import auth_header


class ApiClient:
    def __init__(self, client: FlaskClient, *, user: User | None = None) -> None:
        self._client = client
        self._user = user

    # ------------------------------------------------------------------ utils

    @property
    def headers(self) -> dict[str, str]:
        return auth_header(self._user) if self._user is not None else {}

    def as_user(self, user: User | None) -> "ApiClient":
        """Devolve um novo ApiClient autenticado como outro usuário (não muda o original)."""
        return ApiClient(self._client, user=user)

    def _merge_headers(self, extra: dict[str, str] | None) -> dict[str, str]:
        merged = dict(self.headers)
        if extra:
            merged.update(extra)
        return merged

    # ------------------------------------------------------------------ HTTP

    def get(self, path: str, *, headers: dict[str, str] | None = None, **kwargs: Any):
        return self._client.get(path, headers=self._merge_headers(headers), **kwargs)

    def post(self, path: str, *, json: Any = None, headers: dict[str, str] | None = None, **kwargs: Any):
        return self._client.post(path, json=json, headers=self._merge_headers(headers), **kwargs)

    def put(self, path: str, *, json: Any = None, headers: dict[str, str] | None = None, **kwargs: Any):
        return self._client.put(path, json=json, headers=self._merge_headers(headers), **kwargs)

    def patch(self, path: str, *, json: Any = None, headers: dict[str, str] | None = None, **kwargs: Any):
        return self._client.patch(path, json=json, headers=self._merge_headers(headers), **kwargs)

    def delete(self, path: str, *, headers: dict[str, str] | None = None, **kwargs: Any):
        return self._client.delete(path, headers=self._merge_headers(headers), **kwargs)
