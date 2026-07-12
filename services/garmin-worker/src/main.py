import os

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException
from apscheduler.schedulers.background import BackgroundScheduler

from . import sync

app = FastAPI(title="merlin-garmin-worker")


def _check_token(authorization: str | None) -> None:
    expected = f"Bearer {os.environ.get('SERVICE_TOKEN', '')}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="token inválido")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/sync/{user_id}")
def sync_now(user_id: str, background_tasks: BackgroundTasks, authorization: str | None = Header(None)):
    """Chamado pelo botão 'Sincronizar agora' das Definições.

    Responde de imediato ('aceite') e sincroniza em segundo plano — o web
    nunca espera pela resposta do Garmin em tempo real. O resultado fica
    escrito em connected_accounts (status / last_error), que é o que o web
    lê a seguir.
    """
    _check_token(authorization)
    background_tasks.add_task(sync.sync_user, user_id)
    return {"accepted": True}


# Cron interno — sincroniza todos os utilizadores ligados periodicamente,
# independentemente de o web pedir ou não. TODO: substituir o intervalo fixo
# por leitura da lista real de connected_accounts com provider='garmin'.
scheduler = BackgroundScheduler()


@scheduler.scheduled_job("interval", hours=6)
def scheduled_sync_all():
    # TODO: SELECT user_id FROM connected_accounts WHERE provider='garmin' AND status != 'disconnected'
    pass


@app.on_event("startup")
def start_scheduler():
    scheduler.start()
