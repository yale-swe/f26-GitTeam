"""lock down the Supabase Data API

Supabase exposes every table in the `public` schema through its REST Data API,
and the publishable key that ships in the frontend bundle is enough to call it.
Tables created by Alembic have row-level security off and grants for the `anon`
and `authenticated` roles, so their rows could be read by anyone.

DevSync never uses that API: the frontend only signs users in, and all data goes
through FastAPI, which connects as the table owner. This migration therefore:

* enables row-level security on every table the connecting role owns in
  `public` (with no policies, so `anon` and `authenticated` see nothing), and
* revokes the `anon` and `authenticated` table and sequence grants, including
  the default grants for tables created later.

The owner role bypasses row-level security, so the backend is unaffected.
The roles only exist on Supabase; on plain Postgres (local Docker, CI) the
revoke steps are skipped and only row-level security is enabled.

Downgrade disables row-level security again but does not restore the public
grants, which should never be re-opened.

Revision ID: c4d8e1f20a63
Revises: b7f3c2d91e45
Create Date: 2026-11-05
"""

from collections.abc import Sequence

from alembic import op

revision: str = "c4d8e1f20a63"
down_revision: str | None = "b7f3c2d91e45"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        DECLARE
            t record;
            r text;
        BEGIN
            FOR t IN
                SELECT tablename FROM pg_tables
                WHERE schemaname = 'public' AND tableowner = current_user
            LOOP
                EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
            END LOOP;

            FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
                    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
                    EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
                    EXECUTE format(
                        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r
                    );
                    EXECUTE format(
                        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I',
                        r
                    );
                END IF;
            END LOOP;
        END
        $$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$
        DECLARE
            t record;
        BEGIN
            FOR t IN
                SELECT tablename FROM pg_tables
                WHERE schemaname = 'public' AND tableowner = current_user
            LOOP
                EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t.tablename);
            END LOOP;
        END
        $$;
        """
    )
