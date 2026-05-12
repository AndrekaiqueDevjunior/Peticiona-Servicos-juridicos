from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Callable

from app.core.errors import ValidationError
from app.core.extensions import db
from app.services.audit_service import log_action

VALID_ORDER_STATUSES = frozenset(
    ("pendente", "em_andamento", "concluido", "cancelado")
)
STAFF_ORDER_STATUSES = frozenset(("pendente", "em_andamento", "concluido"))

_ORIGINAL_UPDATE_ATTR = "_peticiona_original_update_admin_order"
_PATCH_INSTALLED_ATTR = "_peticiona_status_patch_installed"
_ORIGINAL_STAFF_UPDATE_ATTR = "_peticiona_original_update_staff_order"
_STAFF_PATCH_INSTALLED_ATTR = "_peticiona_staff_status_patch_installed"


def _normalize_admin_order_payload(payload: dict[str, Any] | None) -> dict[str, Any]:
    normalized = dict(payload or {})

    if "deadline_at" in normalized and "prazo_cliente" not in normalized:
        normalized["prazo_cliente"] = normalized["deadline_at"]
    normalized.pop("deadline_at", None)

    return normalized


def _validated_status(value: Any) -> str:
    status = str(value or "").strip()
    if status not in VALID_ORDER_STATUSES:
        valid = ", ".join(sorted(VALID_ORDER_STATUSES))
        raise ValidationError(f"Status de pedido inválido. Use um de: {valid}.")
    return status


def _validated_staff_status(value: Any) -> str:
    status = str(value or "").strip()
    if status not in STAFF_ORDER_STATUSES:
        valid = ", ".join(sorted(STAFF_ORDER_STATUSES))
        raise ValidationError(f"Status de pedido inválido para equipe. Use um de: {valid}.")
    return status


def _sync_completion_fields(order: Any, status: str) -> None:
    now = datetime.now(timezone.utc)

    if status == "concluido":
        if getattr(order, "completed_at", None) is None:
            order.completed_at = now
    else:
        # completed_at represents the currently concluded state, so reopening or
        # cancelling an order clears it instead of keeping a stale completion date.
        order.completed_at = None

    if hasattr(order, "updated_at"):
        order.updated_at = now


def install_admin_order_status_patch() -> None:
    from app.modules.admin import routes as admin_routes
    from app.modules.staff import routes as staff_routes
    from app.services import admin_service
    from app.services import staff_service

    if not getattr(admin_routes, _PATCH_INSTALLED_ATTR, False):
        original_update: Callable[[Any, Any, dict[str, Any]], dict[str, Any]] = getattr(
            admin_routes, "update_admin_order"
        )

        def update_admin_order(actor: Any, order_id: Any, payload: dict[str, Any] | None) -> dict[str, Any]:
            normalized = _normalize_admin_order_payload(payload)
            if "status" not in normalized:
                return original_update(actor, order_id, normalized)

            status = _validated_status(normalized.get("status"))
            remaining_payload = dict(normalized)
            remaining_payload.pop("status", None)

            if remaining_payload:
                original_update(actor, order_id, remaining_payload)

            order = admin_service._scoped_order(actor, order_id)
            order.status = status
            _sync_completion_fields(order, status)
            log_action(
                action="admin.order_status_updated",
                entity_type="service_order",
                entity_id=order.id,
                user=actor,
                metadata={"status": status},
            )
            db.session.commit()

            return {"order": admin_service._serialize_order(order)}

        setattr(admin_routes, _ORIGINAL_UPDATE_ATTR, original_update)
        admin_routes.update_admin_order = update_admin_order
        setattr(admin_routes, _PATCH_INSTALLED_ATTR, True)

    if getattr(staff_routes, _STAFF_PATCH_INSTALLED_ATTR, False):
        return

    original_staff_update: Callable[[Any, Any, dict[str, Any]], dict[str, Any]] = getattr(
        staff_routes, "update_staff_order"
    )

    def update_staff_order(actor: Any, order_id: Any, payload: dict[str, Any] | None) -> dict[str, Any]:
        normalized = dict(payload or {})
        if "status" not in normalized:
            return original_staff_update(actor, order_id, normalized)

        status = _validated_staff_status(normalized.get("status"))
        order = staff_service._scoped_staff_order(actor, order_id)
        order.status = status
        _sync_completion_fields(order, status)
        log_action(
            action="staff.order_status_updated",
            entity_type="service_order",
            entity_id=order.id,
            user=actor,
            metadata={"status": status},
        )
        db.session.commit()

        return {"order": staff_service.serialize_order(order)}

    setattr(staff_routes, _ORIGINAL_STAFF_UPDATE_ATTR, original_staff_update)
    staff_routes.update_staff_order = update_staff_order
    setattr(staff_routes, _STAFF_PATCH_INSTALLED_ATTR, True)
