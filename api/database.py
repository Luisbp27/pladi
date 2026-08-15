import json

import asyncpg

from config import settings

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            host=settings.postgres_host,
            port=settings.postgres_port,
            user=settings.postgres_user,
            password=settings.postgres_password,
            database=settings.postgres_db,
            min_size=2,
            max_size=10,
        )
    return _pool


async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def fetch_geojson_feature_collection(
    table: str,
    geometry_column: str = "geometry",
    simplify: float = 0.001,
) -> dict:
    pool = await get_pool()

    geom_expr = f"ST_SimplifyPreserveTopology({geometry_column}, {simplify})"
    query = f"""
        SELECT jsonb_build_object(
            'type', 'FeatureCollection',
            'features', COALESCE(jsonb_agg(
                jsonb_build_object(
                    'type', 'Feature',
                    'geometry', ST_AsGeoJSON({geom_expr})::jsonb,
                    'properties', to_jsonb(t) - '{geometry_column}'
                )
            ) FILTER (WHERE {geometry_column} IS NOT NULL), '[]'::jsonb)
        ) AS geojson
        FROM {table} t
        WHERE {geometry_column} IS NOT NULL
    """

    async with pool.acquire() as conn:
        row = await conn.fetchrow(query)
        raw = row["geojson"]
        if isinstance(raw, str):
            return json.loads(raw)
        return raw


async def fetch_geojson_from_query(query: str, *params) -> dict:
    """Ejecuta una query que devuelva una columna 'geojson' (jsonb FeatureCollection)."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(query, *params)
        if row is None:
            return {"type": "FeatureCollection", "features": []}
        raw = row["geojson"]
        if isinstance(raw, str):
            return json.loads(raw)
        return raw
