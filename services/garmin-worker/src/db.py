import os
import psycopg

# Liga à mesma base de dados do apps/web. Este serviço só escreve nas suas
# próprias tabelas: sleep_sessions, recovery_metrics, e a fatia
# provider='garmin' de connected_accounts.


def get_connection():
    return psycopg.connect(os.environ["DATABASE_URL"])


def mark_sync_ok(user_id: str) -> None:
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE connected_accounts
            SET status = 'connected', last_error = NULL, last_synced_at = now()
            WHERE user_id = %s AND provider = 'garmin'
            """,
            (user_id,),
        )


def mark_sync_error(user_id: str, message: str) -> None:
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE connected_accounts
            SET status = 'error', last_error = %s
            WHERE user_id = %s AND provider = 'garmin'
            """,
            (message, user_id),
        )


def upsert_sleep_session(user_id: str, date: str, data: dict) -> None:
    # TODO: INSERT ... ON CONFLICT (user_id, date) DO UPDATE
    raise NotImplementedError


def upsert_recovery_metrics(user_id: str, date: str, data: dict) -> None:
    # TODO: INSERT ... ON CONFLICT (user_id, date) DO UPDATE
    raise NotImplementedError
