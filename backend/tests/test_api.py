from __future__ import annotations

import datetime
import io
import sys
import tempfile
import unittest
from pathlib import Path

import jwt
from werkzeug.security import generate_password_hash

ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import create_app
from app.core.extensions import db
from app.models import User


PNG_BYTES = b"\x89PNG\r\n\x1a\nsmoke-test"


class BackendApiTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "test.sqlite3"
        self.upload_dir = Path(self.temp_dir.name) / "uploads"
        self.app = create_app(
            {
                "TESTING": True,
                "SECRET_KEY": "test-secret-key",
                "SQLALCHEMY_DATABASE_URI": f"sqlite:///{self.db_path}",
                "UPLOAD_FOLDER": self.upload_dir,
            }
        )
        self.client = self.app.test_client()

    def tearDown(self) -> None:
        with self.app.app_context():
            db.session.remove()
            db.drop_all()
        self.temp_dir.cleanup()

    def register_user(
        self,
        *,
        full_name: str = "Smoke Test User",
        email: str = "smoke@example.com",
        password: str = "Sm0ke!Pass#2026",
        oab_number: str = "SP123456",
    ):
        return self.client.post(
            "/api/auth/register",
            json={
                "full_name": full_name,
                "email": email,
                "oab_number": oab_number,
                "password": password,
                "confirm_password": password,
            },
        )

    def login_user(
        self,
        *,
        email: str = "smoke@example.com",
        password: str = "Sm0ke!Pass#2026",
    ):
        return self.client.post(
            "/api/auth/login",
            json={"email": email, "password": password},
        )

    @staticmethod
    def auth_headers(token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {token}"}

    def test_public_endpoints_smoke(self) -> None:
        for path in (
            "/api/health",
            "/api/home",
            "/api/plans",
            "/api/client-area",
            "/api/dashboard",
            "/api/dashboard?status=pendente",
            "/api/split-payment",
        ):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)

    def test_split_preview_and_order_creation(self) -> None:
        split_seed = self.client.get("/api/split-payment").get_json()
        split_preview = self.client.post(
            "/api/split-payment/preview",
            json={
                "quote_token": split_seed["quote_token"],
                "mode": "equal",
                "parties": [],
            },
        )
        self.assertEqual(split_preview.status_code, 200)
        self.assertTrue(split_preview.get_json()["is_valid"])

        client_area = self.client.get("/api/client-area").get_json()
        service_code = client_area["catalog"][0]["items"][0]["code"]

        cart_preview = self.client.post(
            "/api/client-area/cart/preview",
            json={"items": [{"code": service_code, "quantity": 1}]},
        )
        self.assertEqual(cart_preview.status_code, 200)

        order_response = self.client.post(
            "/api/client-area/orders",
            json={"items": [{"code": service_code, "quantity": 1}]},
        )
        self.assertEqual(order_response.status_code, 201)
        self.assertEqual(order_response.get_json()["order"]["status"], "pendente")

    def test_login_token_grants_access_to_protected_endpoints(self) -> None:
        register_response = self.register_user()
        self.assertEqual(register_response.status_code, 201)

        login_response = self.login_user()
        self.assertEqual(login_response.status_code, 200)
        token = login_response.get_json()["token"]

        me_response = self.client.get("/api/me", headers=self.auth_headers(token))
        self.assertEqual(me_response.status_code, 200)
        self.assertEqual(me_response.get_json()["email"], "smoke@example.com")

        update_response = self.client.put(
            "/api/me",
            headers=self.auth_headers(token),
            json={"full_name": "Smoke Test Updated", "oab_number": "SP654321"},
        )
        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.get_json()["full_name"], "Smoke Test Updated")

        balance_response = self.client.get("/api/me/balance", headers=self.auth_headers(token))
        self.assertEqual(balance_response.status_code, 200)
        self.assertEqual(balance_response.get_json()["credits_available"], 0)

        petitions_response = self.client.get("/api/petitions", headers=self.auth_headers(token))
        self.assertEqual(petitions_response.status_code, 200)
        self.assertEqual(petitions_response.get_json()["petitions"], [])

    def test_legacy_numeric_subject_tokens_remain_compatible(self) -> None:
        with self.app.app_context():
            user = User(
                full_name="Legacy User",
                email="legacy@example.com",
                oab_number=None,
                password_hash=generate_password_hash("Sm0ke!Pass#2026"),
            )
            db.session.add(user)
            db.session.commit()
            user_id = user.id

        now = datetime.datetime.now(datetime.timezone.utc)
        legacy_token = jwt.encode(
            {
                "sub": user_id,
                "iat": now,
                "exp": now + datetime.timedelta(hours=1),
            },
            self.app.config["SECRET_KEY"],
            algorithm="HS256",
        )

        response = self.client.get("/api/me", headers=self.auth_headers(legacy_token))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["email"], "legacy@example.com")

    def test_document_upload_and_petition_flow(self) -> None:
        self.assertEqual(self.register_user().status_code, 201)
        token = self.login_user().get_json()["token"]
        headers = self.auth_headers(token)

        upload_response = self.client.post(
            "/api/client-area/documents",
            headers=headers,
            data={"documents": (io.BytesIO(PNG_BYTES), "proof.png")},
            content_type="multipart/form-data",
        )
        self.assertEqual(upload_response.status_code, 201)
        upload_payload = upload_response.get_json()
        self.assertEqual(upload_payload["message"], "Upload concluído com segurança.")
        document_id = upload_payload["documents"][0]["id"]
        self.assertTrue(any(self.upload_dir.iterdir()))

        petition_response = self.client.post(
            "/api/petitions",
            headers=headers,
            json={
                "area_direito": "Cível",
                "tipo_peticao": "Petição inicial",
                "numero_processo": "5001234-56.2026.8.26.0100",
                "data_publicacao": "23/04/2026",
                "justica_gratuita": False,
                "tutela_urgencia": False,
                "advogado_subscritor": "Smoke Test User",
                "resumo_caso": "Teste automatizado.",
                "detalhes": "Fluxo autenticado validado com upload.",
                "partes": [
                    {"nome": "Autor Smoke", "tipo": "autor"},
                    {"nome": "Réu Smoke", "tipo": "reu"},
                ],
                "document_ids": [document_id],
            },
        )
        self.assertEqual(petition_response.status_code, 201)
        self.assertEqual(petition_response.get_json()["petition"]["status"], "pendente")

        petitions_response = self.client.get("/api/petitions", headers=headers)
        self.assertEqual(petitions_response.status_code, 200)
        self.assertEqual(len(petitions_response.get_json()["petitions"]), 1)


if __name__ == "__main__":
    unittest.main()
