from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.permissions import current_actor, roles_required
from app.services.admin_service import (
    create_admin_client,
    create_admin_order,
    create_admin_plan,
    create_admin_service,
    create_admin_staff,
    create_financial_entry,
    create_financial_refund,
    delete_admin_client,
    delete_admin_order,
    delete_admin_plan,
    delete_admin_service,
    delete_admin_staff,
    delete_financial_entry,
    get_admin_client,
    get_admin_financial,
    get_admin_order,
    get_admin_plan,
    get_admin_profile,
    get_admin_service,
    get_admin_staff_member,
    get_financial_entry,
    list_admin_credit_purchases,
    list_admin_clients,
    list_admin_orders,
    list_admin_plans,
    list_admin_services,
    list_admin_staff,
    list_financial_entries,
    refund_credit_purchase,
    update_admin_client,
    update_admin_order,
    update_admin_plan,
    update_admin_profile,
    update_admin_service,
    update_admin_staff,
    update_financial_entry,
)
from app.services.settings_service import get_contact_info, update_contact_info

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


@admin_bp.get("/profile")
@roles_required("admin")
def profile():
    return jsonify(get_admin_profile(current_actor()))


@admin_bp.put("/profile")
@roles_required("admin")
def update_profile():
    actor = current_actor()
    return jsonify(update_admin_profile(actor, request.get_json(silent=True) or {}))


@admin_bp.get("/settings/contact")
@roles_required("admin")
def contact_settings():
    return jsonify(get_contact_info())


@admin_bp.put("/settings/contact")
@admin_bp.patch("/settings/contact")
@roles_required("admin")
def update_contact_settings():
    actor = current_actor()
    return jsonify(update_contact_info(request.get_json(silent=True) or {}, actor=actor))


@admin_bp.get("/orders")
@roles_required("admin")
def orders():
    return jsonify(list_admin_orders(current_actor()))


@admin_bp.post("/orders")
@roles_required("admin")
def create_order():
    actor = current_actor()
    return jsonify(create_admin_order(actor, request.get_json(silent=True) or {})), 201


@admin_bp.get("/orders/<int:order_id>")
@roles_required("admin")
def order_detail(order_id: int):
    return jsonify(get_admin_order(current_actor(), order_id))


@admin_bp.put("/orders/<int:order_id>")
@admin_bp.patch("/orders/<int:order_id>")
@roles_required("admin")
def update_order(order_id: int):
    actor = current_actor()
    return jsonify(update_admin_order(actor, order_id, request.get_json(silent=True) or {}))


@admin_bp.patch("/orders/<int:order_id>/status")
@roles_required("admin")
def update_order_status(order_id: int):
    actor = current_actor()
    payload = request.get_json(silent=True) or {}
    return jsonify(update_admin_order(actor, order_id, {"status": payload.get("status")}))


@admin_bp.delete("/orders/<int:order_id>")
@roles_required("admin")
def delete_order(order_id: int):
    delete_admin_order(current_actor(), order_id)
    return "", 204


@admin_bp.get("/clients")
@roles_required("admin")
def clients():
    return jsonify(list_admin_clients(current_actor()))


@admin_bp.post("/clients")
@roles_required("admin")
def create_client():
    actor = current_actor()
    return jsonify(create_admin_client(actor, request.get_json(silent=True) or {})), 201


@admin_bp.get("/clients/<int:client_id>")
@roles_required("admin")
def client_detail(client_id: int):
    return jsonify(get_admin_client(current_actor(), client_id))


@admin_bp.put("/clients/<int:client_id>")
@admin_bp.patch("/clients/<int:client_id>")
@roles_required("admin")
def update_client(client_id: int):
    actor = current_actor()
    return jsonify(update_admin_client(actor, client_id, request.get_json(silent=True) or {}))


@admin_bp.delete("/clients/<int:client_id>")
@roles_required("admin")
def delete_client(client_id: int):
    delete_admin_client(current_actor(), client_id)
    return "", 204


@admin_bp.get("/staff")
@roles_required("admin")
def staff():
    return jsonify(list_admin_staff(current_actor()))


@admin_bp.post("/staff")
@roles_required("admin")
def create_staff():
    actor = current_actor()
    return jsonify(create_admin_staff(actor, request.get_json(silent=True) or {})), 201


@admin_bp.get("/staff/<int:staff_id>")
@roles_required("admin")
def staff_detail(staff_id: int):
    return jsonify(get_admin_staff_member(current_actor(), staff_id))


@admin_bp.put("/staff/<int:staff_id>")
@admin_bp.patch("/staff/<int:staff_id>")
@roles_required("admin")
def update_staff(staff_id: int):
    actor = current_actor()
    return jsonify(update_admin_staff(actor, staff_id, request.get_json(silent=True) or {}))


@admin_bp.delete("/staff/<int:staff_id>")
@roles_required("admin")
def delete_staff(staff_id: int):
    delete_admin_staff(current_actor(), staff_id)
    return "", 204


@admin_bp.get("/financial")
@roles_required("admin")
def financial():
    return jsonify(get_admin_financial(current_actor()))


@admin_bp.get("/financial/entries")
@roles_required("admin")
def financial_entries():
    return jsonify(list_financial_entries(current_actor()))


@admin_bp.get("/financial/transactions")
@roles_required("admin")
def financial_transactions():
    return jsonify(list_financial_entries(current_actor()))


@admin_bp.get("/credit-purchases")
@roles_required("admin")
def credit_purchases():
    return jsonify(list_admin_credit_purchases(current_actor()))


@admin_bp.post("/credit-purchases/<int:purchase_id>/refund")
@roles_required("admin")
def refund_credit_purchase_route(purchase_id: int):
    return jsonify(refund_credit_purchase(current_actor(), purchase_id))


@admin_bp.post("/financial/refund")
@roles_required("admin")
def create_refund():
    actor = current_actor()
    return jsonify(create_financial_refund(actor, request.get_json(silent=True) or {})), 201


@admin_bp.post("/financial/entries")
@roles_required("admin")
def create_entry():
    actor = current_actor()
    return jsonify(create_financial_entry(actor, request.get_json(silent=True) or {})), 201


@admin_bp.get("/financial/entries/<int:entry_id>")
@roles_required("admin")
def financial_entry_detail(entry_id: int):
    return jsonify(get_financial_entry(current_actor(), entry_id))


@admin_bp.put("/financial/entries/<int:entry_id>")
@admin_bp.patch("/financial/entries/<int:entry_id>")
@roles_required("admin")
def update_entry(entry_id: int):
    actor = current_actor()
    return jsonify(update_financial_entry(actor, entry_id, request.get_json(silent=True) or {}))


@admin_bp.delete("/financial/entries/<int:entry_id>")
@roles_required("admin")
def delete_entry(entry_id: int):
    return jsonify(delete_financial_entry(current_actor(), entry_id))


@admin_bp.get("/plans")
@roles_required("admin")
def plans():
    return jsonify(list_admin_plans(current_actor()))


@admin_bp.post("/plans")
@roles_required("admin")
def create_plan():
    actor = current_actor()
    return jsonify(create_admin_plan(actor, request.get_json(silent=True) or {})), 201


@admin_bp.get("/plans/<int:plan_id>")
@roles_required("admin")
def plan_detail(plan_id: int):
    return jsonify(get_admin_plan(plan_id))


@admin_bp.put("/plans/<int:plan_id>")
@admin_bp.patch("/plans/<int:plan_id>")
@roles_required("admin")
def update_plan(plan_id: int):
    actor = current_actor()
    return jsonify(update_admin_plan(actor, plan_id, request.get_json(silent=True) or {}))


@admin_bp.delete("/plans/<int:plan_id>")
@roles_required("admin")
def delete_plan(plan_id: int):
    delete_admin_plan(current_actor(), plan_id)
    return "", 204


@admin_bp.get("/services")
@roles_required("admin")
def services():
    return jsonify(list_admin_services(current_actor()))


@admin_bp.post("/services")
@roles_required("admin")
def create_service():
    actor = current_actor()
    return jsonify(create_admin_service(actor, request.get_json(silent=True) or {})), 201


@admin_bp.get("/services/<int:service_id>")
@roles_required("admin")
def service_detail(service_id: int):
    return jsonify(get_admin_service(service_id))


@admin_bp.put("/services/<int:service_id>")
@admin_bp.patch("/services/<int:service_id>")
@roles_required("admin")
def update_service(service_id: int):
    actor = current_actor()
    return jsonify(update_admin_service(actor, service_id, request.get_json(silent=True) or {}))


@admin_bp.delete("/services/<int:service_id>")
@roles_required("admin")
def delete_service(service_id: int):
    delete_admin_service(current_actor(), service_id)
    return "", 204
