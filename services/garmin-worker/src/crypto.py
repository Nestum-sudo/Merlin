"""Decrypt payloads criados por apps/web/lib/crypto.ts.

A encriptação acontece sempre do lado do web (quando o utilizador submete
as credenciais Garmin no onboarding) — este ficheiro só sabe desencriptar,
nunca encripta nada. As duas linguagens têm de derivar exatamente a mesma
chave a partir do mesmo APP_ENCRYPTION_KEY partilhado, ou a desencriptação
falha (falha alto e claro, não em silêncio — um erro de chave errada dá
InvalidTag, não texto corrompido).
"""

import base64
import hashlib
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

_SALT = b"merlin-token-salt"  # tem de bater certo com o salt fixo em crypto.ts
_key_cache: bytes | None = None


def _derive_key() -> bytes:
    password = os.environ["APP_ENCRYPTION_KEY"].encode("utf-8")
    # Espelha scryptSync(password, salt, 32) do Node: N=16384, r=8, p=1,
    # chave de 32 bytes. Se algum destes parâmetros divergir do lado Node,
    # a chave fica diferente e a desencriptação falha sempre.
    return hashlib.scrypt(password, salt=_SALT, n=16384, r=8, p=1, dklen=32, maxmem=64 * 1024 * 1024)


def decrypt(payload: str) -> str:
    global _key_cache
    if _key_cache is None:
        _key_cache = _derive_key()

    iv_b64, tag_b64, data_b64 = payload.split(".")
    iv = base64.b64decode(iv_b64)
    tag = base64.b64decode(tag_b64)
    ciphertext = base64.b64decode(data_b64)

    # Node guarda o authTag separado do ciphertext; a lib 'cryptography'
    # espera-os concatenados (ciphertext + tag) — é só isto que muda entre
    # os dois lados, o algoritmo (AES-256-GCM) é o mesmo.
    aesgcm = AESGCM(_key_cache)
    plaintext = aesgcm.decrypt(iv, ciphertext + tag, None)
    return plaintext.decode("utf-8")
