from __future__ import annotations

from app.domain.permissions import scoped_query
from app.models import ServiceOrder
from app.services.serializers import format_brl_from_cents, serialize_order


def _dashboard_payload(*, user_label: str, role: str, selected_filter: str, services: list[dict]) -> dict:
    counts = {"pendente": 0, "em_andamento": 0, "concluido": 0}
    for service in services:
        counts[service["status"]] = counts.get(service["status"], 0) + 1

    return {
        "user": {"name": user_label, "role": role},
        "selected_filter": selected_filter,
        "filters": [
            {"value": "todos", "label": "Todos"},
            {"value": "pendente", "label": "Pendentes"},
            {"value": "em_andamento", "label": "Em andamento"},
            {"value": "concluido", "label": "Concluídos"},
        ],
        "stats": {
            "pendente": counts.get("pendente", 0),
            "em_andamento": counts.get("em_andamento", 0),
            "concluido": counts.get("concluido", 0),
            "revenue_brl": format_brl_from_cents(0),
        },
        "services": services,
    }


def get_dashboard(*, user=None, status: str | None = None) -> dict:
    selected_filter = status or "todos"
    if user is None:
        return _dashboard_payload(
            user_label="Visitante",
            role="guest",
            selected_filter=selected_filter,
            services=[],
        )

    base_query = scoped_query(ServiceOrder, user).order_by(ServiceOrder.created_at.desc())
    visible_orders = base_query.all()
    filtered_orders = [item for item in visible_orders if status in (None, "todos", item.status)]

    services = [
        {
            "reference": item["reference"],
            "title": item["service_type"],
            "client_name": item["client_name"] or user.full_name,
            "status": item["status"],
            "status_label": item["status_label"],
            "deadline": (
                filtered_order.deadline_at.strftime("%d/%m/%Y")
                if filtered_order.deadline_at
                else filtered_order.created_at.strftime("%d/%m/%Y")
            ),
            "service_type": item["service_type"],
            "value_brl": item["total_brl"],
        }
        for filtered_order, item in ((order, serialize_order(order)) for order in filtered_orders)
    ]

    return _dashboard_payload(
        user_label=user.full_name,
        role=user.role,
        selected_filter=selected_filter,
        services=services,
    )
