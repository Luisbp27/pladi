from fastapi import APIRouter

from database import fetch_geojson_feature_collection, fetch_geojson_from_query

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
    query = """
        SELECT jsonb_build_object(
            'type', 'FeatureCollection',
            'features', COALESCE(jsonb_agg(
                jsonb_build_object(
                    'type', 'Feature',
                    'geometry', ST_AsGeoJSON(ST_SimplifyPreserveTopology(t.geometry, 0.001))::jsonb,
                    'properties', to_jsonb(t) - 'geometry' || jsonb_build_object(
                        'estado_cuantitativo', bal.estado_cuantitativo,
                        'explotacion_porcentaje', bal.explotacion_porcentaje,
                        'disponibilidad_hm3', bal.disponibilidad_hm3
                    )
                )
            ) FILTER (WHERE t.geometry IS NOT NULL), '[]'::jsonb)
        ) AS geojson
        FROM public.masa_subterranea t
        LEFT JOIN LATERAL (
            SELECT estado_cuantitativo, explotacion_porcentaje, disponibilidad_hm3
            FROM gold.balance_hidrico_baleares b
            WHERE b.cod_masa = t.cod_masa
            ORDER BY anio DESC LIMIT 1
        ) bal ON true
    """
    return await fetch_geojson_from_query(query)


@router.get("/pozos")
async def geojson_pozos():
    return await fetch_geojson_feature_collection("pozos")


@router.get("/municipios")
async def geojson_municipios():
    return await fetch_geojson_feature_collection("municipio")


@router.get("/unidades-demanda")
async def geojson_unidades_demanda():
    query = """
        SELECT jsonb_build_object(
            'type', 'FeatureCollection',
            'features', COALESCE(jsonb_agg(
                jsonb_build_object(
                    'type', 'Feature',
                    'geometry', ST_AsGeoJSON(ST_SimplifyPreserveTopology(t.geometry, 0.001))::jsonb,
                    'properties', to_jsonb(t) - 'geometry' || jsonb_build_object(
                        'explotacion_porcentaje', bal.explotacion_porcentaje,
                        'disponibilidad_hm3', bal.disponibilidad_hm3,
                        'extraccion_hm3', bal.extraccion_hm3,
                        'n_buen_estado', bal.n_buen_estado,
                        'n_en_riesgo', bal.n_en_riesgo,
                        'n_mal_estado', bal.n_mal_estado
                    )
                )
            ) FILTER (WHERE t.geometry IS NOT NULL), '[]'::jsonb)
        ) AS geojson
        FROM public.unidad_demanda t
        LEFT JOIN LATERAL (
            SELECT
                (SUM(b.extraccion_hm3) / NULLIF(SUM(b.disponibilidad_hm3), 0)) AS explotacion_porcentaje,
                SUM(b.disponibilidad_hm3) AS disponibilidad_hm3,
                SUM(b.extraccion_hm3) AS extraccion_hm3,
                COUNT(*) FILTER (WHERE b.estado_cuantitativo = 'buen_estado') AS n_buen_estado,
                COUNT(*) FILTER (WHERE b.estado_cuantitativo = 'en_riesgo') AS n_en_riesgo,
                COUNT(*) FILTER (WHERE b.estado_cuantitativo = 'mal_estado') AS n_mal_estado
            FROM gold.balance_hidrico_baleares b
            JOIN public.masa_subterranea m ON m.cod_masa = b.cod_masa
            WHERE m.id_unidad_demanda = t.id_unidad_demanda
              AND b.anio = (SELECT MAX(anio) FROM gold.balance_hidrico_baleares)
        ) bal ON true
    """
    return await fetch_geojson_from_query(query)
