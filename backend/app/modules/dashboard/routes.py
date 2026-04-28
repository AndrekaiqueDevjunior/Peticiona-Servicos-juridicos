from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.permissions import auth_required, current_actor
from app.services.dashboard_service import get_dashboard

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")


@dashboard_bp.get("")
@auth_required
def dashboard():
    return jsonify(get_dashboard(user=current_actor(), status=request.args.get("status")))
