from fastapi import APIRouter
from fastapi.responses import JSONResponse

from database import fetch_geojson_feature_collection

router = APIRouter(
    prefix="/api/v1/mapa",
    tags=["mapa"],
)


@router.get("/capas")
async def capas_disponibles():
    return {
        "capas": [
            {"id": "municipios", "nombre": "Municipios", "tabla": "municipio"},
            {"id": "pozos", "nombre": "Pozos", "tabla": "pozos"},
            {"id": "masas", "nombre": "Masas subterráneas", "tabla": "masa_subterranea"},
            {"id": "unidades_demanda", "nombre": "Unidades de demanda", "tabla": "unidad_demanda"},
        ]
    }


@router.get("/masas")
async def geojson_masas():
    return await fetch_geojson_feature_collection("masa_subterranea")


@router.get("/pozos")
async def geojson_pozos():
    return await fetch_geojson_feature_collection("pozos")


@router.get("/municipios")
async def geojson_municipios():
    return await fetch_geojson_feature_collection("municipio")


@router.get("/unidades-demanda")
async def geojson_unidades_demanda():
    return await fetch_geojson_feature_collection("unidad_demanda")
