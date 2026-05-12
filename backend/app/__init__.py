from __future__ import annotations

from flask import Flask
from werkzeug.middleware.proxy_fix import ProxyFix

from ._pyc_importer import install_pyc_finder

install_pyc_finder()

from app.bootstrap.migrations import run_runtime_migrations
from app.bootstrap.seed import seed_reference_data
from app.core.config import Config
from app.core.errors import register_error_handlers
from app.core.extensions import cors, db
from app.modules import register_blueprints
from app.services.admin_order_status_patch import install_admin_order_status_patch


def create_app(config_overrides: dict | None = None) -> Flask:
    app = Flask(__name__)
    app.wsgi_app = ProxyFix(app.wsgi_app)
    app.config.from_object(Config)

    if config_overrides:
        app.config.update(config_overrides)

    db.init_app(app)
    cors.init_app(app)
    register_error_handlers(app)
    install_admin_order_status_patch()
    register_blueprints(app)

    with app.app_context():
        db.create_all()
        run_runtime_migrations()
        seed_reference_data()

    return app

__all__ = ["create_app"]
