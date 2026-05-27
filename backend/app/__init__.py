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

    # Configuração CORS segura para produção
    cors_origins = app.config.get("CORS_ALLOWED_ORIGINS", [])
    if cors_origins:
        cors.init_app(app, origins=cors_origins, supports_credentials=True)
    else:
        # Fallback seguro - apenas localhost em desenvolvimento
        if app.config.get("DEBUG", True):
            cors.init_app(app, origins=["http://localhost:3000", "http://localhost:8080"], supports_credentials=True)
        else:
            raise ValueError("CORS_ALLOWED_ORIGINS não configurado para produção")

    db.init_app(app)
    register_error_handlers(app)
    install_admin_order_status_patch()
    register_blueprints(app)
    
    # Adiciona headers de segurança
    @app.after_request
    def add_security_headers(response):
        # Headers básicos de segurança
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response.headers['Permissions-Policy'] = (
            "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
        )

        # Em produção com HTTPS
        if not app.config.get("DEBUG", True):
            response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
            
            # Content Security Policy
            csp = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: https:; "
                "font-src 'self'; "
                "connect-src 'self'; "
                "frame-ancestors 'none'; "
                "base-uri 'self'; "
                "form-action 'self'"
            )
            response.headers['Content-Security-Policy'] = csp
        
        return response

    with app.app_context():
        db.create_all()
        run_runtime_migrations()
        seed_reference_data()

    return app

__all__ = ["create_app"]
