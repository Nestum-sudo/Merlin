"""Fallback de autenticação Garmin via sessão de browser real (Playwright).

Usado quando o pedido HTTP direto (python-garminconnect) é bloqueado pelas
proteções anti-bot do lado da Garmin — um browser real, mesmo headless,
passa por verificações que um cliente HTTP simples não passa.

AVISO IMPORTANTE — isto é uma implementação de referência, não validada
contra o comportamento real da Garmin a partir deste ambiente (sem acesso
de rede aqui para testar). Os seletores do formulário de login e os
endpoints internos abaixo foram escritos com base na estrutura conhecida
do SSO da Garmin (sso.garmin.com) e do Garmin Connect
(connect.garmin.com/modern/proxy/...) — ambos já mudaram de estrutura
várias vezes no passado sem aviso, e podem voltar a mudar. Antes de confiar
nisto em produção:
  1. Corre `sync_user` manualmente contra uma conta de teste e confirma que
     o login e os dados voltam como esperado.
  2. Se os seletores ou os endpoints tiverem mudado, ajusta aqui — a
     estrutura do resto do ficheiro (sessão devolvida com cookies válidos,
     depois usada para pedidos diretos) mantém-se correta
     independentemente disso.
  3. Ver etweisberg/garmin-connect-mcp para uma implementação da mesma
     ideia mantida ativamente, útil para comparar se os endpoints mudaram.
"""

from __future__ import annotations

import requests
from playwright.sync_api import sync_playwright

GARMIN_SSO_LOGIN_URL = (
    "https://sso.garmin.com/portal/sso/pt-PT/sign-in"
    "?clientId=GarminConnect&service=https://connect.garmin.com/modern"
)
CONNECT_BASE = "https://connect.garmin.com"


class PlaywrightLoginError(Exception):
    pass


def get_authenticated_session(email: str, password: str) -> requests.Session:
    """Abre um browser headless, faz login como um utilizador real faria, e
    devolve uma requests.Session com os cookies resultantes — para usar em
    pedidos diretos aos endpoints internos do Garmin Connect a seguir, sem
    reabrir o browser a cada pedido (isso seria lento e desnecessário)."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        )
        page = context.new_page()

        page.goto(GARMIN_SSO_LOGIN_URL, wait_until="networkidle")

        # TODO: confirmar estes seletores contra a página real antes do
        # primeiro uso — 'name' dos campos é o mais estável historicamente,
        # mas não é garantido
        page.fill('input[name="username"]', email)
        page.fill('input[name="password"]', password)
        page.click('button[type="submit"]')

        try:
            page.wait_for_url("**/modern**", timeout=15000)
        except Exception as exc:
            raise PlaywrightLoginError(
                "login via Playwright não completou dentro do tempo esperado — "
                "pode ser MFA, CAPTCHA, credenciais erradas, ou a página ter mudado de estrutura"
            ) from exc

        cookies = context.cookies()
        browser.close()

    session = requests.Session()
    for cookie in cookies:
        session.cookies.set(cookie["name"], cookie["value"], domain=cookie.get("domain"))
    session.headers.update({"User-Agent": "Mozilla/5.0 (compatible; MerlinSync/1.0)"})
    return session


def fetch_display_name(session: requests.Session) -> str:
    """O Garmin identifica o utilizador por um 'displayName' interno
    (não o email) nos endpoints de dados — precisa de se ir buscar uma vez
    por sessão."""
    res = session.get(f"{CONNECT_BASE}/modern/currentuser-service/user/info", timeout=15)
    res.raise_for_status()
    return res.json()["displayName"]


def fetch_daily_sleep(session: requests.Session, display_name: str, date_str: str) -> dict | None:
    url = f"{CONNECT_BASE}/modern/proxy/wellness-service/wellness/dailySleepData/{display_name}"
    res = session.get(url, params={"date": date_str}, timeout=15)
    if res.status_code != 200:
        return None
    return res.json()


def fetch_daily_hrv(session: requests.Session, date_str: str) -> dict | None:
    url = f"{CONNECT_BASE}/modern/proxy/hrv-service/hrv/{date_str}"
    res = session.get(url, timeout=15)
    if res.status_code != 200:
        return None
    return res.json()


def fetch_body_battery(session: requests.Session, display_name: str, date_str: str) -> dict | None:
    url = f"{CONNECT_BASE}/modern/proxy/wellness-service/wellness/bodyBattery/reports/daily"
    res = session.get(url, params={"startDate": date_str, "endDate": date_str}, timeout=15)
    if res.status_code != 200:
        return None
    data = res.json()
    return data[0] if isinstance(data, list) and data else None
