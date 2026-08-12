"""Extrae datos de censo baleares -> MinIO bronze/ibestat/."""
from include.bronze.ibestat import extract as _extract


def extract(**context) -> str:
    return _extract("censo_baleares", **context)
