from gevent import monkey
monkey.patch_all()

worker_class = "gevent"
workers = 2
worker_connections = 200
bind = "0.0.0.0:5000"
timeout = 60
keepalive = 5
preload_app = False


def post_fork(server, worker):
    """Descarta conexões herdadas do processo pai para evitar compartilhamento entre workers."""
    try:
        from app.core.extensions import db
        db.engine.dispose()
    except Exception:
        pass
