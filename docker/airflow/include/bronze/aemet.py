"""Helper compartido para llamadas a la API de AEMET OpenData.

Maneja el rate limit de AEMET (429 por minuto): espera de ~61s para
cruzar la ventana de bloqueo y reintenta con paciencia (hasta ~10 min).
"""
from __future__ import annotations

import time

import requests

RETRY_WAIT_429 = 61  # segundos: cruza la ventana de rate limit por minuto
MAX_429_ATTEMPTS = 10
BACKOFF_5XX = 3  # segundos base para errores transitorios del servidor


def aemet_request(url: str) -> dict:
    """GET con manejo de rate limit de AEMET.

    Devuelve el body JSON. Si la respuesta es 429 (HTTP o estado en body),
    espera RETRY_WAIT_429 segundos y reintenta hasta MAX_429_ATTEMPTS veces.
    """
    for attempt in range(MAX_429_ATTEMPTS):
        try:
            resp = requests.get(url, timeout=(15, 120))
        except (requests.ConnectionError, requests.Timeout):
            time.sleep(min(2**attempt * BACKOFF_5XX, 30))
            continue

        if resp.status_code in (500, 502, 503, 504):
            time.sleep(min(2**attempt * BACKOFF_5XX, 30))
            continue

        if resp.status_code == 429:
            time.sleep(RETRY_WAIT_429)
            continue

        resp.raise_for_status()
        body = resp.json()
        if isinstance(body, dict) and body.get("estado") == 429:
            time.sleep(RETRY_WAIT_429)
            continue
        return body

    raise RuntimeError(f"Rate limit de AEMET no resuelto tras reintentos: {url}")
