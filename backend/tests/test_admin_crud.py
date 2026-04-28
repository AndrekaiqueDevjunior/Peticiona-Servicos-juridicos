from __future__ import annotations

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
from app.models import Company, Plan, ServiceOrder, User


class AdminCrudTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "test.sqlite3"
        self.upload_dir = Path(self.temp_dir.name) / "uploads"
        self.app = create_app(
            {
                "TESTING": True,
                "SECRET_KEY": "admin-crud-secret-key",
                "SQLALCHEMY_DATABASE_URI": f"sqlite:///{self.db_path}",
                "UPLOAD_FOLDER": self.upload_dir,
            }
        )
        self.client = self.app.test_client()

        with self.app.app_context():
            company = Company(name="Empresa CRUD", slug="empresa-crud")
            db.session.add(company)
            db.session.flush()

            plan = Plan.query.filter_by(code="starter").first()
            admin = User(
                full_name="Admin CRUD",
                email="admin.crud@test.com",
                password_hash=generate_password_hash("Adm1n!Pass#2026"),
                role="admin",
                company_id=company.id,
                active_plan_id=plan.id if plan else None,
            )
            db.session.add(admin)

            client = User(
                full_name="Cliente CRUD",
                email="cliente.crud@test.com",
                password_hash=generate_password_hash("Cl13nt!Pass#2026"),
                role="client",
                company_id=company.id,
                active_plan_id=plan.id if plan else None,
            )
            staff = User(
                full_name="Staff CRUD",
                email="staff.crud@test.com",
                password_hash=generate_password_hash("St4ff!Pass#2026"),
                role="staff",
                company_id=company.id,
                active_plan_id=plan.id if plan else None,
            )
            db.session.add_all([client, staff])
            db.session.flush()

            self.client_user_id = client.id
            self.staff_user_id = staff.id

            db.session.add(
                ServiceOrder(
                    user_id=client.id,
                    company_id=company.id,
                    staff_user_id=staff.id,
                    reference="ADM-TEST-001",
                    status="pendente",
                    total_amount=12000,
                    split_plataforma=40,
                    split_funcionario=60,
                )
            )
            db.session.commit()

        login = self.client.post(
            "/api/auth/login",
            json={"email": "admin.crud@test.com", "password": "Adm1n!Pass#2026"},
        )
        self.assertEqual(login.status_code, 200)
        self.token = login.get_json()["token"]

    def tearDown(self) -> None:
        with self.app.app_context():
            db.session.remove()
            db.drop_all()
        self.temp_dir.cleanup()

    def auth_headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"}

    def test_admin_orders_crud(self) -> None:
        response = self.client.get("/api/admin/orders", headers=self.auth_headers())
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.get_json()["orders"]), 1)

        create_response = self.client.post(
            "/api/admin/orders",
            headers=self.auth_headers(),
            json={
                "user_id": self.client_user_id,
                "staff_user_id": self.staff_user_id,
                "tipo_servico": "Petição inicial",
                "valor": 15000,
                "status": "pendente",
                "split_plataforma": 40,
                "split_funcionario": 60,
            },
        )
        self.assertEqual(create_response.status_code, 201)
        order_id = create_response.get_json()["order"]["id"]

        update_response = self.client.put(
            f"/api/admin/orders/{order_id}",
            headers=self.auth_headers(),
            json={"status": "concluido", "valor": 15500},
        )
        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.get_json()["order"]["status"], "concluido")

        delete_response = self.client.delete(f"/api/admin/orders/{order_id}", headers=self.auth_headers())
        self.assertEqual(delete_response.status_code, 200)
        self.assertTrue(delete_response.get_json()["deleted"])

    def test_admin_clients_staff_plans_financial_crud_smoke(self) -> None:
        create_client = self.client.post(
            "/api/admin/clients",
            headers=self.auth_headers(),
            json={
                "full_name": "Novo Cliente",
                "email": "novo.cliente@test.com",
                "password": "NovoCli3nt!2026",
                "phone": "11999999999",
            },
        )
        self.assertEqual(create_client.status_code, 201)
        client_id = create_client.get_json()["client"]["id"]

        update_client = self.client.put(
            f"/api/admin/clients/{client_id}",
            headers=self.auth_headers(),
            json={"full_name": "Cliente Atualizado", "email": "novo.cliente@test.com", "is_active": True},
        )
        self.assertEqual(update_client.status_code, 200)

        create_staff = self.client.post(
            "/api/admin/staff",
            headers=self.auth_headers(),
            json={
                "full_name": "Novo Staff",
                "email": "novo.staff@test.com",
                "password": "NovoSt4ff!2026",
            },
        )
        self.assertEqual(create_staff.status_code, 201)

        create_plan = self.client.post(
            "/api/admin/plans",
            headers=self.auth_headers(),
            json={
                "code": "enterprise",
                "name": "Enterprise",
                "monthly_price_cents": 99000,
                "monthly_credits_cents": 250000,
            },
        )
        self.assertEqual(create_plan.status_code, 201)
        plan_id = create_plan.get_json()["plan"]["id"]

        create_entry = self.client.post(
            "/api/admin/financial/entries",
            headers=self.auth_headers(),
            json={"description": "Ajuste mensal", "kind": "credit", "amount_cents": 5000},
        )
        self.assertEqual(create_entry.status_code, 201)
        entry_id = create_entry.get_json()["entry"]["id"]

        delete_entry = self.client.delete(
            f"/api/admin/financial/entries/{entry_id}",
            headers=self.auth_headers(),
        )
        self.assertEqual(delete_entry.status_code, 200)

        delete_plan = self.client.delete(f"/api/admin/plans/{plan_id}", headers=self.auth_headers())
        self.assertEqual(delete_plan.status_code, 200)


if __name__ == "__main__":
    unittest.main()
