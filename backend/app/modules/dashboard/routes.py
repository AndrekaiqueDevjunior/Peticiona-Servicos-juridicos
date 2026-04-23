from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.permissions import current_actor
from app.services.dashboard_service import get_dashboard

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")


@dashboard_bp.get("")
def dashboard():
    actor = current_actor(optional=True)
    return jsonify(get_dashboard(user=actor, status=request.args.get("status")))
