"""
Security tests for Pagar.me V5 checkout integration.

Tests verify PCI-DSS compliance:
- Backend rejects raw card data
- Backend requires card_token for credit card payments
- Webhook payloads are sanitized before logging
- Tokenization happens on frontend only
"""
from __future__ import annotations

import pytest
from app import create_app
from app.core.errors import ValidationError
from app.services.checkout_service import create_checkout_payment, _card, _sanitize_payload


def build_app():
    return create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "PAGARME_SECRET_KEY": "sk_test_123456",
            "PAGARME_PUBLIC_KEY": "pk_test_123456",
            "PAGARME_DRY_RUN": True,
            "SECRET_KEY": "test-secret",
        }
    )


class TestRawCardDataRejection:
    """Test that backend rejects raw card data - PCI-DSS compliance."""

    def test_card_function_rejects_raw_number(self):
        """Backend _card function should reject card number."""
        app = build_app()
        with app.app_context():
            billing_address = {
                "street": "Rua Teste",
                "street_number": "123",
                "neighborhood": "Centro",
                "city": "São Paulo",
                "state": "SP",
                "zip_code": "01234567",
                "country": "BR",
            }
            
            with pytest.raises(ValidationError) as exc:
                _card(
                    {"number": "5162920610041560", "installments": 1},
                    billing_address
                )
            assert "Dados de cartão brutos não são aceitos" in str(exc.value)

    def test_card_function_rejects_raw_cvv(self):
        """Backend _card function should reject CVV."""
        app = build_app()
        with app.app_context():
            billing_address = {
                "street": "Rua Teste",
                "street_number": "123",
                "neighborhood": "Centro",
                "city": "São Paulo",
                "state": "SP",
                "zip_code": "01234567",
                "country": "BR",
            }
            
            with pytest.raises(ValidationError) as exc:
                _card(
                    {"cvv": "123", "installments": 1},
                    billing_address
                )
            assert "Dados de cartão brutos não são aceitos" in str(exc.value)

    def test_card_function_rejects_raw_exp_month(self):
        """Backend _card function should reject expiration month."""
        app = build_app()
        with app.app_context():
            billing_address = {
                "street": "Rua Teste",
                "street_number": "123",
                "neighborhood": "Centro",
                "city": "São Paulo",
                "state": "SP",
                "zip_code": "01234567",
                "country": "BR",
            }
            
            with pytest.raises(ValidationError) as exc:
                _card(
                    {"exp_month": "12", "installments": 1},
                    billing_address
                )
            assert "Dados de cartão brutos não são aceitos" in str(exc.value)

    def test_card_function_rejects_raw_exp_year(self):
        """Backend _card function should reject expiration year."""
        app = build_app()
        with app.app_context():
            billing_address = {
                "street": "Rua Teste",
                "street_number": "123",
                "neighborhood": "Centro",
                "city": "São Paulo",
                "state": "SP",
                "zip_code": "01234567",
                "country": "BR",
            }
            
            with pytest.raises(ValidationError) as exc:
                _card(
                    {"exp_year": "2032", "installments": 1},
                    billing_address
                )
            assert "Dados de cartão brutos não são aceitos" in str(exc.value)

    def test_card_function_rejects_raw_holder_name(self):
        """Backend _card function should reject holder name."""
        app = build_app()
        with app.app_context():
            billing_address = {
                "street": "Rua Teste",
                "street_number": "123",
                "neighborhood": "Centro",
                "city": "São Paulo",
                "state": "SP",
                "zip_code": "01234567",
                "country": "BR",
            }
            
            with pytest.raises(ValidationError) as exc:
                _card(
                    {"holder_name": "JOHN DOE", "installments": 1},
                    billing_address
                )
            assert "Dados de cartão brutos não são aceitos" in str(exc.value)

    def test_card_function_requires_token(self):
        """Backend _card function should require card_token."""
        app = build_app()
        with app.app_context():
            billing_address = {
                "street": "Rua Teste",
                "street_number": "123",
                "neighborhood": "Centro",
                "city": "São Paulo",
                "state": "SP",
                "zip_code": "01234567",
                "country": "BR",
            }
            
            with pytest.raises(ValidationError) as exc:
                _card(
                    {"installments": 1},
                    billing_address
                )
            assert "Token do cartão obrigatório" in str(exc.value)

    def test_card_function_accepts_valid_token(self):
        """Backend _card function should accept valid card_token."""
        app = build_app()
        with app.app_context():
            billing_address = {
                "street": "Rua Teste",
                "street_number": "123",
                "neighborhood": "Centro",
                "city": "São Paulo",
                "state": "SP",
                "zip_code": "01234567",
                "country": "BR",
            }
            
            result = _card(
                {"card_token": "tok_test_123456", "installments": 1},
                billing_address
            )
            assert result["card_token"] == "tok_test_123456"
            assert result["installments"] == 1
            assert "card" in result
            assert "billing_address" in result["card"]

    def test_create_payment_rejects_raw_card_data_at_entry(self):
        """create_checkout_payment should reject raw card data at entry point."""
        app = build_app()
        with app.app_context():
            from app.models import User
            from app.core.extensions import db
            
            db.create_all()
            
            user = User(
                email="test@example.com",
                full_name="Test User",
                cpf="12345678901",
                password_hash="hashed",
            )
            db.session.add(user)
            db.session.commit()
            
            payload = {
                "order_id": 999,  # Non-existent order, but validation happens first
                "payment_method": "credit_card",
                "card": {
                    "number": "5162920610041560",
                    "cvv": "123",
                    "exp_month": "12",
                    "exp_year": "2032",
                    "holder_name": "JOHN DOE",
                    "installments": 1,
                },
            }
            
            with pytest.raises(ValidationError) as exc:
                create_checkout_payment(user, payload)
            assert "Dados de cartão brutos não são aceitos" in str(exc.value)


class TestPayloadSanitization:
    """Test that sensitive data is sanitized before logging."""

    def test_sanitize_payload_removes_card_number(self):
        """Sanitization should remove card number."""
        payload = {
            "card": {
                "number": "5162920610041560",
                "cvv": "123",
            }
        }
        sanitized = _sanitize_payload(payload)
        assert sanitized["card"]["number"] == "***REDACTED***"
        assert sanitized["card"]["cvv"] == "***REDACTED***"

    def test_sanitize_payload_removes_card_token(self):
        """Sanitization should remove card_token from payments."""
        payload = {
            "payments": [
                {
                    "payment_method": "credit_card",
                    "credit_card": {
                        "card_token": "tok_test_123456",
                        "installments": 1,
                    }
                }
            ]
        }
        sanitized = _sanitize_payload(payload)
        assert sanitized["payments"][0]["credit_card"]["card_token"] == "***REDACTED***"

    def test_sanitize_payload_removes_customer_document(self):
        """Sanitization should remove customer document."""
        payload = {
            "customer": {
                "name": "John Doe",
                "document": "12345678901",
            }
        }
        sanitized = _sanitize_payload(payload)
        assert sanitized["customer"]["document"] == "***REDACTED***"
        assert sanitized["customer"]["name"] == "John Doe"  # Name should remain

    def test_sanitize_payload_removes_phone_numbers(self):
        """Sanitization should remove phone numbers."""
        payload = {
            "customer": {
                "phones": {
                    "mobile_phone": {
                        "country_code": "55",
                        "area_code": "11",
                        "number": "912345678",
                    }
                }
            }
        }
        sanitized = _sanitize_payload(payload)
        assert sanitized["customer"]["phones"]["mobile_phone"]["number"] == "***REDACTED***"
        assert sanitized["customer"]["phones"]["mobile_phone"]["country_code"] == "55"

    def test_sanitize_payload_handles_nested_card_data(self):
        """Sanitization should handle nested card data in credit_card object."""
        payload = {
            "payments": [
                {
                    "payment_method": "credit_card",
                    "credit_card": {
                        "card": {
                            "number": "5162920610041560",
                            "cvv": "123",
                            "exp_month": 12,
                            "exp_year": 2032,
                            "holder_name": "JOHN DOE",
                        }
                    }
                }
            ]
        }
        sanitized = _sanitize_payload(payload)
        card = sanitized["payments"][0]["credit_card"]["card"]
        assert card["number"] == "***REDACTED***"
        assert card["cvv"] == "***REDACTED***"
        assert card["exp_month"] == "***REDACTED***"
        assert card["exp_year"] == "***REDACTED***"
        assert card["holder_name"] == "***REDACTED***"

    def test_sanitize_payload_preserves_non_sensitive_data(self):
        """Sanitization should preserve non-sensitive data."""
        payload = {
            "code": "order-123",
            "amount": 10000,
            "status": "pending",
        }
        sanitized = _sanitize_payload(payload)
        assert sanitized["code"] == "order-123"
        assert sanitized["amount"] == 10000
        assert sanitized["status"] == "pending"

    def test_sanitize_payload_handles_non_dict_input(self):
        """Sanitization should handle non-dict input gracefully."""
        assert _sanitize_payload("string") == "string"
        assert _sanitize_payload(123) == 123
        assert _sanitize_payload(None) is None
        assert _sanitize_payload(["list"]) == ["list"]


class TestTokenRequirement:
    """Test that card_token is required for credit card payments."""

    def test_card_function_accepts_token_field(self):
        """_card function should accept 'token' field."""
        app = build_app()
        with app.app_context():
            billing_address = {
                "street": "Rua Teste",
                "street_number": "123",
                "neighborhood": "Centro",
                "city": "São Paulo",
                "state": "SP",
                "zip_code": "01234567",
                "country": "BR",
            }
            
            result = _card(
                {"token": "tok_test_123456", "installments": 1},
                billing_address
            )
            assert result["card_token"] == "tok_test_123456"

    def test_card_function_accepts_card_token_field(self):
        """_card function should accept 'card_token' field."""
        app = build_app()
        with app.app_context():
            billing_address = {
                "street": "Rua Teste",
                "street_number": "123",
                "neighborhood": "Centro",
                "city": "São Paulo",
                "state": "SP",
                "zip_code": "01234567",
                "country": "BR",
            }
            
            result = _card(
                {"card_token": "tok_test_789012", "installments": 1},
                billing_address
            )
            assert result["card_token"] == "tok_test_789012"

    def test_card_function_validates_installments(self):
        """_card function should validate installments range."""
        app = build_app()
        with app.app_context():
            billing_address = {
                "street": "Rua Teste",
                "street_number": "123",
                "neighborhood": "Centro",
                "city": "São Paulo",
                "state": "SP",
                "zip_code": "01234567",
                "country": "BR",
            }
            
            with pytest.raises(ValidationError):
                _card(
                    {"card_token": "tok_test_123456", "installments": 0},
                    billing_address
                )
            
            with pytest.raises(ValidationError):
                _card(
                    {"card_token": "tok_test_123456", "installments": 13},
                    billing_address
                )
