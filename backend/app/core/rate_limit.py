from __future__ import annotations

import time
from collections import defaultdict, deque
from functools import wraps

from flask import current_app, request

from app.core.errors import RateLimitExceeded

_REQUEST_BUCKETS: dict[str, deque[float]] = defaultdict(deque)


def limit_requests(bucket: str):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            limit = current_app.config["AUTH_RATE_LIMIT"]
            window = current_app.config["AUTH_RATE_WINDOW_SECONDS"]
            now = time.monotonic()
            key = f"{bucket}:{request.remote_addr or 'unknown'}"
            queue = _REQUEST_BUCKETS[key]

            while queue and now - queue[0] > window:
                queue.popleft()

            if len(queue) >= limit:
                raise RateLimitExceeded("Muitas tentativas. Aguarde alguns instantes.")

            queue.append(now)
            return func(*args, **kwargs)

        return wrapper

    return decorator
