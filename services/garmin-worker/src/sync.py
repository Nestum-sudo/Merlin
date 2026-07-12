# Lógica de sincronização com o Garmin Connect.
#
# Sem OAuth oficial: usa credenciais próprias do utilizador (guardadas
# encriptadas em connected_accounts) através da lib python-garminconnect.
# Desde março de 2026 a Garmin bloqueia clientes HTTP não-browser com
# Cloudflare — por isso o fallback é sessão via Playwright headless em vez
# de pedidos HTTP diretos.

from . import db


class GarminSyncError(Exception):
    pass


def sync_user(user_id: str) -> None:
    try:
        credentials = _load_credentials(user_id)
        raw_sleep, raw_recovery = _fetch_last_n_days(credentials, days=7)
        for day in raw_sleep:
            db.upsert_sleep_session(user_id, day["date"], day)
        for day in raw_recovery:
            db.upsert_recovery_metrics(user_id, day["date"], day)
        db.mark_sync_ok(user_id)
    except GarminSyncError as exc:
        # Mensagem curta e sem detalhes técnicos — é isto que aparece no
        # cartão de erro nas Definições.
        db.mark_sync_error(user_id, "O Garmin recusou o pedido de sincronização.")
        raise
    except Exception as exc:  # noqa: BLE001
        db.mark_sync_error(user_id, "Falha inesperada ao sincronizar com o Garmin.")
        raise


def _load_credentials(user_id: str):
    # TODO: ler + desencriptar de connected_accounts
    raise NotImplementedError


def _fetch_last_n_days(credentials, days: int):
    # TODO: python-garminconnect primeiro; fallback para sessão Playwright
    # headless se o pedido direto for bloqueado (ver etweisberg/garmin-connect-mcp
    # como referência de implementação).
    raise NotImplementedError
