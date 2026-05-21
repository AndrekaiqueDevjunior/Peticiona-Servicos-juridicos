from __future__ import annotations

import json
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from flask import current_app

logger = logging.getLogger(__name__)

# ── helpers ─────────────────────────────────────────────────────────────────

def _config(name: str, default=None):
    return current_app.config.get(name, default)


def _resolve_from_address() -> str:
    return (
        _config("RESEND_FROM_EMAIL", "").strip()
        or _config("SENDGRID_FROM", "").strip()
        or _config("SMTP_FROM", "").strip()
        or _config("NOTIFICATION_EMAIL", "").strip()
        or "no-reply@peticiona.app.br"
    )


# ── HTML base template ───────────────────────────────────────────────────────

def _wrap_html(title: str, body_html: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title}</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
           background: #f6f6f6; margin: 0; padding: 0; }}
    .wrapper {{ max-width: 600px; margin: 40px auto; background: #ffffff;
               border-radius: 8px; overflow: hidden;
               box-shadow: 0 2px 8px rgba(0,0,0,.08); }}
    .header {{ background: #1a2e44; padding: 28px 32px; text-align: center; }}
    .header h1 {{ color: #ffffff; font-size: 20px; margin: 0; font-weight: 600; }}
    .header span {{ color: #c9a96e; font-size: 11px; letter-spacing: .15em;
                   text-transform: uppercase; display: block; margin-top: 4px; }}
    .body {{ padding: 32px; color: #333333; font-size: 15px; line-height: 1.6; }}
    .body p {{ margin: 0 0 16px; }}
    .field {{ background: #f8f9fa; border-left: 3px solid #c9a96e; padding: 10px 14px;
             margin: 8px 0; border-radius: 0 4px 4px 0; font-size: 14px; }}
    .field strong {{ color: #1a2e44; display: block; font-size: 11px;
                    text-transform: uppercase; letter-spacing: .08em; margin-bottom: 2px; }}
    .btn {{ display: inline-block; background: #c9a96e; color: #ffffff !important;
           padding: 12px 28px; border-radius: 5px; text-decoration: none;
           font-weight: 600; font-size: 15px; margin: 16px 0; }}
    .footer {{ background: #f0f0f0; padding: 20px 32px; text-align: center;
              color: #888888; font-size: 12px; }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>PETICIONA</h1>
      <span>Serviços Jurídicos</span>
    </div>
    <div class="body">
      {body_html}
    </div>
    <div class="footer">
      © {__import__('datetime').date.today().year} Peticiona Serviços Jurídicos ·
      <a href="https://peticiona.app.br" style="color:#888888;">peticiona.app.br</a>
    </div>
  </div>
</body>
</html>"""


# ── Resend (provider primário) ───────────────────────────────────────────────

def _send_via_resend(*, to: str, subject: str, body: str, html: str | None = None) -> bool:
    api_key = _config("RESEND_API_KEY", "").strip()
    if not api_key:
        return False

    payload: dict = {
        "from": _resolve_from_address(),
        "to": [to],
        "subject": subject,
    }
    if html:
        payload["html"] = html
    else:
        payload["text"] = body

    # User-Agent obrigatório: o WAF Cloudflare na frente da Resend devolve
    # 403 com error code 1010 para clientes sem UA decente (urlopen do
    # Python default vai com "Python-urllib/3.X", que é bloqueado).
    # Accept evita problema secundário de negociação de conteúdo.
    req = Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "peticiona-backend/1.0 (+https://peticiona.app.br)",
        },
        method="POST",
    )

    try:
        with urlopen(req, timeout=15) as response:
            status_code = getattr(response, "status", response.getcode())
    except HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="ignore")
        logger.error("Resend rejeitou o e-mail (status %s): %s", exc.code, error_body)
        return False
    except URLError:
        logger.exception("Não foi possível conectar ao Resend")
        return False
    except Exception:
        logger.exception("Falha inesperada ao enviar via Resend")
        return False

    if 200 <= status_code < 300:
        logger.info("E-mail enviado via Resend para %s — assunto: %s", to, subject)
        return True

    logger.error("Resend retornou status inesperado %s", status_code)
    return False


# ── SendGrid (fallback 1) ────────────────────────────────────────────────────

def _send_via_sendgrid(*, to: str, subject: str, body: str, html: str | None = None) -> bool:
    api_key = _config("SENDGRID_API_KEY", "").strip()
    if not api_key:
        return False

    content = [{"type": "text/plain", "value": body}]
    if html:
        content.append({"type": "text/html", "value": html})

    payload = {
        "personalizations": [{"to": [{"email": to}]}],
        "from": {"email": _resolve_from_address()},
        "subject": subject,
        "content": content,
    }

    req = Request(
        "https://api.sendgrid.com/v3/mail/send",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "peticiona-backend/1.0 (+https://peticiona.app.br)",
        },
        method="POST",
    )

    try:
        with urlopen(req, timeout=15) as response:
            status_code = getattr(response, "status", response.getcode())
    except HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="ignore")
        logger.exception("SendGrid rejeitou o e-mail (status %s): %s", exc.code, error_body)
        return False
    except URLError:
        logger.exception("Não foi possível conectar ao SendGrid")
        return False
    except Exception:
        logger.exception("Falha inesperada ao enviar via SendGrid")
        return False

    if 200 <= status_code < 300:
        return True

    logger.error("SendGrid retornou status inesperado %s", status_code)
    return False


# ── SMTP (fallback 2) ────────────────────────────────────────────────────────

def _send_via_smtp(*, to: str, subject: str, body: str, html: str | None = None) -> bool:
    host = _config("SMTP_HOST", "").strip()
    if not host:
        logger.info(
            "Email dry-run (nenhum provider configurado). to=%s subject=%s", to, subject
        )
        return False

    message = MIMEMultipart("alternative")
    message["From"] = _resolve_from_address()
    message["To"] = to
    message["Subject"] = subject
    message.attach(MIMEText(body, "plain", "utf-8"))
    if html:
        message.attach(MIMEText(html, "html", "utf-8"))

    try:
        with smtplib.SMTP(host, int(_config("SMTP_PORT", 587)), timeout=15) as server:
            if _config("SMTP_USE_TLS", True):
                server.starttls()

            username = _config("SMTP_USERNAME", "").strip()
            password = _config("SMTP_PASSWORD", "")
            if username:
                server.login(username, password)

            server.sendmail(message["From"], [to], message.as_string())
        return True
    except Exception:
        logger.exception("Falha na entrega via SMTP")
        return False


# ── API pública ──────────────────────────────────────────────────────────────

def send_email(*, to: str, subject: str, body: str, html: str | None = None) -> bool:
    """Envia e-mail via Resend (primário) → SendGrid (fallback) → SMTP (fallback).

    Retorna True se entregue, False em dry-run ou falha — callers devem tratar
    False como falha suave e decidir se lançam exceção.
    """
    if _send_via_resend(to=to, subject=subject, body=body, html=html):
        return True

    if _send_via_sendgrid(to=to, subject=subject, body=body, html=html):
        return True

    return _send_via_smtp(to=to, subject=subject, body=body, html=html)


# ── Templates prontos ────────────────────────────────────────────────────────

def build_password_reset_html(user_name: str, reset_link: str, expires_minutes: int = 60) -> str:
    body = f"""
    <p>Olá, <strong>{user_name}</strong>.</p>
    <p>Recebemos uma solicitação para redefinir a senha da sua conta na Peticiona.<br>
    Se foi você, clique no botão abaixo para criar uma nova senha:</p>
    <p style="text-align:center;">
      <a class="btn" href="{reset_link}">Redefinir minha senha</a>
    </p>
    <p>Este link expira em <strong>{expires_minutes} minutos</strong>.</p>
    <p style="color:#888;font-size:13px;">
      Se você não solicitou a redefinição de senha, pode ignorar este e-mail com segurança.
      Sua senha permanece a mesma.
    </p>
    """
    return _wrap_html("Redefinição de senha — Peticiona", body)


def build_contact_admin_html(
    name: str, whatsapp: str, email: str, message: str, received_at: str
) -> str:
    body = f"""
    <p>Uma nova mensagem foi recebida pelo formulário de contato do site.</p>
    <div class="field"><strong>Nome</strong>{name}</div>
    <div class="field"><strong>WhatsApp</strong>{whatsapp}</div>
    <div class="field"><strong>E-mail</strong>{email}</div>
    <div class="field"><strong>Mensagem</strong>{message}</div>
    <div class="field"><strong>Recebido em</strong>{received_at}</div>
    <div class="field"><strong>Origem</strong>Formulário do site — peticiona.app.br</div>
    """
    return _wrap_html("Nova mensagem de contato — Peticiona", body)


def build_contact_confirmation_html(name: str) -> str:
    body = f"""
    <p>Olá, <strong>{name}</strong>!</p>
    <p>Recebemos sua mensagem e nossa equipe entrará em contato em breve.</p>
    <p>Nosso horário de atendimento é <strong>segunda a sexta, das 9h às 18h</strong>.</p>
    <p style="color:#888;font-size:13px;">
      Se precisar de algo urgente, entre em contato pelo WhatsApp disponível no site.
    </p>
    """
    return _wrap_html("Recebemos sua mensagem — Peticiona", body)
