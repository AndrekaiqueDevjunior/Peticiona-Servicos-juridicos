from __future__ import annotations

from flask import Flask
from werkzeug.middleware.proxy_fix import ProxyFix

from app.bootstrap.migrations import run_runtime_migrations
from app.bootstrap.seed import seed_reference_data
from app.core.config import Config
from app.core.errors import register_error_handlers
from app.core.extensions import cors, db
from app.modules import register_blueprints


def create_app(config_overrides: dict | None = None) -> Flask:
    app = Flask(__name__)
    # Trust one level of reverse proxy (nginx) so that request.remote_addr
    # reflects the real client IP — required for per-user rate limiting.
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

    app.config.from_object(Config())
    if config_overrides:
        app.config.update(config_overrides)
        if "JWT_SECRET" not in config_overrides and "SECRET_KEY" in config_overrides:
            app.config["JWT_SECRET"] = app.config["SECRET_KEY"]

    db.init_app(app)
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ALLOWED_ORIGINS"]}},
        supports_credentials=False,
    )

    register_error_handlers(app)
    register_blueprints(app)

    with app.app_context():
        db.create_all()
        run_runtime_migrations()
        seed_reference_data()

    return app
