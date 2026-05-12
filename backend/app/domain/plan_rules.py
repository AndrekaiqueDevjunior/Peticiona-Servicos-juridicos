from __future__ import annotations

from datetime import datetime, timezone

from app.core.errors import PlanLimitExceeded
from app.models import Petition


def ensure_plan_allows_new_petition(user) -> None:
    plan = getattr(user, "active_plan", None)
    if plan is None or plan.petition_limit_monthly is None:
        return

    now = datetime.now(timezone.utc)
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    month_count = (
        Petition.query.filter(Petition.user_id == user.id, Petition.created_at >= start).count()
    )
    if month_count >= plan.petition_limit_monthly:
        raise PlanLimitExceeded(
            "Seu plano atingiu o limite mensal de petições.",
            details={
                "plan": plan.code,
                "petition_limit_monthly": plan.petition_limit_monthly,
            },
        )
