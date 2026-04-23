from __future__ import annotations

from flask import Blueprint, jsonify

from app.services.content_service import get_home_content, get_plans_catalog

content_bp = Blueprint("content", __name__, url_prefix="/api")


@content_bp.get("/home")
def home():
    return jsonify(get_home_content())


@content_bp.get("/plans")
def plans():
    return jsonify(get_plans_catalog())
