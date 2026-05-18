"""Factories de dados para os testes.

Cada factory cria entidades mínimas e independentes. Nada é compartilhado
entre testes — chame a factory dentro de cada teste/fixture que precisa.
"""

from tests.factories.users import (
    UserFactory,
    create_admin,
    create_client,
    create_staff,
)
from tests.factories.business import (
    create_credit_purchase,
    create_credit_transaction,
    create_document,
    create_financial_entry,
    create_petition,
    create_plan,
    create_service_catalog_item,
    create_service_order,
)

__all__ = [
    "UserFactory",
    "create_admin",
    "create_client",
    "create_credit_purchase",
    "create_credit_transaction",
    "create_document",
    "create_financial_entry",
    "create_petition",
    "create_plan",
    "create_service_catalog_item",
    "create_service_order",
    "create_staff",
]
