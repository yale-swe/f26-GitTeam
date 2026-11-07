"""The lockdown migration closes Supabase's public Data API.

It runs inside a transaction that is rolled back, against stand-ins for
Supabase's `anon` and `authenticated` roles, so nothing persists.
"""

import importlib.util
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import Connection, text
from sqlalchemy.exc import DBAPIError

from app.db import engine

MIGRATION = next(
    (Path(__file__).parent.parent / "migrations" / "versions").glob("*_lock_down_data_api.py")
)
ROLES = ("anon", "authenticated")


def _load_migration():
    spec = importlib.util.spec_from_file_location("lock_down_data_api", MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def conn() -> Iterator[Connection]:
    connection = engine.connect()
    transaction = connection.begin()
    try:
        for role in ROLES:
            connection.execute(
                text(
                    f"DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{role}') "
                    f"THEN CREATE ROLE {role} NOLOGIN; END IF; END $$"
                )
            )
        # Supabase grants new public tables to these roles by default.
        connection.execute(text("GRANT USAGE ON SCHEMA public TO anon, authenticated"))
        connection.execute(text("GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated"))
    except DBAPIError:
        transaction.rollback()
        connection.close()
        pytest.skip("needs a database role allowed to create roles and grants")
    yield connection
    transaction.rollback()
    connection.close()


def _run_upgrade(connection: Connection) -> None:
    with Operations.context(MigrationContext.configure(connection)):
        _load_migration().upgrade()


def _can_read_projects_as(connection: Connection, role: str) -> bool:
    connection.execute(text("SAVEPOINT probe"))
    try:
        connection.execute(text(f"SET LOCAL ROLE {role}"))
        connection.execute(text("SELECT id FROM projects LIMIT 1"))
        return True
    except DBAPIError:
        return False
    finally:
        connection.execute(text("ROLLBACK TO SAVEPOINT probe"))
        connection.execute(text("RESET ROLE"))


@pytest.mark.parametrize("role", ROLES)
def test_public_roles_can_read_before_and_not_after(conn: Connection, role: str) -> None:
    assert _can_read_projects_as(conn, role), "precondition: the grants mimic Supabase"

    _run_upgrade(conn)

    assert not _can_read_projects_as(conn, role)


def test_every_app_table_has_row_level_security(conn: Connection) -> None:
    _run_upgrade(conn)

    unprotected = (
        conn.execute(
            text(
                "SELECT relname FROM pg_class WHERE relnamespace = 'public'::regnamespace "
                "AND relkind = 'r' AND NOT relrowsecurity ORDER BY relname"
            )
        )
        .scalars()
        .all()
    )

    assert unprotected == []


def test_tables_created_later_are_not_granted_to_public_roles(conn: Connection) -> None:
    _run_upgrade(conn)
    conn.execute(text("CREATE TABLE created_after_lockdown (id int)"))

    for role in ROLES:
        granted = conn.execute(
            text("SELECT has_table_privilege(:role, 'created_after_lockdown', 'SELECT')"),
            {"role": role},
        ).scalar_one()
        assert granted is False


def test_the_table_owner_used_by_the_backend_still_has_access(conn: Connection) -> None:
    _run_upgrade(conn)

    conn.execute(text("SELECT id FROM projects LIMIT 1"))
