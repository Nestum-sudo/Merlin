"""Lógica de sincronização com o Garmin Connect.

Sem OAuth oficial: usa as credenciais do próprio utilizador (email +
password, guardadas encriptadas em connected_accounts) através da lib
python-garminconnect.

Desde março de 2026 a Garmin bloqueia clientes HTTP não-browser com
Cloudflare do lado deles — pedidos diretos podem começar a falhar sem
aviso, mesmo com credenciais corretas. Isto NÃO está resolvido aqui: o
caminho primário (abaixo) é o pedido direto via python-garminconnect; se
começar a falhar de forma consistente, a mitigação é trocar para uma sessão
Playwright headless (ver etweisberg/garmin-connect-mcp como referência de
implementação) — deixado como TODO explícito em vez de fingido como
resolvido, porque depende de como a Garmin decidir bloquear a seguir.

NOTA: os nomes de métodos da lib garminconnect mudam entre versões com
alguma frequência (é uma lib não-oficial, sem contrato de API estável).
Confirmar contra a versão fixada em requirements.txt antes de assumir que
isto corre sem ajustes.
"""

from datetime import date, timedelta

import os
import requests

from . import db


class GarminSyncError(Exception):
    pass


def sync_user(user_id: str) -> None:
    try:
        credentials = _load_credentials(user_id)
        if credentials is None:
            raise GarminSyncError("Garmin não está ligado para este utilizador.")

        sleep_days, recovery_days = _fetch_last_n_days(credentials, days=7)

        for day in sleep_days:
            date_str = day.pop("date")
            db.upsert_sleep_session(user_id, date_str, day)
        for day in recovery_days:
            date_str = day.pop("date")
            db.upsert_recovery_metrics(user_id, date_str, day)

        db.mark_sync_ok(user_id)
        _notify_web_app_to_recompute(user_id)
    except GarminSyncError:
        # Mensagem curta e sem detalhes técnicos — é isto que aparece no
        # cartão de erro nas Definições.
        db.mark_sync_error(user_id, "O Garmin recusou o pedido de sincronização.")
        raise
    except Exception:  # noqa: BLE001
        db.mark_sync_error(user_id, "Falha inesperada ao sincronizar com o Garmin.")
        raise


def _load_credentials(user_id: str):
    return db.get_garmin_credentials(user_id)


def _fetch_last_n_days(credentials: tuple[str, str], days: int):
    from garminconnect import Garmin  # import local: só o worker precisa desta dependência pesada

    email, password = credentials

    try:
        client = Garmin(email, password)
        client.login()
    except Exception as exc:  # noqa: BLE001
        # Cobre tanto password errada como o cenário de bloqueio Cloudflare
        # — do lado de fora, ambos parecem "login falhou". Sem um sinal
        # fiável para os distinguir na lib atual, tratamos os dois da mesma
        # forma por agora (ver TODO no topo do ficheiro).
        raise GarminSyncError(f"login Garmin falhou: {exc}") from exc

    sleep_days = []
    recovery_days = []
    today = date.today()

    for offset in range(days):
        d = today - timedelta(days=offset)
        d_str = d.isoformat()

        try:
            raw_sleep = client.get_sleep_data(d_str)
            mapped = _map_sleep(d_str, raw_sleep)
            if mapped:
                sleep_days.append(mapped)
        except Exception:  # noqa: BLE001
            # um dia sem dados de sono (ex. relógio não usado nessa noite)
            # não deve derrubar o sync inteiro dos outros 6 dias
            continue

        try:
            raw_hrv = client.get_hrv_data(d_str)
            raw_battery = client.get_body_battery(d_str) if hasattr(client, "get_body_battery") else None
            mapped = _map_recovery(d_str, raw_hrv, raw_battery)
            if mapped:
                recovery_days.append(mapped)
        except Exception:  # noqa: BLE001
            continue

    return sleep_days, recovery_days


def _map_sleep(date_str: str, raw: dict | None) -> dict | None:
    if not raw:
        return None
    # A resposta real da lib é um JSON aninhado (dailySleepDTO + níveis por
    # fase) cuja forma exata varia por versão — os .get() em cadeia são
    # propositadamente defensivos. Confirmar os nomes de campo contra uma
    # resposta real antes de considerar isto definitivo.
    daily = raw.get("dailySleepDTO", raw)
    return {
        "date": date_str,
        "bedtime": daily.get("sleepStartTimestampGMT"),
        "wake_time": daily.get("sleepEndTimestampGMT"),
        "duration_min": _seconds_to_min(daily.get("sleepTimeSeconds")),
        "deep_min": _seconds_to_min(daily.get("deepSleepSeconds")),
        "light_min": _seconds_to_min(daily.get("lightSleepSeconds")),
        "rem_min": _seconds_to_min(daily.get("remSleepSeconds")),
        "awake_min": _seconds_to_min(daily.get("awakeSleepSeconds")),
        "sleep_score": (raw.get("sleepScores") or {}).get("overall", {}).get("value"),
    }


def _map_recovery(date_str: str, raw_hrv: dict | None, raw_battery: dict | None) -> dict | None:
    if not raw_hrv and not raw_battery:
        return None
    hrv = raw_hrv or {}
    battery = raw_battery or {}
    return {
        "date": date_str,
        "hrv_ms": hrv.get("lastNightAvg"),
        "hrv_status": hrv.get("status"),
        "resting_hr": hrv.get("restingHeartRate"),
        "body_battery_start": _first_battery_value(battery),
        "body_battery_end": _last_battery_value(battery),
        "stress_score": battery.get("avgStressLevel"),
    }


def _seconds_to_min(seconds) -> int | None:
    return round(seconds / 60) if seconds is not None else None


def _first_battery_value(battery: dict):
    readings = battery.get("bodyBatteryValuesArray") or []
    return readings[0][1] if readings else None


def _last_battery_value(battery: dict):
    readings = battery.get("bodyBatteryValuesArray") or []
    return readings[-1][1] if readings else None


def _notify_web_app_to_recompute(user_id: str) -> None:
    # O cálculo de CTL/ATL/TSB e readiness vive no apps/web (TypeScript) —
    # este worker só avisa que há dados novos, não reimplementa a lógica.
    # Falhar aqui não deve desfazer o sync: os dados já estão gravados;
    # o pior caso é o painel ficar um pouco desatualizado até ao próximo
    # sync ou a um retry manual deste passo.
    try:
        requests.post(
            f"{os.environ['WEB_APP_URL']}/api/internal/recompute",
            json={"userId": user_id},
            headers={"Authorization": f"Bearer {os.environ['WEB_APP_INTERNAL_TOKEN']}"},
            timeout=10,
        )
    except requests.RequestException:
        # TODO: log estruturado + retry/fila em vez de engolir o erro em
        # silêncio. Por agora, não interrompe o sync que já teve sucesso.
        pass
