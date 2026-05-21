"""Testes dos 4 fixes de segurança do hardening:

1. Política de senha unificada (forte tanto em /register quanto em /reset)
2. Lockout do login após N tentativas falhas
3. JWT_SECRET pode ser distinto de FLASK_SECRET_KEY
4. Reset de senha destrava conta bloqueada (bypass legítimo)
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

import app.services.password_reset_service as password_reset_service
from app.models import User
from tests.factories import create_client
from tests.utils.mocks import capture_emails


# ---------------------------------------------------------------------------
# 1. Política de senha unificada
# ---------------------------------------------------------------------------


class TestPasswordPolicy:
    STRONG = "Senha_Forte_123!"  # passa em todas as regras

    @pytest.fixture
    def base_payload(self):
        return {
            "full_name": "Teste Cliente",
            "email": "novo@cliente.com",
            "password": self.STRONG,
            "confirm_password": self.STRONG,
        }

    def test_register_aceita_senha_forte(self, api_anonymous, base_payload):
        r = api_anonymous.post("/api/auth/register", json=base_payload)
        assert r.status_code == 200, r.get_data(as_text=True)

    @pytest.mark.parametrize(
        "weak_password,reason",
        [
            ("Aa1!aaaa", "menos de 10 chars"),
            ("AAAAAAAAAA1!", "sem minúscula"),
            ("aaaaaaaaaa1!", "sem maiúscula"),
            ("AAAAAaaaaa!!", "sem dígito"),
            ("AAAAAaaaaa12", "sem símbolo"),
            ("Password123!", "comum (lista de vazamentos)"),
            ("12345678910", "comum + sem char"),
            ("Peticiona123!", "marca da plataforma na blocklist"),
        ],
    )
    def test_register_rejeita_senhas_fracas(
        self, api_anonymous, base_payload, weak_password, reason
    ):
        payload = {**base_payload, "password": weak_password, "confirm_password": weak_password}
        r = api_anonymous.post("/api/auth/register", json=payload)
        assert r.status_code == 400, f"deveria rejeitar ({reason}): {r.get_data(as_text=True)}"

    def test_register_bloqueia_senha_baseada_no_email(self, api_anonymous):
        # parte local "andrekaique" virando senha "Andrekaique123!" — usável
        # em credential stuffing porque o atacante já tem o e-mail.
        payload = {
            "full_name": "Andre",
            "email": "andrekaique@example.com",
            "password": "Andrekaique123!",
            "confirm_password": "Andrekaique123!",
        }
        r = api_anonymous.post("/api/auth/register", json=payload)
        assert r.status_code == 400
        assert "e-mail" in r.get_data(as_text=True).lower()


# ---------------------------------------------------------------------------
# 2. Lockout do login
# ---------------------------------------------------------------------------


class TestLoginLockout:
    @pytest.fixture
    def user(self, app, db):
        from app.core.security import hash_password
        u = create_client(email="locktarget@peticiona.app.br")
        u.password_hash = hash_password("Senha_Real_123!")
        db.session.commit()
        return u

    def test_login_correto_funciona(self, api_anonymous, user):
        r = api_anonymous.post(
            "/api/auth/login",
            json={"email": user.email, "password": "Senha_Real_123!"},
        )
        assert r.status_code == 200

    def test_quinto_erro_consecutivo_bloqueia_conta(self, api_anonymous, user, db):
        for attempt in range(1, 6):
            r = api_anonymous.post(
                "/api/auth/login",
                json={"email": user.email, "password": "senha-errada-XYZ"},
            )
            assert r.status_code == 401, f"tentativa {attempt}: {r.get_data(as_text=True)}"
        db.session.refresh(user)
        assert user.failed_login_attempts >= 5
        assert user.locked_until is not None
        # SQLite armazena naive datetime; Postgres timezone-aware. Comparamos
        # via timestamp() pra tolerar os dois.
        locked_ts = user.locked_until.timestamp() if user.locked_until.tzinfo else (
            user.locked_until.replace(tzinfo=timezone.utc).timestamp()
        )
        assert locked_ts > datetime.now(timezone.utc).timestamp()

    def test_quando_bloqueado_senha_correta_tambem_recusa(self, api_anonymous, user, db):
        user.failed_login_attempts = 5
        user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=10)
        db.session.commit()
        r = api_anonymous.post(
            "/api/auth/login",
            json={"email": user.email, "password": "Senha_Real_123!"},
        )
        assert r.status_code == 401
        # Mensagem deve indicar bloqueio (não credenciais erradas) pra UX clara
        assert "bloqueada" in r.get_data(as_text=True).lower()

    def test_login_bem_sucedido_zera_contadores(self, api_anonymous, user, db):
        user.failed_login_attempts = 2
        db.session.commit()
        r = api_anonymous.post(
            "/api/auth/login",
            json={"email": user.email, "password": "Senha_Real_123!"},
        )
        assert r.status_code == 200
        db.session.refresh(user)
        assert user.failed_login_attempts == 0
        assert user.locked_until is None

    def test_email_inexistente_nao_quebra(self, api_anonymous):
        # Sem usuário pra incrementar — deve devolver credenciais inválidas
        # sem 500.
        r = api_anonymous.post(
            "/api/auth/login",
            json={"email": "naoexiste@x.com", "password": "qualquer-coisa-123"},
        )
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# 3. JWT_SECRET separado de FLASK_SECRET_KEY
# ---------------------------------------------------------------------------


class TestJwtKeySeparation:
    def test_jwt_e_flask_podem_usar_chaves_distintas(self, app, monkeypatch):
        """Não dá pra alterar SECRET_KEY em runtime (Flask checa no boot),
        mas dá pra verificar que `create_access_token` usa explicitamente
        JWT_SECRET e que decodificar com SECRET_KEY falha quando são
        distintos."""
        import jwt as pyjwt
        from app.core.jwt import create_access_token, decode_access_token

        monkeypatch.setitem(app.config, "JWT_SECRET", "chave-jwt-dedicada-xpto-1234")

        token = create_access_token(user_id=1)

        # Decodificar com SECRET_KEY (que é a do app, diferente da
        # JWT_SECRET que setei): deve falhar.
        with pytest.raises(pyjwt.InvalidSignatureError):
            pyjwt.decode(
                token,
                app.config["SECRET_KEY"],
                algorithms=["HS256"],
                options={"verify_sub": False},
            )

        # Decodificar com a JWT_SECRET correta: passa.
        decoded = decode_access_token(token)
        assert int(decoded["sub"]) == 1


# ---------------------------------------------------------------------------
# 4. Reset de senha destrava conta bloqueada (bypass legítimo)
# ---------------------------------------------------------------------------


class TestResetDestravaConta:
    def test_reset_zera_contador_e_lock(self, api_anonymous, app, db, monkeypatch):
        # Provider configurado pra forçar caminho real (e nosso spy capturar)
        monkeypatch.setitem(app.config, "SMTP_HOST", "smtp-dummy")
        from app.core.security import hash_password
        u = create_client(email="locked-and-forgot@x.com")
        u.password_hash = hash_password("Senha_Antiga_99!")
        u.failed_login_attempts = 5
        u.locked_until = datetime.now(timezone.utc) + timedelta(minutes=20)
        db.session.commit()

        emails = capture_emails(monkeypatch, target_module=password_reset_service)

        api_anonymous.post(
            "/api/auth/password-reset/request",
            json={"email": u.email},
        )
        assert emails, "Reset não disparou e-mail"

        # Extrai o token do e-mail capturado
        import re
        body = emails[0].get("body") or emails[0].get("html") or ""
        token_match = re.search(r"token=([^\s\"<>&]+)", body)
        assert token_match is not None
        token = token_match.group(1)

        confirm = api_anonymous.post(
            "/api/auth/password-reset/confirm",
            json={"token": token, "password": "Senha_NovaForte_77!"},
        )
        assert confirm.status_code == 200, confirm.get_data(as_text=True)

        db.session.refresh(u)
        assert u.failed_login_attempts == 0
        assert u.locked_until is None
