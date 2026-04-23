from __future__ import annotations

from http import HTTPStatus

from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException

from app.core.extensions import db


class AppError(Exception):
    status_code = HTTPStatus.BAD_REQUEST
    error_code = "BAD_REQUEST"

    def __init__(self, message: str, *, details: dict | list | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details


class ValidationError(AppError):
    error_code = "VALIDATION_ERROR"


class AuthError(AppError):
    status_code = HTTPStatus.UNAUTHORIZED
    error_code = "AUTH_REQUIRED"


class PermissionDenied(AppError):
    status_code = HTTPStatus.FORBIDDEN
    error_code = "PERMISSION_DENIED"


class NotFoundError(AppError):
    status_code = HTTPStatus.NOT_FOUND
    error_code = "NOT_FOUND"


class ConflictError(AppError):
    status_code = HTTPStatus.CONFLICT
    error_code = "CONFLICT"


class RateLimitExceeded(AppError):
    status_code = HTTPStatus.TOO_MANY_REQUESTS
    error_code = "RATE_LIMIT_EXCEEDED"


class PlanLimitExceeded(AppError):
    status_code = HTTPStatus.UNPROCESSABLE_ENTITY
    error_code = "PLAN_LIMIT_EXCEEDED"


def _payload(error: str, message: str, details: dict | list | None = None) -> tuple[dict, int]:
    response = {"error": error, "message": message}
    if details is not None:
        response["details"] = details
    return response, 0


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(AppError)
    def handle_app_error(exc: AppError):
        db.session.rollback()
        payload, _ = _payload(exc.error_code, exc.message, exc.details)
        return jsonify(payload), int(exc.status_code)

    @app.errorhandler(HTTPException)
    def handle_http_error(exc: HTTPException):
        db.session.rollback()
        payload, _ = _payload(exc.name.upper().replace(" ", "_"), exc.description)
        return jsonify(payload), exc.code

    @app.errorhandler(Exception)
    def handle_unexpected_error(exc: Exception):
        db.session.rollback()
        if app.config.get("TESTING"):
            raise exc
        payload, _ = _payload("INTERNAL_ERROR", "Erro interno inesperado.")
        return jsonify(payload), HTTPStatus.INTERNAL_SERVER_ERROR
