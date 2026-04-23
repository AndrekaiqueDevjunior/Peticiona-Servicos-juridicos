from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.modules.split_payment.schemas import load_split_preview_payload
from app.services.split_payment_service import get_split_payment_seed, preview_split_payment

split_payment_bp = Blueprint("split_payment", __name__, url_prefix="/api/split-payment")


@split_payment_bp.get("")
def split_payment_seed():
    return jsonify(get_split_payment_seed())


@split_payment_bp.post("/preview")
def split_payment_preview():
    payload = load_split_preview_payload(request.get_json(silent=True))
    return jsonify(preview_split_payment(payload))
