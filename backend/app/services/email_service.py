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


def _config(name: str, default=None):
    return current_app.config.get(name, default)


def _resolve_from_address() -> str:
    return (
        _config("SENDGRID_FROM")
        or _config("SMTP_FROM")
        or _config("NOTIFICATION_EMAIL")
        or "no-reply@peticiona.app.br"
    )


def _send_via_sendgrid(*, to: str, subject: str, body: str) -> bool:
    api_key = _config("SENDGRID_API_KEY", "").strip()
    if not api_key:
        return False

    payload = {
        "personalizations": [{"to": [{"email": to}]}],
        "from": {"email": _resolve_from_address()},
        "subject": subject,
        "content": [{"type": "text/plain", "value": body}],
    }

    request = Request(
        "https://api.sendgrid.com/v3/mail/send",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=15) as response:
            status_code = getattr(response, "status", response.getcode())
    except HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="ignore")
        logger.exception("SendGrid rejected the email with status %s: %s", exc.code, error_body)
        return False
    except URLError:
        logger.exception("Could not reach SendGrid to send email")
        return False
    except Exception:
        logger.exception("Unexpected SendGrid failure while sending email")
        return False

    if 200 <= status_code < 300:
        return True

    logger.error("SendGrid returned unexpected status %s while sending email", status_code)
    return False


def _send_via_smtp(*, to: str, subject: str, body: str) -> bool:
    host = _config("SMTP_HOST", "").strip()
    if not host:
        logger.info(
            "Email dry-run: host not configured. to=%s subject=%s body=%s",
            to,
            subject,
            body,
        )
        return False

    message = MIMEMultipart()
    message["From"] = _resolve_from_address()
    message["To"] = to
    message["Subject"] = subject
    message.attach(MIMEText(body, "plain", "utf-8"))

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
        logger.exception("SMTP email delivery failed")
        return False


def send_email(*, to: str, subject: str, body: str) -> bool:
    """Send a plain-text email via SendGrid or SMTP. Returns True on success.

    If neither provider is configured, logs the email and returns False (dry-run mode).
    Failures are caught and logged — callers should treat False as a soft failure.
    """

    if _send_via_sendgrid(to=to, subject=subject, body=body):
        return True

    return _send_via_smtp(to=to, subject=subject, body=body)
