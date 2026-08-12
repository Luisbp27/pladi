"""Extrae datos de ocupacion hotelera -> MinIO bronze/ibestat/."""
from include.bronze.ibestat import extract as _extract


def extract(**context) -> str:
    return _extract("ocupacion_hotelera", **context)
