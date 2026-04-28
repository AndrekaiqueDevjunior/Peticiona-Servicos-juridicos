from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.permissions import current_actor, roles_required
from app.services.staff_service import (
    get_staff_financial,
    get_staff_profile,
    list_staff_orders,
    update_staff_order,
    update_staff_profile,
)

staff_bp = Blueprint("staff", __name__, url_prefix="/api/staff")


@staff_bp.get("/profile")
@roles_required("staff")
def profile():
    return jsonify(get_staff_profile(current_actor()))


@staff_bp.put("/profile")
@staff_bp.patch("/profile")
@roles_required("staff")
def update_profile():
    actor = current_actor()
    return jsonify(update_staff_profile(actor, request.get_json(silent=True) or {}))


@staff_bp.get("/orders")
@roles_required("staff")
def orders():
    return jsonify(list_staff_orders(current_actor()))


@staff_bp.patch("/orders/<int:order_id>")
@roles_required("staff")
def update_order(order_id: int):
    actor = current_actor()
    return jsonify(update_staff_order(actor, order_id, request.get_json(silent=True) or {}))


@staff_bp.get("/financial")
@roles_required("staff")
def financial():
    return jsonify(get_staff_financial(current_actor()))
