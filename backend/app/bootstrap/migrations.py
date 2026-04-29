from __future__ import annotations

from sqlalchemy import inspect, text

from app.core.extensions import db


def _inspector():
    return inspect(db.session.connection())


def _table_names() -> set[str]:
    return set(_inspector().get_table_names())


def _acquire_runtime_migrations_lock() -> None:
    """Ensure runtime migrations run in a single process at a time.

    In production we may have multiple workers starting simultaneously (gunicorn,
    multiple containers, etc.). Since these migrations run at app startup, we
    must protect DDL + backfills from concurrent execution.
    """
    if db.engine.dialect.name != "postgresql":
        return

    # Transaction-scoped advisory lock. Released automatically on commit/rollback.
    _execute("SELECT pg_advisory_xact_lock(784231337)")


def _column_names(table_name: str) -> set[str]:
    inspector = _inspector()
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
        "petition_id": "ALTER TABLE service_orders ADD COLUMN petition_id INTEGER",
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
    existing_tables = _table_names()
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


def _create_terms_acceptances_table() -> None:
    existing_tables = _table_names()
    if "terms_acceptances" in existing_tables:
        return

    if db.engine.dialect.name == "postgresql":
        _execute(
            """
            CREATE TABLE terms_acceptances (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                company_id INTEGER REFERENCES companies(id),
                version VARCHAR(40) NOT NULL,
                text_hash VARCHAR(128) NOT NULL,
                accepted_at TIMESTAMP WITH TIME ZONE NOT NULL,
                ip_address VARCHAR(64),
                user_agent VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
                CONSTRAINT uq_terms_acceptance_user_version_hash UNIQUE (user_id, version, text_hash)
            )
            """
        )
        return

    _execute(
        """
        CREATE TABLE terms_acceptances (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            company_id INTEGER,
            version VARCHAR(40) NOT NULL,
            text_hash VARCHAR(128) NOT NULL,
            accepted_at DATETIME NOT NULL,
            ip_address VARCHAR(64),
            user_agent VARCHAR(255),
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            CONSTRAINT uq_terms_acceptance_user_version_hash UNIQUE (user_id, version, text_hash),
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(company_id) REFERENCES companies(id)
        )
        """
    )


def _backfill_petition_service_orders() -> None:
    existing_tables = _table_names()
    if {"petitions", "service_orders", "service_order_items"} - existing_tables:
        return
    if "petition_id" not in _column_names("service_orders"):
        return

    if db.engine.dialect.name == "postgresql":
        reference_expr = "'ORD-PET-' || p.id::text"
        fallback_reference_expr = "'ORD-PET-' || so.petition_id::text"
        now_expr = "NOW()"
        order_insert_prefix = "INSERT INTO"
        # Use generic conflict handling to avoid failing if the legacy schema
        # missed a specific unique index definition.
        order_insert_suffix = "ON CONFLICT DO NOTHING"
    else:
        reference_expr = "'ORD-PET-' || CAST(p.id AS TEXT)"
        fallback_reference_expr = "'ORD-PET-' || CAST(so.petition_id AS TEXT)"
        now_expr = "CURRENT_TIMESTAMP"
        # SQLite supports INSERT OR IGNORE for conflict handling.
        order_insert_prefix = "INSERT OR IGNORE INTO"
        order_insert_suffix = ""

    _execute(
        f"""
        {order_insert_prefix} service_orders (
            user_id, petition_id, company_id, reference, status, total_amount,
            deadline_at, completed_at, split_plataforma, split_funcionario,
            created_at, updated_at
        )
        SELECT
            p.user_id,
            p.id,
            p.company_id,
            {reference_expr},
            p.status,
            0,
            NULL,
            NULL,
            100,
            0,
            COALESCE(p.created_at, {now_expr}),
            COALESCE(p.updated_at, {now_expr})
        FROM petitions p
        WHERE NOT EXISTS (
            SELECT 1 FROM service_orders so WHERE so.petition_id = p.id
        )
        AND NOT EXISTS (
            SELECT 1 FROM service_orders so WHERE so.reference = {reference_expr}
        )
        {order_insert_suffix}
        """
    )
    _execute(
        f"""
        INSERT INTO service_order_items (
            order_id, company_id, code, title, quantity, unit_price, line_total,
            created_at, updated_at
        )
        SELECT
            so.id,
            so.company_id,
            'petition',
            COALESCE(p.tipo_peticao, p.area_direito, 'Petição'),
            1,
            0,
            0,
            COALESCE(so.created_at, {now_expr}),
            COALESCE(so.updated_at, {now_expr})
        FROM service_orders so
        JOIN petitions p ON p.id = so.petition_id
        WHERE so.reference = {fallback_reference_expr}
        AND NOT EXISTS (
            SELECT 1 FROM service_order_items item WHERE item.order_id = so.id
        )
        """
    )


def _fix_legacy_schema() -> None:
    """Corrige schema legado (Lovable) para o novo modelo."""
    if db.engine.dialect.name != "postgresql":
        return

    order_cols = _column_names("service_orders")
    item_cols = _column_names("service_order_items")
    petition_cols = _column_names("petitions")

    # service_orders — colunas novas
    for col, ddl in {
        "total_amount": "ALTER TABLE service_orders ADD COLUMN total_amount INTEGER NOT NULL DEFAULT 0",
        "company_id": "ALTER TABLE service_orders ADD COLUMN company_id INTEGER REFERENCES companies(id)",
        "updated_at": "ALTER TABLE service_orders ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE",
    }.items():
        if col not in order_cols:
            _execute(ddl)

    # service_orders — tornar colunas legadas nullable
    if "requester_name" in order_cols:
        _execute("ALTER TABLE service_orders ALTER COLUMN requester_name DROP NOT NULL")
    if "deadline" in order_cols:
        _execute("ALTER TABLE service_orders ALTER COLUMN deadline DROP NOT NULL")

    # service_order_items — colunas novas
    for col, ddl in {
        "code": "ALTER TABLE service_order_items ADD COLUMN code VARCHAR(80)",
        "title": "ALTER TABLE service_order_items ADD COLUMN title VARCHAR(200)",
        "unit_price": "ALTER TABLE service_order_items ADD COLUMN unit_price INTEGER NOT NULL DEFAULT 0",
        "line_total": "ALTER TABLE service_order_items ADD COLUMN line_total INTEGER NOT NULL DEFAULT 0",
        "company_id": "ALTER TABLE service_order_items ADD COLUMN company_id INTEGER REFERENCES companies(id)",
        "created_at": "ALTER TABLE service_order_items ADD COLUMN created_at TIMESTAMP WITH TIME ZONE",
        "updated_at": "ALTER TABLE service_order_items ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE",
    }.items():
        if col not in item_cols:
            _execute(ddl)

    # service_order_items — tornar colunas legadas nullable
    for col in ("service_code", "service_name", "unit_price_cents", "line_total_cents"):
        if col in item_cols:
            _execute(f"ALTER TABLE service_order_items ALTER COLUMN {col} DROP NOT NULL")

    # petitions — tornar opcionais
    for col in ("advogado_subscritor", "resumo_caso", "detalhes"):
        if col in petition_cols:
            _execute(f"ALTER TABLE petitions ALTER COLUMN {col} DROP NOT NULL")


def run_runtime_migrations() -> None:
    _acquire_runtime_migrations_lock()
    _add_user_columns()
    _add_service_order_columns()
    _create_financial_entries_table()
    _create_terms_acceptances_table()
    _backfill_petition_service_orders()
    _fix_legacy_schema()
    db.session.commit()
