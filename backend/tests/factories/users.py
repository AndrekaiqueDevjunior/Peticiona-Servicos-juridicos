"""Factories para criar usuários (admin, staff, client) e companies."""

from __future__ import annotations

from itertools import count
from typing import Any

from app.core.extensions import db
from app.core.security import hash_password
from app.models import Company, User

_id_seq = count(1)


def _next_seq() -> int:
    return next(_id_seq)


def _ensure_company(company: Company | None = None) -> Company:
    if company is not None:
        return company
    existing = Company.query.first()
    if existing is not None:
        return existing
    seq = _next_seq()
    company = Company(name=f"Test Company {seq}", slug=f"test-company-{seq}")
    db.session.add(company)
    db.session.flush()
    return company


class UserFactory:
    """Cria um `User` com defaults razoáveis. Persiste no banco e devolve o objeto."""

    DEFAULT_PASSWORD = "Senha@123"

    @classmethod
    def create(
        cls,
        *,
        role: str = "client",
        email: str | None = None,
        full_name: str | None = None,
        password: str | None = None,
        is_active: bool = True,
        company: Company | None = None,
        oab_number: str | None = None,
        cpf: str | None = None,
        phone: str | None = None,
        employee_code: str | None = None,
        role_title: str | None = None,
        **extra: Any,
    ) -> User:
        seq = _next_seq()
        comp = _ensure_company(company)
        if role == "client":
            default_email = f"client{seq}@example.com"
            default_name = f"Cliente Teste {seq}"
        elif role == "staff":
            default_email = f"staff{seq}@example.com"
            default_name = f"Staff Teste {seq}"
        elif role == "admin":
            default_email = f"admin{seq}@example.com"
            default_name = f"Admin Teste {seq}"
        else:
            default_email = f"user{seq}@example.com"
            default_name = f"User Teste {seq}"

        user = User(
            full_name=full_name or default_name,
            email=(email or default_email).lower(),
            password_hash=hash_password(password or cls.DEFAULT_PASSWORD),
            role=role,
            is_active=is_active,
            company_id=comp.id,
            oab_number=oab_number,
            cpf=cpf,
            phone=phone,
            employee_code=employee_code,
            role_title=role_title,
            **extra,
        )
        db.session.add(user)
        db.session.flush()
        return user


# Atalhos ergonômicos --------------------------------------------------------


def create_admin(**kwargs: Any) -> User:
    return UserFactory.create(role="admin", **kwargs)


def create_staff(**kwargs: Any) -> User:
    return UserFactory.create(role="staff", **kwargs)


def create_client(**kwargs: Any) -> User:
    return UserFactory.create(role="client", **kwargs)
