import os
from typing import Optional

import psycopg

from . import crypto

# Liga à mesma base de dados do apps/web. Este serviço só escreve nas suas
# próprias tabelas: sleep_sessions, recovery_metrics, e a fatia
# provider='garmin' de connected_accounts.


def get_connection():
    return psycopg.connect(os.environ["DATABASE_URL"])


def get_garmin_credentials(user_id: str) -> Optional[tuple[str, str]]:
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT access_token, refresh_token
            FROM connected_accounts
            WHERE user_id = %s AND provider = 'garmin' AND status != 'disconnected'
            """,
            (user_id,),
        ).fetchone()
    if row is None:
        return None
    encrypted_email, encrypted_password = row
    return crypto.decrypt(encrypted_email), crypto.decrypt(encrypted_password)


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
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO sleep_sessions
              (user_id, date, bedtime, wake_time, duration_min, deep_min, light_min, rem_min, awake_min, sleep_score)
            VALUES (%(user_id)s, %(date)s, %(bedtime)s, %(wake_time)s, %(duration_min)s,
                    %(deep_min)s, %(light_min)s, %(rem_min)s, %(awake_min)s, %(sleep_score)s)
            ON CONFLICT (user_id, date) DO UPDATE SET
              bedtime = EXCLUDED.bedtime,
              wake_time = EXCLUDED.wake_time,
              duration_min = EXCLUDED.duration_min,
              deep_min = EXCLUDED.deep_min,
              light_min = EXCLUDED.light_min,
              rem_min = EXCLUDED.rem_min,
              awake_min = EXCLUDED.awake_min,
              sleep_score = EXCLUDED.sleep_score
            """,
            {"user_id": user_id, "date": date, **data},
        )


def upsert_recovery_metrics(user_id: str, date: str, data: dict) -> None:
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO recovery_metrics
              (user_id, date, hrv_ms, hrv_status, resting_hr, body_battery_start, body_battery_end, stress_score)
            VALUES (%(user_id)s, %(date)s, %(hrv_ms)s, %(hrv_status)s, %(resting_hr)s,
                    %(body_battery_start)s, %(body_battery_end)s, %(stress_score)s)
            ON CONFLICT (user_id, date) DO UPDATE SET
              hrv_ms = EXCLUDED.hrv_ms,
              hrv_status = EXCLUDED.hrv_status,
              resting_hr = EXCLUDED.resting_hr,
              body_battery_start = EXCLUDED.body_battery_start,
              body_battery_end = EXCLUDED.body_battery_end,
              stress_score = EXCLUDED.stress_score
            """,
            {"user_id": user_id, "date": date, **data},
        )
