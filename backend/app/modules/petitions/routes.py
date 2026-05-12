from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.permissions import auth_required, current_actor
from app.services.petition_service import create_petition, list_petitions

petitions_bp = Blueprint("petitions", __name__, url_prefix="/api/petitions")


@petitions_bp.get("")
@auth_required
def petitions_index():
    return jsonify(list_petitions(current_actor()))


@petitions_bp.post("")
@auth_required
def petitions_create():
    return jsonify(create_petition(current_actor(), request.get_json(silent=True) or {})), 201
