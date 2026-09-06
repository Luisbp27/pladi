"""Extrae datos de ocupacion apartamentos turisticos -> MinIO bronze/ibestat/."""
from include.bronze.ibestat import extract as _extract


def extract(**context) -> str:
    return _extract("ocupacion_apartamentos_turisticos", **context)
