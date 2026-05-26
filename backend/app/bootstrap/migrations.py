from __future__ import annotations

import logging

from sqlalchemy import inspect, text

from app.core.extensions import db

logger = logging.getLogger(__name__)


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
    ts = "TIMESTAMP WITH TIME ZONE" if db.engine.dialect.name == "postgresql" else "DATETIME"
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
        # Lockout por brute-force no login. Default 0 cobre usuários
        # legados que nunca tiveram falha registrada.
        "failed_login_attempts": "ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0",
        "locked_until": f"ALTER TABLE users ADD COLUMN locked_until {ts}",
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
        "express_upgrade": "ALTER TABLE service_orders ADD COLUMN express_upgrade BOOLEAN NOT NULL DEFAULT FALSE",
        "express_order_id": "ALTER TABLE service_orders ADD COLUMN express_order_id INTEGER",
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


def _create_order_comments_table() -> None:
    if "order_comments" in _table_names():
        return

    if db.engine.dialect.name == "postgresql":
        _execute("""
            CREATE TABLE order_comments (
                id SERIAL PRIMARY KEY,
                order_id INTEGER NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
                author_id INTEGER NOT NULL REFERENCES users(id),
                author_name VARCHAR(160) NOT NULL,
                author_role VARCHAR(20) NOT NULL,
                text TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )
        """)
    else:
        _execute("""
            CREATE TABLE order_comments (
                id INTEGER PRIMARY KEY,
                order_id INTEGER NOT NULL,
                author_id INTEGER NOT NULL,
                author_name VARCHAR(160) NOT NULL,
                author_role VARCHAR(20) NOT NULL,
                text TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                FOREIGN KEY(order_id) REFERENCES service_orders(id) ON DELETE CASCADE,
                FOREIGN KEY(author_id) REFERENCES users(id)
            )
        """)
    _execute("CREATE INDEX ix_order_comments_order_id ON order_comments(order_id)")


def _add_credit_transaction_unique_constraint() -> None:
    if db.engine.dialect.name != "postgresql":
        return
    index_exists = db.session.execute(text(
        "SELECT 1 FROM pg_indexes WHERE indexname = 'uq_credit_transactions_release'"
    )).fetchone()
    if index_exists:
        return
    # Remove duplicatas mantendo o registro mais antigo antes de criar o índice.
    _execute("""
        DELETE FROM credit_transactions
        WHERE id NOT IN (
            SELECT MIN(id) FROM credit_transactions
            WHERE source IS NOT NULL
            GROUP BY user_id, source, description
        ) AND source IS NOT NULL
    """)
    _execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_transactions_release
        ON credit_transactions (user_id, source, description)
        WHERE source IS NOT NULL
    """)


def _add_plan_columns() -> None:
    plan_columns = _column_names("plans")
    statements = {
        "price_per_service_cents": "ALTER TABLE plans ADD COLUMN price_per_service_cents INTEGER",
        "features_json": "ALTER TABLE plans ADD COLUMN features_json TEXT",
        "is_highlighted": "ALTER TABLE plans ADD COLUMN is_highlighted BOOLEAN NOT NULL DEFAULT FALSE",
        "cta_label": "ALTER TABLE plans ADD COLUMN cta_label VARCHAR(80)",
        "subtitle": "ALTER TABLE plans ADD COLUMN subtitle VARCHAR(255)",
        "credits_quantity": "ALTER TABLE plans ADD COLUMN credits_quantity INTEGER",
        "validity_days": "ALTER TABLE plans ADD COLUMN validity_days INTEGER",
        "delivery_label": "ALTER TABLE plans ADD COLUMN delivery_label VARCHAR(120)",
        "badge": "ALTER TABLE plans ADD COLUMN badge VARCHAR(80)",
        "sort_order": "ALTER TABLE plans ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0",
    }
    for column_name, sql in statements.items():
        if column_name not in plan_columns:
            _execute(sql)


def _add_service_catalog_item_columns() -> None:
    if "service_catalog_items" not in _table_names():
        return
    service_columns = _column_names("service_catalog_items")
    statements = {
        "delivery_label": "ALTER TABLE service_catalog_items ADD COLUMN delivery_label VARCHAR(80)",
    }
    for column_name, sql in statements.items():
        if column_name not in service_columns:
            _execute(sql)


def _add_audit_log_columns() -> None:
    if "audit_logs" not in _table_names():
        return
    audit_columns = _column_names("audit_logs")
    if db.engine.dialect.name == "postgresql":
        metadata_type = "JSONB NOT NULL DEFAULT '{}'::jsonb"
    else:
        metadata_type = "JSON NOT NULL DEFAULT '{}'"
    statements = {
        "actor_role": "ALTER TABLE audit_logs ADD COLUMN actor_role VARCHAR(20)",
        "ip_address": "ALTER TABLE audit_logs ADD COLUMN ip_address VARCHAR(45)",
        "user_agent": "ALTER TABLE audit_logs ADD COLUMN user_agent TEXT",
        "status": "ALTER TABLE audit_logs ADD COLUMN status VARCHAR(20) DEFAULT 'success'",
        "metadata_json": f"ALTER TABLE audit_logs ADD COLUMN metadata_json {metadata_type}",
    }
    for column_name, sql in statements.items():
        if column_name not in audit_columns:
            _execute(sql)


def _add_petition_columns() -> None:
    """Garante colunas opcionais (competencia/comarca_uf) na tabela petitions."""
    if "petitions" not in _table_names():
        return
    columns = _column_names("petitions")
    statements = {
        "competencia": "ALTER TABLE petitions ADD COLUMN competencia VARCHAR(160)",
        "comarca_uf": "ALTER TABLE petitions ADD COLUMN comarca_uf VARCHAR(120)",
    }
    for name, sql in statements.items():
        if name not in columns:
            _execute(sql)


def _fix_petition_document_links_timestamps() -> None:
    """Corrige created_at e updated_at null em petition_document_links."""
    if "petition_document_links" not in _table_names():
        return

    link_columns = _column_names("petition_document_links")
    ts = "TIMESTAMP WITH TIME ZONE" if db.engine.dialect.name == "postgresql" else "DATETIME"
    now_expr = "NOW()" if db.engine.dialect.name == "postgresql" else "CURRENT_TIMESTAMP"

    # Adiciona colunas se não existirem
    for col in ("created_at", "updated_at"):
        if col not in link_columns:
            _execute(f"ALTER TABLE petition_document_links ADD COLUMN {col} {ts}")

    # Backfill valores null
    if db.engine.dialect.name == "postgresql":
        _execute(f"""
            UPDATE petition_document_links
            SET created_at = COALESCE(created_at, {now_expr}),
                updated_at = COALESCE(updated_at, {now_expr})
            WHERE created_at IS NULL OR updated_at IS NULL
        """)
    else:
        _execute(f"""
            UPDATE petition_document_links
            SET created_at = COALESCE(created_at, {now_expr}),
                updated_at = COALESCE(updated_at, {now_expr})
            WHERE created_at IS NULL OR updated_at IS NULL
        """)


_CREDIT_CONVERSION_RATE_CENTS = 16000  # R$160 — preço médio de 1 crédito (referência do plano essencial)


def _add_credit_transactions_kind() -> None:
    """Adiciona coluna `kind` em credit_transactions e migra saldos legacy.

    O sistema antigo armazenava `amount` em CENTAVOS, com saldo único
    agregado. O novo sistema usa UNIDADES (1 = 1 crédito) com três tipos:
    'common', 'peticao_express', 'recurso_express'.

    Estratégia de migração (não-destrutiva):
    1. Marca TODAS as rows existentes como kind='legacy_cents' — elas
       permanecem para histórico, mas são ignoradas pelo novo compute_balance.
    2. Para cada usuário com saldo legado positivo, insere UMA row nova:
       kind='common', amount = saldo_legacy_cents // 16000.
    3. Going forward, todas as escritas usam kind explícito.
    """
    if "credit_transactions" not in _table_names():
        return
    if "kind" in _column_names("credit_transactions"):
        return

    if db.engine.dialect.name == "postgresql":
        _execute(
            "ALTER TABLE credit_transactions ADD COLUMN kind VARCHAR(40) NOT NULL DEFAULT 'legacy_cents'"
        )
    else:
        _execute(
            "ALTER TABLE credit_transactions ADD COLUMN kind VARCHAR(40) NOT NULL DEFAULT 'legacy_cents'"
        )

    # Agora calcula o saldo legacy por usuário e cria a row de migração.
    rows = db.session.execute(
        text(
            """
            SELECT user_id,
                   COALESCE(SUM(CASE WHEN type='in' THEN amount ELSE 0 END), 0) -
                   COALESCE(SUM(CASE WHEN type='out' THEN amount ELSE 0 END), 0) AS balance_cents
            FROM credit_transactions
            GROUP BY user_id
            HAVING COALESCE(SUM(CASE WHEN type='in' THEN amount ELSE 0 END), 0) -
                   COALESCE(SUM(CASE WHEN type='out' THEN amount ELSE 0 END), 0) > 0
            """
        )
    ).fetchall()

    now_sql = "NOW()" if db.engine.dialect.name == "postgresql" else "CURRENT_TIMESTAMP"

    for user_id, balance_cents in rows:
        credits = int(balance_cents) // _CREDIT_CONVERSION_RATE_CENTS
        if credits <= 0:
            continue
        idem = f"migration-cents-to-credits-{user_id}"
        existing = db.session.execute(
            text("SELECT id FROM credit_transactions WHERE idempotency_key = :idem LIMIT 1"),
            {"idem": idem},
        ).fetchone()
        if existing:
            continue
        description = (
            f"Migração: {credits} crédito(s) comum(ns) "
            f"(saldo legado: R$ {int(balance_cents) / 100:.2f})"
        )
        # company_id é nullable; obtemos do usuário se possível
        db.session.execute(
            text(
                f"""
                INSERT INTO credit_transactions
                    (user_id, type, source, amount, description, idempotency_key, kind,
                     company_id, created_at, updated_at)
                SELECT :uid, 'in', 'migration', :amt, :desc, :idem, 'common',
                       (SELECT company_id FROM users WHERE id = :uid),
                       {now_sql}, {now_sql}
                """
            ),
            {"uid": user_id, "amt": credits, "desc": description, "idem": idem},
        )


def _add_orders_service_order_id() -> None:
    if "orders" not in _table_names():
        return
    if "service_order_id" in _column_names("orders"):
        return
    _execute(
        "ALTER TABLE orders ADD COLUMN service_order_id INTEGER"
    )


def _add_orders_payment_attempts() -> None:
    """Adiciona contador estável de tentativas de pagamento em `orders`.

    Necessário pro idempotency_key da Pagar.me ser determinístico
    (não-aleatório), evitando que retry martelado de cliente nervoso
    polua o painel do gateway com várias Pagar.me orders separadas.
    Default 0 cobre Orders pré-existentes — passa a contar do zero
    na próxima tentativa.
    """
    if "orders" not in _table_names():
        return
    if "payment_attempts" in _column_names("orders"):
        return
    _execute(
        "ALTER TABLE orders ADD COLUMN payment_attempts INTEGER NOT NULL DEFAULT 0"
    )


def _reset_orphan_processing_orders() -> None:
    """Detecta e reverte Orders presas em `processing` sem pagarme_order_id.

    Cenário: cliente clica Pagar; backend faz `order.status='processing';
    commit;` e em seguida `PagarmeClient().create_order(...)`. Se o
    backend crashar nesse intervalo (OOM/SIGKILL/deploy), Order fica
    `processing` para sempre porque `_sync_gateway_status` faz
    `if not order.pagarme_order_id: return` e nunca tenta de novo.

    Critério conservador: só reverte Orders sem pagarme_order_id E que
    não tiveram atualização nos últimos 15 minutos. Roda no boot do
    backend (idempotente — se 0 Orders no estado órfão, no-op).
    """
    if "orders" not in _table_names():
        return

    if db.engine.dialect.name == "postgresql":
        interval = "NOW() - INTERVAL '15 minutes'"
    else:
        interval = "datetime('now', '-15 minutes')"

    result = db.session.execute(text(f"""
        UPDATE orders
        SET status = 'pending'
        WHERE status = 'processing'
          AND pagarme_order_id IS NULL
          AND updated_at < {interval}
    """))
    rowcount = getattr(result, "rowcount", 0) or 0
    if rowcount > 0:
        logger.warning(
            "Revertidas %d Orders presas em 'processing' sem pagarme_order_id "
            "(boot recovery).",
            rowcount,
        )


def _normalize_credit_transaction_types() -> None:
    if "credit_transactions" not in _table_names():
        return
    _execute("UPDATE credit_transactions SET type = 'in' WHERE type = 'credit'")
    _execute("UPDATE credit_transactions SET type = 'out' WHERE type = 'debit'")


def _harden_credit_transactions_schema() -> None:
    """Reforça o schema de credit_transactions com idempotency_key + CHECKs.

    Ordem importa:
      1. Normaliza tipos legados (já feito por _normalize_credit_transaction_types).
      2. Adiciona coluna idempotency_key (nullable; chaves só preenchidas em
         escritas via credit_ledger).
      3. Cria UNIQUE PARCIAL em idempotency_key (Postgres) ou UNIQUE comum
         (SQLite — NULLs continuam distintos por padrão).
      4. Adiciona CHECK constraints (Postgres apenas; SQLite só aceita CHECK
         no CREATE TABLE, então depende do model em ambientes de teste).

    É idempotente — pode rodar várias vezes sem efeito.
    """
    if "credit_transactions" not in _table_names():
        return

    cols = _column_names("credit_transactions")
    if "idempotency_key" not in cols:
        _execute("ALTER TABLE credit_transactions ADD COLUMN idempotency_key VARCHAR(128)")

    if db.engine.dialect.name != "postgresql":
        # SQLite (testes): a tabela é recriada por db.create_all() já com a
        # CheckConstraint do modelo aplicada no CREATE TABLE — nada a fazer
        # em runtime, já que SQLite não permite ALTER ... ADD CONSTRAINT.
        return

    # UNIQUE parcial para idempotency_key — só não-nulos
    index_exists = db.session.execute(text(
        "SELECT 1 FROM pg_indexes WHERE indexname = 'uq_credit_transactions_idempotency'"
    )).fetchone()
    if not index_exists:
        _execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_transactions_idempotency "
            "ON credit_transactions (idempotency_key) "
            "WHERE idempotency_key IS NOT NULL"
        )

    # CHECK constraints — somente Postgres. NOT VALID inicial pra não
    # bloquear caso haja linha legacy fora do whitelist (apesar de termos
    # acabado de normalizar). Validação plena pode ser feita por job de
    # limpeza em outro momento.
    type_check_exists = db.session.execute(text(
        "SELECT 1 FROM pg_constraint WHERE conname = 'ck_credit_transactions_type'"
    )).fetchone()
    if not type_check_exists:
        _execute(
            "ALTER TABLE credit_transactions "
            "ADD CONSTRAINT ck_credit_transactions_type "
            "CHECK (type IN ('in','out')) NOT VALID"
        )

    amount_check_exists = db.session.execute(text(
        "SELECT 1 FROM pg_constraint WHERE conname = 'ck_credit_transactions_amount_positive'"
    )).fetchone()
    if not amount_check_exists:
        # Verifica primeiro se existe alguma linha com amount <= 0 antes de
        # tentar VALIDATE — se houver, adiciona apenas como NOT VALID e loga
        # alerta para limpeza manual.
        bad_amount = db.session.execute(text(
            "SELECT COUNT(*) FROM credit_transactions WHERE amount <= 0"
        )).scalar() or 0
        _execute(
            "ALTER TABLE credit_transactions "
            "ADD CONSTRAINT ck_credit_transactions_amount_positive "
            "CHECK (amount > 0) NOT VALID"
        )
        if bad_amount:
            logger.warning(
                "credit_transactions tem %d linhas com amount <= 0 — "
                "ck_credit_transactions_amount_positive ficou NOT VALID. "
                "Limpe os registros antes de rodar VALIDATE.",
                bad_amount,
            )


def _audit_users_missing_admin_fields() -> None:
    """Não mexe em dados — só registra quantos clientes estão com campos
    obrigatórios em branco. Esses NULLs aparecem como '—' no painel admin
    e geram o sintoma 'dados do cliente não aparecem'. A correção real é
    re-cadastrar ou completar pelo próprio cliente.
    """
    if "users" not in _table_names():
        return

    columns = _column_names("users")
    targets = [c for c in ("cpf", "phone", "oab_number") if c in columns]
    if not targets:
        return

    null_or_blank = " OR ".join(
        f"({col} IS NULL OR TRIM({col}) = '')" for col in targets
    )
    row = db.session.execute(
        text(
            f"""
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN {null_or_blank} THEN 1 ELSE 0 END) AS incomplete
            FROM users
            """
        )
    ).fetchone()
    if not row:
        return

    total = int(row[0] or 0)
    incomplete = int(row[1] or 0)
    if incomplete > 0:
        logger.warning(
            "Cadastro incompleto em %d/%d usuários (campos: %s). "
            "Estes usuários podem aparecer com '—' no painel admin.",
            incomplete,
            total,
            ", ".join(targets),
        )


def _backfill_missing_order_debits() -> None:
    """Cria transações de débito para pedidos legacy SEM correspondência.

    Guardrail: só cria débito se o usuário já tiver pelo menos uma transação
    do tipo 'in' (crédito). Sem isso, pedidos de demo/teste para usuários que
    nunca compraram crédito geram saldo negativo órfão (caso reproduzido em
    prod com user_id=1 / ORD-000006: -R$ 189 sem nenhum crédito anterior).
    """
    if {"service_orders", "credit_transactions"} - _table_names():
        return

    now_expr = "NOW()" if db.engine.dialect.name == "postgresql" else "CURRENT_TIMESTAMP"
    insert_prefix = "INSERT INTO" if db.engine.dialect.name == "postgresql" else "INSERT OR IGNORE INTO"

    _execute(f"""
        {insert_prefix} credit_transactions (user_id, company_id, type, source, amount, description, created_at, updated_at)
        SELECT
            so.user_id,
            so.company_id,
            'out' as type,
            'client_order' as source,
            so.total_amount as amount,
            'Debito - ' || so.reference || ' (Servico juridico)' as description,
            COALESCE(so.created_at, {now_expr}) as created_at,
            COALESCE(so.updated_at, {now_expr}) as updated_at
        FROM service_orders so
        WHERE so.total_amount > 0
        AND EXISTS (
            SELECT 1 FROM credit_transactions ct_in
            WHERE ct_in.user_id = so.user_id AND ct_in.type = 'in'
        )
        AND NOT EXISTS (
            SELECT 1 FROM credit_transactions ct
            WHERE ct.user_id = so.user_id
            AND ct.source = 'client_order'
            AND ct.description LIKE '%' || so.reference || '%'
        )
    """)


def _clear_orphan_order_debits() -> None:
    """Remove débitos legacy de usuários que NUNCA receberam crédito.

    Limpa o resíduo do bug anterior do _backfill_missing_order_debits.
    Roda uma única vez por boot — idempotente: se já foi limpado, o DELETE
    afeta zero linhas.
    """
    if {"service_orders", "credit_transactions"} - _table_names():
        return

    result = db.session.execute(text("""
        DELETE FROM credit_transactions
        WHERE id IN (
            SELECT ct.id FROM credit_transactions ct
            WHERE ct.type = 'out' AND ct.source = 'client_order'
            AND NOT EXISTS (
                SELECT 1 FROM credit_transactions ct_in
                WHERE ct_in.user_id = ct.user_id AND ct_in.type = 'in'
            )
        )
    """))
    if getattr(result, "rowcount", 0):
        logger.warning(
            "Removidas %d transações de débito órfãs (usuários sem crédito anterior).",
            result.rowcount,
        )


def _create_email_events_table() -> None:
    """Cria/adapta email_events sem apagar eventos já recebidos."""
    ts = "TIMESTAMP WITH TIME ZONE" if db.engine.dialect.name == "postgresql" else "DATETIME"
    pk = "SERIAL PRIMARY KEY" if db.engine.dialect.name == "postgresql" else "INTEGER PRIMARY KEY"
    now_expr = "NOW()" if db.engine.dialect.name == "postgresql" else "CURRENT_TIMESTAMP"

    if "email_events" not in _table_names():
        _execute(
            f"""
            CREATE TABLE email_events (
                id {pk},
                provider VARCHAR(40) NOT NULL DEFAULT 'resend',
                event_id VARCHAR(255),
                event_type VARCHAR(80) NOT NULL,
                recipient VARCHAR(255),
                subject VARCHAR(500),
                status VARCHAR(40),
                payload_json TEXT,
                created_at {ts} NOT NULL DEFAULT {now_expr},
                updated_at {ts} NOT NULL DEFAULT {now_expr}
            )
            """
        )
    else:
        columns = _column_names("email_events")
        statements = {
            "provider": "ALTER TABLE email_events ADD COLUMN provider VARCHAR(40) NOT NULL DEFAULT 'resend'",
            "event_id": "ALTER TABLE email_events ADD COLUMN event_id VARCHAR(255)",
            "event_type": "ALTER TABLE email_events ADD COLUMN event_type VARCHAR(80) NOT NULL DEFAULT 'unknown'",
            "recipient": "ALTER TABLE email_events ADD COLUMN recipient VARCHAR(255)",
            "subject": "ALTER TABLE email_events ADD COLUMN subject VARCHAR(500)",
            "status": "ALTER TABLE email_events ADD COLUMN status VARCHAR(40)",
            "payload_json": "ALTER TABLE email_events ADD COLUMN payload_json TEXT",
            "created_at": f"ALTER TABLE email_events ADD COLUMN created_at {ts} NOT NULL DEFAULT {now_expr}",
            "updated_at": f"ALTER TABLE email_events ADD COLUMN updated_at {ts} NOT NULL DEFAULT {now_expr}",
        }
        for column_name, sql in statements.items():
            if column_name not in columns:
                _execute(sql)

    _execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_email_events_event_id "
        "ON email_events (event_id) WHERE event_id IS NOT NULL"
    )
    _execute("CREATE INDEX IF NOT EXISTS ix_email_events_event_type ON email_events (event_type)")


def run_runtime_migrations() -> None:
    _acquire_runtime_migrations_lock()
    _add_user_columns()
    _add_service_order_columns()
    _create_financial_entries_table()
    _create_terms_acceptances_table()
    _backfill_petition_service_orders()
    _fix_legacy_schema()
    _add_credit_transaction_unique_constraint()
    _create_order_comments_table()
    _add_plan_columns()
    _add_service_catalog_item_columns()
    _add_audit_log_columns()
    _add_petition_columns()
    _fix_petition_document_links_timestamps()
    _add_orders_payment_attempts()
    _add_orders_service_order_id()
    _add_credit_transactions_kind()
    _normalize_credit_transaction_types()
    _harden_credit_transactions_schema()
    _clear_orphan_order_debits()
    _backfill_missing_order_debits()
    _audit_users_missing_admin_fields()
    _create_email_events_table()
    _reset_orphan_processing_orders()
    db.session.commit()
