"""Shared pytest fixtures.

The test database is assumed to be a dedicated, disposable Postgres instance.
Each pytest run resets the `public` schema from scratch (dropping any leftover
tables or enum types), then recreates all tables from the SQLAlchemy metadata.
Individual tests run inside an outer transaction that is rolled back on tear
down, so changes don't leak between tests.

Local development: `docker compose up -d db` before running pytest.
CI: provides its own Postgres service (see .github/workflows/ci.yml).
"""

import os
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import Base, engine, get_db
from app.main import app

# Hosts the test harness is allowed to drop + recreate against. Anything else
# (Supabase, RDS, a teammate's dev DB, ...) refuses to run so a stray
# `DATABASE_URL` never wipes shared data. Override with
# DEVSYNC_ALLOW_DESTRUCTIVE_TESTS=1 only if you are *certain* the target is
# disposable.
_LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "db"}


def _assert_test_database_is_local() -> None:
    if os.environ.get("DEVSYNC_ALLOW_DESTRUCTIVE_TESTS") == "1":
        return
    host = engine.url.host or ""
    if host.lower() in _LOCAL_HOSTS:
        return
    raise RuntimeError(
        "Refusing to run pytest against a non-local database.\n"
        f"  DATABASE_URL host: {host!r}\n"
        f"  Allowed hosts:     {sorted(_LOCAL_HOSTS)}\n"
        "The test harness drops and recreates the `public` schema on every run.\n"
        "Point DATABASE_URL at the local Docker Postgres (default from .env.example)\n"
        "or, if you really want to run tests against this database, set\n"
        "DEVSYNC_ALLOW_DESTRUCTIVE_TESTS=1."
    )


_assert_test_database_is_local()


@pytest.fixture(scope="session", autouse=True)
def _reset_schema() -> Iterator[None]:
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    Base.metadata.create_all(engine)
    yield


@pytest.fixture
def db_session() -> Iterator[Session]:
    """Give each test an isolated session that rolls back on exit.

    `join_transaction_mode="create_savepoint"` turns the session's own commits
    into savepoint releases, so the outer `transaction.rollback()` always wins.
    """
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(
        bind=connection,
        autoflush=False,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(db_session: Session) -> Iterator[TestClient]:
    """TestClient wired to the per-test transactional session."""

    def _override_get_db() -> Iterator[Session]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.pop(get_db, None)
