from __future__ import annotations

import time
from collections import defaultdict, deque
from functools import wraps

from flask import current_app, g, request

from app.core.errors import RateLimitExceeded

_REQUEST_BUCKETS: dict[str, deque[float]] = defaultdict(deque)


def _actor_key() -> str:
    """Retorna user_id se autenticado, caso contrário IP. Impede bypass via múltiplos workers."""
    user = getattr(g, "current_user", None)
    if user is not None:
        return f"uid:{user.id}"
    ip = (request.headers.get("X-Forwarded-For") or request.remote_addr or "unknown").split(",")[0].strip()
    return f"ip:{ip}"


def limit_requests(bucket: str, limit: int | None = None, window: int | None = None):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            _limit = limit if limit is not None else current_app.config["AUTH_RATE_LIMIT"]
            _window = window if window is not None else current_app.config["AUTH_RATE_WINDOW_SECONDS"]
            now = time.monotonic()
            key = f"{bucket}:{_actor_key()}"
            queue = _REQUEST_BUCKETS[key]

            while queue and now - queue[0] > _window:
                queue.popleft()

            if len(queue) >= _limit:
                raise RateLimitExceeded("Muitas tentativas. Aguarde alguns instantes.")

            queue.append(now)
            return func(*args, **kwargs)

        return wrapper

    return decorator
