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
from app.models import Company, CreditPurchase, CreditTransaction, Plan, ServiceOrder, User
from app.models.base import utcnow


class AdminCrudTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "test.sqlite3"
        self.upload_dir = Path(self.temp_dir.name) / "uploads"
        self.app = create_app(
            {
                "TESTING": True,
                "SECRET_KEY": "admin-crud-secret-key",
                "AUTH_RATE_LIMIT": 1000,
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

            order = ServiceOrder(
                user_id=client.id,
                company_id=company.id,
                staff_user_id=staff.id,
                reference="ADM-TEST-001",
                status="pendente",
                total_amount=12000,
                split_plataforma=40,
                split_funcionario=60,
            )
            db.session.add(order)
            db.session.flush()
            self.order_id = order.id
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

    def test_admin_profile_crud_and_client_forbidden(self) -> None:
        profile_response = self.client.get("/api/admin/profile", headers=self.auth_headers())
        self.assertEqual(profile_response.status_code, 200)
        self.assertEqual(profile_response.get_json()["email"], "admin.crud@test.com")

        update_response = self.client.put(
            "/api/admin/profile",
            headers=self.auth_headers(),
            json={
                "full_name": "Admin CRUD Atualizado",
                "email": "admin.crud.updated@test.com",
                "oab_number": "SP 111222",
            },
        )
        self.assertEqual(update_response.status_code, 200)
        updated_payload = update_response.get_json()
        self.assertEqual(updated_payload["full_name"], "Admin CRUD Atualizado")
        self.assertEqual(updated_payload["email"], "admin.crud.updated@test.com")
        self.assertEqual(updated_payload["oab_number"], "SP 111222")

        detail_response = self.client.get("/api/admin/profile", headers=self.auth_headers())
        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(detail_response.get_json()["email"], "admin.crud.updated@test.com")

        client_login = self.client.post(
            "/api/auth/login",
            json={"email": "cliente.crud@test.com", "password": "Cl13nt!Pass#2026"},
        )
        self.assertEqual(client_login.status_code, 200)
        client_token = client_login.get_json()["token"]
        forbidden_response = self.client.get(
            "/api/admin/profile",
            headers={"Authorization": f"Bearer {client_token}"},
        )
        self.assertEqual(forbidden_response.status_code, 403)

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

        detail_response = self.client.get(f"/api/admin/orders/{order_id}", headers=self.auth_headers())
        self.assertEqual(detail_response.status_code, 200)

        update_response = self.client.patch(
            f"/api/admin/orders/{order_id}/status",
            headers=self.auth_headers(),
            json={"status": "concluido"},
        )
        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.get_json()["order"]["status"], "concluido")

        patch_response = self.client.patch(
            f"/api/admin/orders/{order_id}",
            headers=self.auth_headers(),
            json={"valor": 15500},
        )
        self.assertEqual(patch_response.status_code, 200)
        self.assertEqual(patch_response.get_json()["order"]["valor"], 15500)

        delete_response = self.client.delete(f"/api/admin/orders/{order_id}", headers=self.auth_headers())
        self.assertEqual(delete_response.status_code, 204)
        self.assertEqual(delete_response.data, b"")

    def test_admin_clients_staff_plans_financial_crud_smoke(self) -> None:
        for path in (
            "/api/admin/clients",
            "/api/admin/staff",
            "/api/admin/plans",
            "/api/admin/financial",
            "/api/admin/financial/transactions",
        ):
            with self.subTest(path=path):
                response = self.client.get(path, headers=self.auth_headers())
                self.assertEqual(response.status_code, 200)

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

        detail_client = self.client.get(f"/api/admin/clients/{client_id}", headers=self.auth_headers())
        self.assertEqual(detail_client.status_code, 200)

        update_client = self.client.patch(
            f"/api/admin/clients/{client_id}",
            headers=self.auth_headers(),
            json={"full_name": "Cliente Atualizado"},
        )
        self.assertEqual(update_client.status_code, 200)
        self.assertEqual(update_client.get_json()["client"]["nome"], "Cliente Atualizado")

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
        staff_id = create_staff.get_json()["staff_member"]["id"]

        detail_staff = self.client.get(f"/api/admin/staff/{staff_id}", headers=self.auth_headers())
        self.assertEqual(detail_staff.status_code, 200)

        update_staff = self.client.patch(
            f"/api/admin/staff/{staff_id}",
            headers=self.auth_headers(),
            json={"phone": "11888887777"},
        )
        self.assertEqual(update_staff.status_code, 200)

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

        detail_plan = self.client.get(f"/api/admin/plans/{plan_id}", headers=self.auth_headers())
        self.assertEqual(detail_plan.status_code, 200)

        update_plan = self.client.patch(
            f"/api/admin/plans/{plan_id}",
            headers=self.auth_headers(),
            json={"monthly_price_cents": 99500},
        )
        self.assertEqual(update_plan.status_code, 200)
        self.assertEqual(update_plan.get_json()["plan"]["monthly_price_cents"], 99500)

        create_service = self.client.post(
            "/api/admin/services",
            headers=self.auth_headers(),
            json={
                "code": "audiencia-admin-crud",
                "section": "Audiências",
                "title": "Preparação de audiência",
                "description": "Serviço avulso criado em teste.",
                "unit_price": 22000,
            },
        )
        self.assertEqual(create_service.status_code, 201)
        service_id = create_service.get_json()["service"]["id"]

        detail_service = self.client.get(f"/api/admin/services/{service_id}", headers=self.auth_headers())
        self.assertEqual(detail_service.status_code, 200)

        update_service = self.client.patch(
            f"/api/admin/services/{service_id}",
            headers=self.auth_headers(),
            json={"unit_price": 22500, "title": "Preparação de audiência atualizada"},
        )
        self.assertEqual(update_service.status_code, 200)
        self.assertEqual(update_service.get_json()["service"]["unit_price"], 22500)

        create_entry = self.client.post(
            "/api/admin/financial/entries",
            headers=self.auth_headers(),
            json={"description": "Ajuste mensal", "kind": "credit", "amount_cents": 5000},
        )
        self.assertEqual(create_entry.status_code, 201)
        entry_id = create_entry.get_json()["entry"]["id"]

        update_entry = self.client.patch(
            f"/api/admin/financial/entries/{entry_id}",
            headers=self.auth_headers(),
            json={"description": "Ajuste mensal atualizado"},
        )
        self.assertEqual(update_entry.status_code, 200)

        refund_response = self.client.post(
            "/api/admin/financial/refund",
            headers=self.auth_headers(),
            json={"order_id": self.order_id, "amount_cents": 1200, "reason": "Ajuste controlado"},
        )
        self.assertEqual(refund_response.status_code, 201)
        self.assertEqual(refund_response.get_json()["refund"]["kind"], "debit")

        delete_entry = self.client.delete(
            f"/api/admin/financial/entries/{entry_id}",
            headers=self.auth_headers(),
        )
        self.assertEqual(delete_entry.status_code, 200)

        delete_plan = self.client.delete(f"/api/admin/plans/{plan_id}", headers=self.auth_headers())
        self.assertEqual(delete_plan.status_code, 204)

        delete_service = self.client.delete(f"/api/admin/services/{service_id}", headers=self.auth_headers())
        self.assertEqual(delete_service.status_code, 204)

        delete_staff = self.client.delete(f"/api/admin/staff/{staff_id}", headers=self.auth_headers())
        self.assertEqual(delete_staff.status_code, 204)

        delete_client = self.client.delete(f"/api/admin/clients/{client_id}", headers=self.auth_headers())
        self.assertEqual(delete_client.status_code, 204)

    def test_admin_can_refund_credit_purchase_total(self) -> None:
        self.app.config.update(PAGARME_DRY_RUN=True, PAGARME_SECRET_KEY="sk_test_secret")
        with self.app.app_context():
            client = db.session.get(User, self.client_user_id)
            purchase = CreditPurchase(
                user_id=client.id,
                company_id=client.company_id,
                code="CRED-REFUND-001",
                idempotency_key="refund-idempotency-001",
                package_id="peticao_avulsa",
                package_name="Petição Avulsa",
                kind="single",
                source="avulso",
                amount_cents=16000,
                credit_cents=16000,
                status="paid",
                pagarme_order_id="dry_or_refund_001",
                pagarme_charge_id="dry_ch_refund_001",
                credited_at=utcnow(),
            )
            db.session.add(purchase)
            db.session.add(
                CreditTransaction(
                    user_id=client.id,
                    company_id=client.company_id,
                    type="in",
                    source="avulso",
                    amount=16000,
                    description="Compra Pagar.me - Petição Avulsa",
                )
            )
            db.session.flush()
            purchase_id = purchase.id
            db.session.commit()

        list_response = self.client.get("/api/admin/credit-purchases", headers=self.auth_headers())
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.get_json()["purchases"][0]["code"], "CRED-REFUND-001")

        refund_response = self.client.post(
            f"/api/admin/credit-purchases/{purchase_id}/refund",
            headers=self.auth_headers(),
        )
        self.assertEqual(refund_response.status_code, 200)
        refund_payload = refund_response.get_json()
        self.assertTrue(refund_payload["refunded"])
        self.assertTrue(refund_payload["credits_reversed"])
        self.assertEqual(refund_payload["gateway_status"], "canceled")

        with self.app.app_context():
            refunded_purchase = db.session.get(CreditPurchase, purchase_id)
            self.assertEqual(refunded_purchase.status, "refunded")
            transactions = CreditTransaction.query.filter_by(user_id=self.client_user_id).all()
            self.assertEqual(sum(item.amount for item in transactions if item.type == "in"), 16000)
            self.assertEqual(sum(item.amount for item in transactions if item.type == "out"), 16000)

        repeat_response = self.client.post(
            f"/api/admin/credit-purchases/{purchase_id}/refund",
            headers=self.auth_headers(),
        )
        self.assertEqual(repeat_response.status_code, 409)


if __name__ == "__main__":
    unittest.main()
