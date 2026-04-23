from __future__ import annotations

from app.domain.permissions import scoped_query
from app.models import Petition
from app.services.serializers import format_brl_from_cents


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

    base_query = scoped_query(Petition, user).order_by(Petition.created_at.desc())
    visible_petitions = base_query.all()
    filtered_petitions = [item for item in visible_petitions if status in (None, "todos", item.status)]

    services = [
        {
            "reference": petition.reference,
            "title": petition.tipo_peticao or petition.area_direito,
            "client_name": petition.user.full_name,
            "status": petition.status,
            "status_label": petition.status.replace("_", " ").capitalize(),
            "deadline": petition.created_at.strftime("%d/%m/%Y"),
            "service_type": petition.area_direito,
            "value_brl": format_brl_from_cents(0),
        }
        for petition in filtered_petitions
    ]

    return _dashboard_payload(
        user_label=user.full_name,
        role=user.role,
        selected_filter=selected_filter,
        services=services,
    )
