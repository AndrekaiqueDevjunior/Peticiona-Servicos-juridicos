from __future__ import annotations

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from flask import current_app

logger = logging.getLogger(__name__)


def send_email(*, to: str, subject: str, body: str) -> bool:
    """Send a plain-text email via SMTP. Returns True on success.

    If SMTP_HOST is not set, logs the email and returns False (dry-run mode).
    Failures are caught and logged — callers should treat False as a soft failure.
    """
    host = current_app.config.get("SMTP_HOST", "")
    if not host:
        logger.info("[email dry-run] to=%s subject=%r", to, subject)
        return False

    port = int(current_app.config.get("SMTP_PORT", 587))
    username = current_app.config.get("SMTP_USERNAME", "")
    password = current_app.config.get("SMTP_PASSWORD", "")
    from_addr = current_app.config.get("SMTP_FROM") or username
    use_tls: bool = current_app.config.get("SMTP_USE_TLS", True)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to
    msg.attach(MIMEText(body, "plain", "utf-8"))

    try:
        if use_tls:
            with smtplib.SMTP(host, port, timeout=10) as smtp:
                smtp.ehlo()
                smtp.starttls()
                if username and password:
                    smtp.login(username, password)
                smtp.sendmail(from_addr, [to], msg.as_string())
        else:
            with smtplib.SMTP_SSL(host, port, timeout=10) as smtp:
                if username and password:
                    smtp.login(username, password)
                smtp.sendmail(from_addr, [to], msg.as_string())

        logger.info("[email sent] to=%s subject=%r", to, subject)
        return True

    except Exception as exc:  # noqa: BLE001
        logger.warning("[email failed] to=%s error=%s", to, exc)
        return False
