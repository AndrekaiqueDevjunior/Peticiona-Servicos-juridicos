from __future__ import annotations

from flask import Flask

from app.modules.admin.routes import admin_bp
from app.modules.contact.routes import contact_bp
from app.modules.auth.routes import auth_bp
from app.modules.checkout.routes import checkout_bp
from app.modules.client_area.routes import client_area_bp
from app.modules.comments.routes import comments_bp
from app.modules.content.routes import content_bp
from app.modules.dashboard.routes import dashboard_bp
from app.modules.documents.routes import documents_bp
from app.modules.health.routes import health_bp
from app.modules.me.routes import me_bp
from app.modules.notifications.routes import notifications_bp
from app.modules.payments.routes import payments_bp
from app.modules.petitions.routes import petitions_bp
from app.modules.split_payment.routes import split_payment_bp
from app.modules.staff.routes import staff_bp
from app.modules.webhooks.routes import webhooks_bp


def register_blueprints(app: Flask) -> None:
    for blueprint in (
        health_bp,
        contact_bp,
        content_bp,
        client_area_bp,
        split_payment_bp,
        admin_bp,
        staff_bp,
        auth_bp,
        me_bp,
        checkout_bp,
        payments_bp,
        webhooks_bp,
        dashboard_bp,
        petitions_bp,
        notifications_bp,
        documents_bp,
        comments_bp,
    ):
        app.register_blueprint(blueprint)
