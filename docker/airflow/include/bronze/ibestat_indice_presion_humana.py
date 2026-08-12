"""Extrae datos de indice presion humana -> MinIO bronze/ibestat/."""
from include.bronze.ibestat import extract as _extract


def extract(**context) -> str:
    return _extract("indice_presion_humana", **context)
