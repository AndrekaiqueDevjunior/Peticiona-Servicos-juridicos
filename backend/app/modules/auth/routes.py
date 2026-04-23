from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.core.rate_limit import limit_requests
from app.modules.auth.schemas import load_login_payload, load_register_payload
from app.services.auth_service import login_user, register_user

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.post("/register")
@limit_requests("auth-register")
def register():
    payload = load_register_payload(request.get_json(silent=True))
    return jsonify(register_user(payload)), 201


@auth_bp.post("/login")
@limit_requests("auth-login")
def login():
    payload = load_login_payload(request.get_json(silent=True))
    return jsonify(login_user(payload))
