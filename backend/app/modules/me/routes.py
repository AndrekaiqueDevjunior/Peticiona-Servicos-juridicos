from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.permissions import auth_required, current_actor
from app.services.user_service import get_balance_snapshot, get_profile, update_profile

me_bp = Blueprint("me", __name__, url_prefix="/api/me")


@me_bp.get("")
@auth_required
def me():
    return jsonify(get_profile(current_actor()))


@me_bp.put("")
@auth_required
def update_me():
    return jsonify(update_profile(current_actor(), request.get_json(silent=True) or {}))


@me_bp.get("/balance")
@auth_required
def my_balance():
    return jsonify(get_balance_snapshot(current_actor()))
