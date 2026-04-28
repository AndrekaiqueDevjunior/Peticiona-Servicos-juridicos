from __future__ import annotations

import datetime
import hashlib
import hmac
import io
import json
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
from app.models import Company, Order, PaymentEvent, Plan, User


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

    def test_pagarme_credit_purchase_credits_balance_once(self) -> None:
        self.app.config.update(
            PAGARME_DRY_RUN=True,
            PAGARME_PUBLIC_KEY="pk_test_public",
            PAGARME_SECRET_KEY="sk_test_secret",
        )
        self.assertEqual(self.register_user().status_code, 201)
        token = self.login_user().get_json()["token"]
        headers = self.auth_headers(token)

        config_response = self.client.get("/api/payments/credit-packages", headers=headers)
        self.assertEqual(config_response.status_code, 200)
        self.assertTrue(config_response.get_json()["dry_run"])

        payload = {
            "package_id": "peticao_avulsa",
            "idempotency_key": "test-idempotency-001",
            "card_token": "tok_test_card_123",
            "customer": {
                "document": "12345678909",
                "phone": "(11) 91234-5678",
            },
            "billing_address": {
                "zip_code": "01001000",
                "street": "Praca da Se",
                "number": "100",
                "neighborhood": "Se",
                "city": "Sao Paulo",
                "state": "SP",
            },
            "antifraud": {
                "session_id": "session-test-123",
                "device": {"platform": "test"},
            },
        }

        purchase_response = self.client.post(
            "/api/payments/credit-orders",
            headers=headers,
            json=payload,
        )
        self.assertEqual(purchase_response.status_code, 201)
        self.assertTrue(purchase_response.get_json()["purchase"]["paid"])

        duplicate_response = self.client.post(
            "/api/payments/credit-orders",
            headers=headers,
            json=payload,
        )
        self.assertEqual(duplicate_response.status_code, 201)

        balance_response = self.client.get("/api/me/balance", headers=headers)
        self.assertEqual(balance_response.status_code, 200)
        self.assertEqual(balance_response.get_json()["credits_available"], 18000)

    def test_admin_can_create_dry_run_smoke_charges(self) -> None:
        self.app.config.update(
            PAGARME_DRY_RUN=True,
            PAGARME_PUBLIC_KEY="pk_test_public",
            PAGARME_SECRET_KEY="sk_test_secret",
        )
        self.assertEqual(self.register_user(email="admin@example.com").status_code, 201)
        with self.app.app_context():
            user = User.query.filter_by(email="admin@example.com").first()
            user.role = "admin"
            db.session.commit()

        token = self.login_user(email="admin@example.com").get_json()["token"]
        headers = self.auth_headers(token)

        pix_response = self.client.post(
            "/api/payments/smoke-charge",
            headers=headers,
            json={
                "method": "pix",
                "customer": {
                    "document": "12345678909",
                    "phone": "(11) 91234-5678",
                },
            },
        )
        self.assertEqual(pix_response.status_code, 201)
        pix_payload = pix_response.get_json()
        self.assertEqual(pix_payload["status"], "pending")
        self.assertTrue(pix_payload["charges"][0]["last_transaction"]["qr_code"])

        card_response = self.client.post(
            "/api/payments/smoke-charge",
            headers=headers,
            json={
                "method": "credit_card",
                "card_token": "tok_test_card_123",
                "customer": {
                    "document": "12345678909",
                    "phone": "(11) 91234-5678",
                },
                "billing_address": {
                    "zip_code": "01001000",
                    "street": "Praca da Se",
                    "number": "100",
                    "neighborhood": "Se",
                    "city": "Sao Paulo",
                    "state": "SP",
                },
            },
        )
        self.assertEqual(card_response.status_code, 201)
        card_payload = card_response.get_json()
        self.assertEqual(card_payload["status"], "paid")
        self.assertEqual(card_payload["charges"][0]["last_transaction"]["status"], "captured")

    def test_checkout_payment_webhook_is_idempotent(self) -> None:
        self.app.config.update(
            PAGARME_DRY_RUN=True,
            PAGARME_PUBLIC_KEY="pk_test_public",
            PAGARME_SECRET_KEY="sk_test_secret",
        )
        self.assertEqual(self.register_user().status_code, 201)
        token = self.login_user().get_json()["token"]
        headers = self.auth_headers(token)
        service = self.client.get("/api/client-area").get_json()["catalog"][0]["items"][0]

        order_response = self.client.post(
            "/api/checkout/create-order",
            headers=headers,
            json={
                "service_id": service["code"],
                "amount": 1,
                "idempotency_key": "checkout-order-001",
            },
        )
        self.assertEqual(order_response.status_code, 201)
        order_payload = order_response.get_json()["order"]
        self.assertEqual(order_payload["status"], "pending")
        self.assertEqual(order_payload["amount"], service["unit_price"])

        duplicate_order_response = self.client.post(
            "/api/checkout/create-order",
            headers=headers,
            json={
                "service_id": service["code"],
                "idempotency_key": "checkout-order-001",
            },
        )
        self.assertEqual(duplicate_order_response.status_code, 200)
        self.assertEqual(duplicate_order_response.get_json()["order"]["id"], order_payload["id"])

        payment_payload = {
            "order_id": order_payload["id"],
            "idempotency_key": "checkout-payment-001",
            "card_token": "tok_test_card_123",
            "customer": {
                "document": "12345678909",
                "phone": "(11) 91234-5678",
            },
            "billing_address": {
                "zip_code": "01001000",
                "street": "Praca da Se",
                "number": "100",
                "neighborhood": "Se",
                "city": "Sao Paulo",
                "state": "SP",
            },
            "antifraud": {
                "session_id": "session-checkout-123",
                "device": {"platform": "test"},
            },
        }
        payment_response = self.client.post(
            "/api/checkout/create-payment",
            headers=headers,
            json=payment_payload,
        )
        self.assertEqual(payment_response.status_code, 201)
        paid_order = payment_response.get_json()["order"]
        self.assertTrue(paid_order["paid"])
        self.assertTrue(paid_order["released"])

        repeat_payment_response = self.client.post(
            "/api/checkout/create-payment",
            headers=headers,
            json=payment_payload,
        )
        self.assertEqual(repeat_payment_response.status_code, 200)

        webhook_payload = {
            "id": "evt_checkout_paid_001",
            "type": "order.paid",
            "data": {
                "id": paid_order["pagarme_order_id"],
                "status": "paid",
                "charges": [{"id": paid_order["pagarme_charge_id"], "status": "paid"}],
                "metadata": {"checkout_order_id": str(paid_order["id"])},
            },
        }
        raw_webhook = json.dumps(webhook_payload, separators=(",", ":")).encode("utf-8")
        signature = hmac.new(
            self.app.config["PAGARME_SECRET_KEY"].encode("utf-8"),
            raw_webhook,
            hashlib.sha1,
        ).hexdigest()

        webhook_response = self.client.post(
            "/api/webhooks/pagarme",
            data=raw_webhook,
            content_type="application/json",
            headers={"X-Hub-Signature": signature},
        )
        self.assertEqual(webhook_response.status_code, 200)
        self.assertFalse(webhook_response.get_json()["duplicate"])

        duplicate_webhook_response = self.client.post(
            "/api/webhooks/pagarme",
            data=raw_webhook,
            content_type="application/json",
            headers={"X-Hub-Signature": signature},
        )
        self.assertEqual(duplicate_webhook_response.status_code, 200)
        self.assertTrue(duplicate_webhook_response.get_json()["duplicate"])

        invalid_webhook_response = self.client.post(
            "/api/webhooks/pagarme",
            data=raw_webhook,
            content_type="application/json",
            headers={"X-Hub-Signature": "invalid"},
        )
        self.assertEqual(invalid_webhook_response.status_code, 401)

        balance_response = self.client.get("/api/me/balance", headers=headers)
        self.assertEqual(balance_response.status_code, 200)
        self.assertEqual(balance_response.get_json()["credits_available"], service["unit_price"])

        with self.app.app_context():
            order = db.session.get(Order, paid_order["id"])
            self.assertEqual(order.status, "paid")
            self.assertIsNotNone(order.paid_at)
            self.assertIsNotNone(order.released_at)
            self.assertEqual(PaymentEvent.query.count(), 1)

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

    def test_admin_endpoints_smoke(self) -> None:
        with self.app.app_context():
            company = Company.query.filter_by(slug="smoke-admin-company").first()
            if company is None:
                company = Company(name="Smoke Admin Company", slug="smoke-admin-company")
                db.session.add(company)
                db.session.flush()

            plan = Plan.query.filter_by(code="starter").first()
            admin = User.query.filter_by(email="admin-smoke@example.com").first()
            if admin is None:
                admin = User(
                    full_name="Admin Smoke",
                    email="admin-smoke@example.com",
                    password_hash=generate_password_hash("Sm0ke!Pass#2026"),
                    role="admin",
                    company_id=company.id,
                    active_plan_id=plan.id if plan else None,
                )
                db.session.add(admin)

            client = User.query.filter_by(email="client-smoke@example.com").first()
            if client is None:
                client = User(
                    full_name="Client Smoke",
                    email="client-smoke@example.com",
                    password_hash=generate_password_hash("Sm0ke!Pass#2026"),
                    role="client",
                    company_id=company.id,
                    active_plan_id=plan.id if plan else None,
                )
                db.session.add(client)

            staff = User.query.filter_by(email="staff-smoke@example.com").first()
            if staff is None:
                staff = User(
                    full_name="Staff Smoke",
                    email="staff-smoke@example.com",
                    password_hash=generate_password_hash("Sm0ke!Pass#2026"),
                    role="staff",
                    company_id=company.id,
                    active_plan_id=plan.id if plan else None,
                )
                db.session.add(staff)

            db.session.commit()

        login_response = self.client.post(
            "/api/auth/login",
            json={"email": "admin-smoke@example.com", "password": "Sm0ke!Pass#2026"},
        )
        self.assertEqual(login_response.status_code, 200)
        headers = self.auth_headers(login_response.get_json()["token"])

        for path in (
            "/api/admin/profile",
            "/api/admin/orders",
            "/api/admin/clients",
            "/api/admin/staff",
            "/api/admin/plans",
            "/api/admin/financial",
            "/api/admin/financial/transactions",
            "/api/admin/financial/entries",
        ):
            with self.subTest(path=path):
                response = self.client.get(path, headers=headers)
                self.assertEqual(response.status_code, 200)


if __name__ == "__main__":
    unittest.main()
