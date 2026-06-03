#!/usr/bin/env python3
"""Smoke tests contra a VPS de produção (https://peticiona.app.br).

Uso:
    python3 scripts/smoke_vps.py
    python3 scripts/smoke_vps.py --url https://peticiona.app.br
    python3 scripts/smoke_vps.py --url http://localhost:5000  # dev local

Variáveis de ambiente (opcional — sobrepõem defaults):
    SMOKE_EMAIL     e-mail do usuário de teste (role: admin ou client)
    SMOKE_PASSWORD  senha correspondente

Todos os testes são não-destrutivos:
  - Pedidos criados são CANCELADOS ao final.
  - Nunca modifica dados de outros usuários.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone, timedelta

import requests

BASE_URL = "https://peticiona.app.br"

GREEN = "\033[92m"
RED   = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"
BOLD  = "\033[1m"

passed = 0
failed = 0


def ok(msg: str) -> None:
    global passed
    passed += 1
    print(f"  {GREEN}✓{RESET} {msg}")


def fail(msg: str, detail: str = "") -> None:
    global failed
    failed += 1
    detail_str = f"\n      {YELLOW}{detail}{RESET}" if detail else ""
    print(f"  {RED}✗{RESET} {msg}{detail_str}")


def section(title: str) -> None:
    print(f"\n{BOLD}{title}{RESET}")


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

class Session:
    def __init__(self, base: str) -> None:
        self.base = base.rstrip("/")
        self._session = requests.Session()
        self._token: str | None = None

    def _headers(self) -> dict:
        h = {"Content-Type": "application/json"}
        if self._token:
            h["Authorization"] = f"Bearer {self._token}"
        return h

    def get(self, path: str, **kw) -> requests.Response:
        return self._session.get(f"{self.base}{path}", headers=self._headers(), timeout=15, **kw)

    def post(self, path: str, json: dict | None = None, **kw) -> requests.Response:
        return self._session.post(f"{self.base}{path}", json=json, headers=self._headers(), timeout=15, **kw)

    def patch(self, path: str, json: dict | None = None, **kw) -> requests.Response:
        return self._session.patch(f"{self.base}{path}", json=json, headers=self._headers(), timeout=15, **kw)

    def login(self, email: str, password: str) -> bool:
        r = self.post("/api/auth/login", json={"email": email, "password": password})
        if r.status_code == 200:
            data = r.json()
            self._token = data.get("access_token") or data.get("token")
            return bool(self._token)
        return False


# ---------------------------------------------------------------------------
# Suíte de testes
# ---------------------------------------------------------------------------

def test_health(s: Session) -> None:
    section("1. Health")
    r = s.get("/api/health")
    if r.status_code == 200 and r.json().get("status") == "ok":
        ok(f"GET /api/health → {r.json()}")
    else:
        fail("GET /api/health falhou", f"status={r.status_code} body={r.text[:200]}")


def test_auth(s: Session, email: str, password: str) -> str:
    """Retorna a role do usuário autenticado, ou '' em caso de falha."""
    section("2. Autenticação")
    r = s.post("/api/auth/login", json={"email": email, "password": password})
    if r.status_code == 200:
        data = r.json()
        token = data.get("access_token") or data.get("token")
        if token:
            s._token = token
            role = data.get("user", {}).get("role", "")
            ok(f"Login OK — role={role or '?'} email={email}")
            return role
    fail("Login falhou", f"status={r.status_code} body={r.text[:200]}")
    return ""


def test_me(s: Session) -> None:
    section("3. /api/me")
    r = s.get("/api/me")
    if r.status_code == 200:
        u = r.json().get("user", {})
        plano = u.get("plano") or "sem plano"
        ok(f"GET /api/me → {u.get('email')} | plano={plano}")
    else:
        fail("GET /api/me falhou", f"status={r.status_code}")


def test_catalog(s: Session) -> None:
    section("4. Catálogo de serviços")
    r = s.get("/api/catalog")
    if r.status_code == 200:
        sections = r.json().get("catalog", [])
        total = sum(len(sec.get("items", [])) for sec in sections)
        ok(f"GET /api/catalog → {total} serviços em {len(sections)} seções")
    else:
        fail("GET /api/catalog falhou", f"status={r.status_code}")


def test_balance(s: Session) -> None:
    section("5. Saldo")
    r = s.get("/api/me/balance")
    if r.status_code == 200:
        b = r.json().get("balance", {})
        ok(f"GET /api/me/balance → common={b.get('common',0)} crédito(s)")
    else:
        fail("GET /api/me/balance falhou", f"status={r.status_code}")


PETICAO_PAYLOAD = {
    "area_direito": "Direito Civil",
    "tipo_peticao": "Contestação",
    "partes": [{"nome": "Smoke Test Autor", "tipo": "Autor"}],
    "resumo_caso": "[SMOKE TEST - pode ignorar]",
    "detalhes": "Teste automático de prazo. Será cancelado.",
    "justica_gratuita": False,
    "tutela_urgencia": False,
    "advogado_subscritor": "Dr. Smoke OAB/SP 000000",
}


def test_prazo_pedidos_existentes(s: Session, role: str) -> None:
    """Verifica prazo nos pedidos já existentes na VPS (read-only)."""
    section("6. Prazo nos pedidos existentes (read-only)")

    if role == "admin":
        r = s.get("/api/admin/orders?page=1&per_page=10")
        orders = r.json().get("orders", []) if r.status_code == 200 else []
        rota = "/api/admin/orders"
    else:
        r = s.get("/api/orders")
        orders = r.json().get("orders", []) if r.status_code == 200 else []
        rota = "/api/orders"

    if r.status_code != 200:
        fail(f"GET {rota} falhou", f"status={r.status_code} body={r.text[:200]}")
        return

    ok(f"GET {rota} → {len(orders)} pedido(s) retornados")

    # Verifica que pedidos não-express têm deadline_at definido
    sem_prazo = [o for o in orders if not o.get("express_upgrade") and not o.get("deadline_at") and not o.get("prazo_cliente")]
    com_prazo = [o for o in orders if o.get("deadline_at") or o.get("prazo_cliente")]
    express_pendente = [o for o in orders if o.get("express_upgrade") and not (o.get("deadline_at") or o.get("prazo_cliente"))]

    if com_prazo:
        ok(f"{len(com_prazo)} pedido(s) com prazo definido ✓")
    if express_pendente:
        ok(f"{len(express_pendente)} pedido(s) express pendente de pagamento (sem prazo, esperado)")
    if sem_prazo:
        fail(f"{len(sem_prazo)} pedido(s) sem prazo que deveriam ter",
             " | ".join(str(o.get("id") or o.get("reference", "?")) for o in sem_prazo[:5]))
    elif not orders:
        ok("Nenhum pedido encontrado (base vazia — OK para smoke test)")


def test_prazo_peticao(s: Session, role: str) -> str | None:
    """Cria uma petição (se tiver crédito) e verifica o prazo.

    Retorna o order_id para limpeza posterior.
    """
    section("7. Prazo ao criar nova petição")

    r = s.get("/api/me/balance")
    saldo = r.json().get("balance", {}).get("common", 0) if r.status_code == 200 else 0

    if saldo == 0:
        ok("Sem créditos disponíveis — pulando criação (use cliente com crédito para testar)")
        return None

    inicio = datetime.now(timezone.utc)
    r = s.post("/api/petitions", json=PETICAO_PAYLOAD)
    if r.status_code != 201:
        fail("POST /api/petitions falhou", f"status={r.status_code} body={r.text[:300]}")
        return None

    data = r.json()
    order = data.get("order", {})
    order_id = order.get("id")
    deadline_str = order.get("deadline_at")

    if not deadline_str:
        fail("deadline_at não veio na resposta", str(order))
        return order_id

    deadline = datetime.fromisoformat(deadline_str.replace("Z", "+00:00"))
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)

    delta_dias = (deadline.date() - inicio.date()).days
    ok(f"Petição criada → deadline_at={deadline.date()} (+{delta_dias} dias corridos)")

    if 2 <= delta_dias <= 7:
        ok("Prazo dentro da faixa esperada (2–7 dias corridos)")
    else:
        fail("Prazo fora da faixa esperada", f"delta={delta_dias} — esperado 2 a 7")

    return order_id


def test_prazo_express(s: Session, role: str) -> str | None:
    """Cria petição express e verifica que deadline_at é None."""
    section("8. Prazo express (deve ser None até pagamento)")

    r = s.get("/api/me/balance")
    saldo = r.json().get("balance", {}).get("common", 0) if r.status_code == 200 else 0

    if saldo == 0:
        ok("Sem créditos — pulando teste express")
        return None

    payload = {**PETICAO_PAYLOAD, "express_upgrade": True,
               "tipo_peticao": "Embargos de declaração",
               "resumo_caso": "[SMOKE TEST EXPRESS - pode ignorar]"}
    r = s.post("/api/petitions", json=payload)
    if r.status_code != 201:
        fail("POST /api/petitions (express) falhou", f"status={r.status_code} body={r.text[:300]}")
        return None

    order = r.json().get("order", {})
    deadline = order.get("deadline_at")
    express = order.get("express_upgrade")

    if deadline is None and express is True:
        ok("Express correto: deadline_at=None, express_upgrade=True")
    elif deadline is not None:
        fail("Express deveria ter deadline_at=None antes do pagamento", f"deadline_at={deadline}")
    else:
        fail("express_upgrade não veio como True na resposta", str(order))

    return order.get("id")


def test_list_orders(s: Session, role: str) -> None:
    section("9. Listagem de pedidos")
    rota = "/api/admin/orders" if role == "admin" else "/api/orders"
    r = s.get(rota)
    if r.status_code == 200:
        orders = r.json().get("orders", [])
        ok(f"GET {rota} → {len(orders)} pedido(s)")
    else:
        fail(f"GET {rota} falhou", f"status={r.status_code}")


def cleanup_orders(s: Session, order_ids: list[int | str]) -> None:
    section("9. Limpeza (cancelamento dos pedidos de teste)")
    for oid in order_ids:
        if oid is None:
            continue
        r = s.patch(f"/api/orders/{oid}", json={"status": "cancelado"})
        if r.status_code in (200, 204):
            ok(f"Pedido {oid} cancelado")
        else:
            # Tentar via admin se cliente não puder
            r2 = s.patch(f"/api/admin/orders/{oid}", json={"status": "cancelado"})
            if r2.status_code in (200, 204):
                ok(f"Pedido {oid} cancelado via admin")
            else:
                fail(f"Não foi possível cancelar pedido {oid}",
                     f"client={r.status_code} admin={r2.status_code}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Smoke tests contra a VPS Peticiona")
    parser.add_argument("--url", default=BASE_URL, help="URL base da API")
    args = parser.parse_args()

    email    = os.environ.get("SMOKE_EMAIL", "clarissanjosino@gmail.com")
    password = os.environ.get("SMOKE_PASSWORD", "")

    if not password:
        print(f"{RED}Erro: defina SMOKE_PASSWORD (ex: export SMOKE_PASSWORD='...')  {RESET}")
        sys.exit(1)

    print(f"\n{BOLD}=== Smoke Tests VPS ==={RESET}")
    print(f"  URL: {args.url}")
    print(f"  Usuário: {email}")

    s = Session(args.url)

    test_health(s)

    role = test_auth(s, email, password)
    if not role:
        print(f"\n{RED}Login falhou — abortando.{RESET}")
        sys.exit(1)

    test_me(s)
    test_catalog(s)
    test_balance(s)
    test_prazo_pedidos_existentes(s, role)

    order_ids: list = []
    order_ids.append(test_prazo_peticao(s, role))
    order_ids.append(test_prazo_express(s, role))

    test_list_orders(s, role)
    cleanup_orders(s, [o for o in order_ids if o])

    # Resultado final
    total = passed + failed
    print(f"\n{BOLD}{'─'*40}{RESET}")
    if failed == 0:
        print(f"{GREEN}{BOLD}✓ {passed}/{total} testes passaram{RESET}")
    else:
        print(f"{RED}{BOLD}✗ {failed}/{total} testes falharam  ({passed} passaram){RESET}")
    print()

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
