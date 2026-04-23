from __future__ import annotations

import io
import sys
import tempfile
import unittest
from pathlib import Path

from werkzeug.security import generate_password_hash

ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import create_app
from app.core.extensions import db
from app.models import AuditLog, Company, Petition, Plan, User


PNG_BYTES = b"\x89PNG\r\n\x1a\narchitecture-test"


class BackendArchitectureTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "test.sqlite3"
        self.upload_dir = Path(self.temp_dir.name) / "uploads"
        self.app = create_app(
            {
                "TESTING": True,
                "SECRET_KEY": "architecture-secret-key",
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

    def login_user(self, email: str, password: str) -> str:
        response = self.client.post(
            "/api/auth/login",
            json={"email": email, "password": password},
        )
        self.assertEqual(response.status_code, 200)
        return response.get_json()["token"]

    @staticmethod
    def auth_headers(token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {token}"}

    def test_error_payload_is_standardized(self) -> None:
        response = self.client.get("/api/me")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(
            response.get_json(),
            {
                "error": "AUTH_REQUIRED",
                "message": "Token de autenticação ausente.",
            },
        )

    def test_staff_scope_is_limited_to_its_company(self) -> None:
        with self.app.app_context():
            starter = Plan.query.filter_by(code="starter").first()
            company_a = Company(name="Empresa A", slug="empresa-a")
            company_b = Company(name="Empresa B", slug="empresa-b")
            db.session.add_all([company_a, company_b])
            db.session.flush()

            staff = User(
                full_name="Equipe Interna",
                email="staff@empresa-a.test",
                password_hash=generate_password_hash("Sm0ke!Pass#2026"),
                role="staff",
                company_id=company_a.id,
                active_plan_id=starter.id,
            )
            client_a = User(
                full_name="Cliente A",
                email="cliente-a@test.com",
                password_hash=generate_password_hash("Sm0ke!Pass#2026"),
                role="client",
                company_id=company_a.id,
                active_plan_id=starter.id,
            )
            client_b = User(
                full_name="Cliente B",
                email="cliente-b@test.com",
                password_hash=generate_password_hash("Sm0ke!Pass#2026"),
                role="client",
                company_id=company_b.id,
                active_plan_id=starter.id,
            )
            db.session.add_all([staff, client_a, client_b])
            db.session.flush()

            db.session.add_all(
                [
                    Petition(
                        user_id=client_a.id,
                        company_id=company_a.id,
                        reference="PET-000001",
                        area_direito="Cível",
                        tipo_peticao="Inicial",
                        advogado_subscritor="Cliente A",
                        resumo_caso="Caso A",
                        detalhes="Detalhes A",
                    ),
                    Petition(
                        user_id=client_b.id,
                        company_id=company_b.id,
                        reference="PET-000002",
                        area_direito="Trabalhista",
                        tipo_peticao="Contestação",
                        advogado_subscritor="Cliente B",
                        resumo_caso="Caso B",
                        detalhes="Detalhes B",
                    ),
                ]
            )
            db.session.commit()

        token = self.login_user("staff@empresa-a.test", "Sm0ke!Pass#2026")
        response = self.client.get("/api/petitions", headers=self.auth_headers(token))

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(len(payload["petitions"]), 1)
        self.assertEqual(payload["petitions"][0]["reference"], "PET-000001")

    def test_plan_limit_and_audit_log_are_enforced(self) -> None:
        register_response = self.client.post(
            "/api/auth/register",
            json={
                "full_name": "Plano Limitado",
                "email": "limitado@example.com",
                "oab_number": "SP1000",
                "password": "Sm0ke!Pass#2026",
                "confirm_password": "Sm0ke!Pass#2026",
            },
        )
        self.assertEqual(register_response.status_code, 201)
        token = self.login_user("limitado@example.com", "Sm0ke!Pass#2026")

        with self.app.app_context():
            user = User.query.filter_by(email="limitado@example.com").first()
            user.active_plan.petition_limit_monthly = 1
            db.session.commit()

        upload_response = self.client.post(
            "/api/client-area/documents",
            headers=self.auth_headers(token),
            data={"documents": (io.BytesIO(PNG_BYTES), "prova.png")},
            content_type="multipart/form-data",
        )
        self.assertEqual(upload_response.status_code, 201)
        document_id = upload_response.get_json()["documents"][0]["id"]

        petition_payload = {
            "area_direito": "Cível",
            "tipo_peticao": "Petição inicial",
            "numero_processo": "5001234-56.2026.8.26.0100",
            "data_publicacao": "2026-04-23",
            "justica_gratuita": False,
            "tutela_urgencia": False,
            "advogado_subscritor": "Plano Limitado",
            "resumo_caso": "Primeira petição do ciclo.",
            "detalhes": "Detalhes suficientes para criar a petição.",
            "partes": [{"nome": "Autor", "tipo": "autor"}],
            "document_ids": [document_id],
        }

        first_response = self.client.post(
            "/api/petitions",
            headers=self.auth_headers(token),
            json=petition_payload,
        )
        self.assertEqual(first_response.status_code, 201)

        second_response = self.client.post(
            "/api/petitions",
            headers=self.auth_headers(token),
            json=petition_payload,
        )
        self.assertEqual(second_response.status_code, 422)
        self.assertEqual(second_response.get_json()["error"], "PLAN_LIMIT_EXCEEDED")

        with self.app.app_context():
            user = User.query.filter_by(email="limitado@example.com").first()
            petition_logs = AuditLog.query.filter_by(
                user_id=user.id,
                action="petition.created",
            ).all()
            self.assertEqual(len(petition_logs), 1)


if __name__ == "__main__":
    unittest.main()
