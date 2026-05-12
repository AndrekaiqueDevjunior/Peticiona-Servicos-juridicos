from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.core.rate_limit import limit_requests
from app.modules.auth.schemas import load_login_payload, load_register_payload
from app.services.auth_service import login_user, register_user
from app.services.password_reset_service import confirm_password_reset, request_password_reset

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def _load_password_reset_request_payload(payload: dict | None) -> str:
    email = (payload or {}).get("email")
    if not isinstance(email, str):
        email = ""
    return email


def _load_password_reset_confirm_payload(payload: dict | None) -> tuple[str, str]:
    data = payload or {}
    token = data.get("token")
    password = data.get("password")
    return token if isinstance(token, str) else "", password if isinstance(password, str) else ""


@auth_bp.post("/register")
@limit_requests("auth-register")
def register():
    return jsonify(register_user(load_register_payload(request.get_json(silent=True))))


@auth_bp.post("/login")
@limit_requests("auth-login")
def login():
    return jsonify(login_user(load_login_payload(request.get_json(silent=True))))


@auth_bp.post("/password-reset/request")
@limit_requests("auth-password-reset-request")
def password_reset_request():
    email = _load_password_reset_request_payload(request.get_json(silent=True))
    return jsonify(request_password_reset(email))


@auth_bp.post("/password-reset/confirm")
@limit_requests("auth-password-reset-confirm")
def password_reset_confirm():
    token, password = _load_password_reset_confirm_payload(request.get_json(silent=True))
    return jsonify(confirm_password_reset(token, password))
