from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.permissions import auth_required, current_actor
from app.services.user_service import (
    accept_terms,
    change_my_password,
    get_balance_snapshot,
    get_documents,
    get_profile,
    get_terms_acceptance,
    update_profile,
)

me_bp = Blueprint("me", __name__, url_prefix="/api/me")


@me_bp.get("")
@auth_required
def me():
    return jsonify(get_profile(current_actor()))


@me_bp.put("")
@me_bp.patch("")
@auth_required
def update_me():
    return jsonify(update_profile(current_actor(), request.get_json(silent=True) or {}))


@me_bp.get("/balance")
@auth_required
def my_balance():
    return jsonify(get_balance_snapshot(current_actor()))


@me_bp.get("/documents")
@auth_required
def my_documents():
    return jsonify(get_documents(current_actor()))


@me_bp.get("/terms")
@auth_required
def my_terms():
    return jsonify(get_terms_acceptance(current_actor()))


@me_bp.post("/password")
@auth_required
def change_password():
    return jsonify(change_my_password(current_actor(), request.get_json(silent=True) or {}))


@me_bp.post("/terms")
@auth_required
def accept_my_terms():
    forwarded_for = request.headers.get("X-Forwarded-For", "")
    ip_address = forwarded_for.split(",")[0].strip() if forwarded_for else request.remote_addr
    return jsonify(
        accept_terms(
            current_actor(),
            ip_address=ip_address,
            user_agent=request.headers.get("User-Agent"),
        )
    )
