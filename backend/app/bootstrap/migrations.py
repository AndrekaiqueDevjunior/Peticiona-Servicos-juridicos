from __future__ import annotations

from sqlalchemy import inspect, text

from app.core.extensions import db


def _column_names(table_name: str) -> set[str]:
    inspector = inspect(db.engine)
    if table_name not in inspector.get_table_names():
        return set()
    return {column["name"] for column in inspector.get_columns(table_name)}


def _execute(sql: str) -> None:
    db.session.execute(text(sql))


def _add_user_columns() -> None:
    user_columns = _column_names("users")
    statements = {
        "cpf": "ALTER TABLE users ADD COLUMN cpf VARCHAR(20)",
        "phone": "ALTER TABLE users ADD COLUMN phone VARCHAR(30)",
        "role_title": "ALTER TABLE users ADD COLUMN role_title VARCHAR(120)",
        "employee_code": "ALTER TABLE users ADD COLUMN employee_code VARCHAR(40)",
        "zip_code": "ALTER TABLE users ADD COLUMN zip_code VARCHAR(12)",
        "street": "ALTER TABLE users ADD COLUMN street VARCHAR(180)",
        "street_number": "ALTER TABLE users ADD COLUMN street_number VARCHAR(20)",
        "address_complement": "ALTER TABLE users ADD COLUMN address_complement VARCHAR(120)",
        "neighborhood": "ALTER TABLE users ADD COLUMN neighborhood VARCHAR(120)",
        "city": "ALTER TABLE users ADD COLUMN city VARCHAR(120)",
        "state": "ALTER TABLE users ADD COLUMN state VARCHAR(2)",
    }

    for column_name, sql in statements.items():
        if column_name not in user_columns:
            _execute(sql)


def _add_service_order_columns() -> None:
    order_columns = _column_names("service_orders")
    ts = "TIMESTAMP WITH TIME ZONE" if db.engine.dialect.name == "postgresql" else "DATETIME"
    statements = {
        "staff_user_id": "ALTER TABLE service_orders ADD COLUMN staff_user_id INTEGER",
        "deadline_at": f"ALTER TABLE service_orders ADD COLUMN deadline_at {ts}",
        "completed_at": f"ALTER TABLE service_orders ADD COLUMN completed_at {ts}",
        "split_plataforma": "ALTER TABLE service_orders ADD COLUMN split_plataforma INTEGER NOT NULL DEFAULT 100",
        "split_funcionario": "ALTER TABLE service_orders ADD COLUMN split_funcionario INTEGER NOT NULL DEFAULT 0",
    }

    for column_name, sql in statements.items():
        if column_name not in order_columns:
            _execute(sql)


def _create_financial_entries_table() -> None:
    existing_tables = inspect(db.engine).get_table_names()
    if "financial_entries" in existing_tables:
        return

    if db.engine.dialect.name == "postgresql":
        _execute(
            """
            CREATE TABLE financial_entries (
                id SERIAL PRIMARY KEY,
                description VARCHAR(255) NOT NULL,
                kind VARCHAR(10) NOT NULL DEFAULT 'credit',
                amount_cents INTEGER NOT NULL,
                occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
                order_id INTEGER,
                created_by_user_id INTEGER,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
                company_id INTEGER,
                FOREIGN KEY(order_id) REFERENCES service_orders(id),
                FOREIGN KEY(created_by_user_id) REFERENCES users(id),
                FOREIGN KEY(company_id) REFERENCES companies(id)
            )
            """
        )
        return

    _execute(
        """
        CREATE TABLE financial_entries (
            id INTEGER PRIMARY KEY,
            description VARCHAR(255) NOT NULL,
            kind VARCHAR(10) NOT NULL DEFAULT 'credit',
            amount_cents INTEGER NOT NULL,
            occurred_at DATETIME NOT NULL,
            order_id INTEGER,
            created_by_user_id INTEGER,
            is_active BOOLEAN NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            company_id INTEGER,
            FOREIGN KEY(order_id) REFERENCES service_orders(id),
            FOREIGN KEY(created_by_user_id) REFERENCES users(id),
            FOREIGN KEY(company_id) REFERENCES companies(id)
        )
        """
    )


def run_runtime_migrations() -> None:
    _add_user_columns()
    _add_service_order_columns()
    _create_financial_entries_table()
    db.session.commit()
