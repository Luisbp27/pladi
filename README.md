# pladi

<p align="center">
  <img src="web/public/assets/logo-chip.svg" alt="pladi" width="320" />
</p>

**PLADI — Plataforma de Datos Inteligente.** Infraestructura completa para la
ingesta, el procesamiento y la explotación de datos: arquitectura medallón
(bronze → silver → gold) orquestada con Airflow, data lake MinIO, base de datos
geoespacial PostGIS, API REST, dashboards analíticos y machine learning
productivizado.

Este repositorio aplica la plataforma a la **gestión del agua en las Islas
Baleares**: datos de DGRH, AEMET, IBESTAT y Open-Meteo, balance hídrico por masa
de agua, mapa interactivo y simulación del consumo urbano con modelos
entrenados por municipio.

**Demo en vivo:** [pladi.dadesbalears.es](https://pladi.dadesbalears.es)

## Funcionalidades

- **Mapa interactivo** de masas de agua subterránea, pozos, municipios y unidades de demanda, coloreadas por estado cuantitativo (DMA) con fichas de detalle por entidad.
- **Dashboards analíticos** (agua infiltrada, balance hídrico, abastecimiento, presión humana, ocupación turística) con filtros por isla/municipio/masa, comparativas interanuales y mapa de KPIs por municipio.
- **Simulación** de escenarios (variaciones de población empadronada, IPH y lluvia) sobre el consumo urbano y el balance hídrico proyectados, con modelos Gradient Boosting entrenados por municipio (MAPE medio 7,95% en el holdout 2022-2024).
- **Pipeline de datos medallón** (bronze → silver → gold) orquestado con Airflow: DGRH, AEMET, IBESTAT y Open-Meteo, con encadenamiento event-driven por *assets*.
- **ML productivizado**: registry de versiones de modelos (PostGIS + MinIO), retrain automatizado con guardrail de calidad y rollback atómico.
- **i18n** catalán/español y tema claro/oscuro en toda la interfaz.

## Arquitectura

```
                    ┌──────────────┐
                    │    Caddy     │  ← único servicio expuesto (80/443)
                    └──────┬───────┘  sirve web/dist + proxy /api/*
                           │
   ┌───────────────┬───────┴────────┬──────────────┐
   │   FastAPI     │    Airflow 3   │   Jupyter    │
   │   (mapa,      │  (ingestas +   │  (notebooks  │
   │  analytics,   │   ML Ops)      │  de análisis │
   │  simulación)  │                │  y modelos)  │
   └───┬───────┬───┴─────┬──────┬───┴──────┬───────┘
       │       │         │      │          │
   ┌───▼───┐ ┌─▼─────┐ ┌─▼──────▼─┐ ┌──────▼──────┐
   │PostGIS│ │ MinIO │ │ postgres │ │  modelos/   │
   │+gold  │ │bronze │ │ (metad.  │ │  (joblib)   │
   │       │ │silver │ │ Airflow) │ │             │
   └───────┘ └───────┘ └──────────┘ └─────────────┘
```

| Servicio | Puerto | Descripción |
|---|---|---|
| Caddy (web) | 80 / 443 | Frontend Astro + proxy `/api/*` → FastAPI |
| FastAPI | 8000 (127.0.0.1) | API REST `/api/v1` |
| PostGIS | 5432 (127.0.0.1) | PostgreSQL 17 + PostGIS 3.5 (dimensiones + tablas `gold.*` + registry ML) |
| MinIO | 9000 / 9001 (127.0.0.1) | Data lake bronze/silver/gold + bundles de modelos |
| Airflow | 8080 (127.0.0.1) | Orquestación de ingestas y ML (LocalExecutor) |
| Jupyter | 8888 (127.0.0.1) | Notebooks de EDA y experimentación |

## Requisitos

- **Docker** con **Compose ≥ 2.20** (el compose raíz usa `include`)
- **Node.js ≥ 20** (solo para construir el frontend)
- **curl** y **unzip** (los usa `scripts/fetch_models.sh`)
- ~8 GB de RAM y ~10 GB de disco (imágenes Docker + datos)
- Conexión a internet para las ingestas IBESTAT/AEMET/Open-Meteo (los datos DGRH base ya están en el repo)
- Una **API key gratuita de AEMET** ([alta de usuario](https://opendata.aemet.es/centrodedescargas/altaUsuario)): sin ella no se puede ejecutar la cadena precipitación → agua infiltrada → balance hídrico (los dashboards de DGRH, IBESTAT y el mapa funcionan igualmente)

## Puesta en marcha (≈10 minutos)

```bash
# 1. Clonar
git clone https://github.com/Luisbp27/pladi.git
cd pladi

# 2. Variables de entorno (edita las claves; PLADI_SITE=localhost ya viene por defecto)
cp docker/.env.example docker/.env

# 3. Frontend: variables de entorno del build
cp web/.env.production.example web/.env.production
#    opcional pero recomendado: añade PUBLIC_CARTO_API_KEY=<tu clave> (gratuita en carto.com)
#    sin clave el mapa funciona pero los tiles base quedan en blanco

# 4. Build del frontend (regla: usar siempre build:prod, ver Troubleshooting)
cd web && npm install && npm run build:prod && cd ..

# 5. Levantar la plataforma (la primera vez compila las imágenes, ~5-10 min)
cd docker && docker compose up -d --build

# 6. Esperar a que terminen los inicializadores
docker compose logs -f airflow-init      # hasta ver "=== Init complete ==="
docker compose logs postgis | tail -20   # carga las 9 tablas de dimensiones

# 7. Comprobar
curl http://localhost:8000/api/v1/health
```

La web queda en **http://localhost** (Caddy emite un certificado interno: acepta el aviso del navegador la primera vez). Alternativa sin Caddy: `cd web && npm run dev` → http://localhost:4321 (usa la API en `localhost:8000`).

PostGIS se inicializa solo en el primer arranque: DDL + 9 tablas de dimensiones desde `data/postgis_dgrh/` + schemas `gold` y `ml`.

## Poblar los datos (dashboards con contenido)

Los dashboards leen las tablas `gold.*`, que se rellenan con los DAGs de Airflow. Empieza siempre por `setup_buckets` (crea el bucket `pladi` de MinIO y los prefijos bronze/silver/gold). Después:

```bash
cd docker
set -a && source .env && set +a

# Token de autenticación (Airflow 3: POST /auth/token → JWT)
TOKEN=$(curl -s -X POST http://localhost:8080/auth/token \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$AIRFLOW_ADMIN_USER\",\"password\":\"$AIRFLOW_ADMIN_PASSWORD\"}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')

# Función auxiliar para lanzar un DAG (Airflow 3 exige logical_date)
run_dag() {
  curl -s -X POST "http://localhost:8080/api/v2/dags/$1/dagRuns" \
    -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d "{\"dag_run_id\":\"manual-$(date +%s)\",\"logical_date\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("dag_run_id") or d, d.get("state", ""))'
}

# 0. Estructura de MinIO (bucket `pladi` + prefijos) — @once
run_dag setup_buckets

# 1. Abastecimiento urbano (DGRH) — datos locales del repo, sin internet
for isla in mallorca menorca ibiza formentera; do
  run_dag dgrh_abastecimiento_urbano_$isla
done
#    → dispara automáticamente el gold abastecimiento_urbano_baleares (asset)

# 2. IBESTAT (censo, presión humana, ocupación turística) — requiere internet
for dag in ibestat_censo_baleares ibestat_indice_presion_humana \
           ibestat_ocupacion_hotelera ibestat_ocupacion_apartamentos_turisticos; do
  run_dag $dag
done

# 3. AEMET — key gratuita obligatoria para la cadena hídrica
docker compose exec airflow-webserver airflow variables set AEMET_API_KEY <tu_key>
run_dag aemet_estaciones
run_dag aemet_historico_meteo

# 4. Lluvia por masa (Open-Meteo, sin key) — requiere el catálogo AEMET del paso 3
run_dag openmeteo_lluvia_masa_subterranea
#    → dispara la cadena: lluvia_masa_subterranea → agua_infiltrada_masa_subterranea
#      → balance_hidrico_baleares
```

Progreso en la UI de Airflow: http://localhost:8080 (usuario/clave de `docker/.env`). Las cadenas event-driven corren solas: cada gold se dispara cuando sus fuentes publican su *asset*.

> Nota: en instalaciones nuevas los DAGs se crean despausados. Si alguno aparece pausado, despáusalo con `docker compose exec airflow-webserver airflow dags unpause <dag_id>` o vía API (`PATCH /api/v2/dags/<dag_id>?update_mask=is_paused` con `{"is_paused": false}`).

## Modelos de machine learning (para `/simulacion`)

Los 67 modelos (~1,2 MB comprimidos, gitignored) se distribuyen como **Release de GitHub** y se descargan con un script:

```bash
./scripts/fetch_models.sh            # descarga el bundle de la release v0.1.0
docker compose restart fastapi       # (desde docker/) FastAPI los carga al arrancar
```

- Sin modelos, la simulación devuelve un error claro (503) y el resto de la web funciona.
- **Alternativa (retrain)**: con los golds ya poblados, lanza `modelo_consumo_urbano` en Airflow — reentrena, publica el bundle en MinIO y lo registra en `ml.model_versions`; FastAPI lo sirve automáticamente. O ejecuta `notebooks/11_modelo_municipio.ipynb` en Jupyter.
- Para crear la release en tu fork: `gh release create v0.1.0 models-pladi-v0.1.0.zip --repo <tu-repo>` (el script respeta la variable `PLADI_REPO`).

## Servicios y accesos

| Servicio | URL local | Credenciales |
|---|---|---|
| Web (Caddy) | http://localhost | — |
| API docs | http://localhost:8000/docs | — |
| Airflow | http://localhost:8080 | `AIRFLOW_ADMIN_USER` / `AIRFLOW_ADMIN_PASSWORD` (docker/.env) |
| MinIO | http://localhost:9001 | `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` (docker/.env) |
| Jupyter | http://localhost:8888 | token `JUPYTER_TOKEN` (docker/.env) |

Todos los servicios bind a `127.0.0.1` salvo Caddy. En un servidor remoto, redirígelos con tu túnel SSH habitual.

## Producción

1. En `docker/.env`: `PLADI_SITE=tu-dominio.com` (Caddy obtiene el certificado Let's Encrypt automáticamente; asegúrate de que el dominio apunte al servidor y de abrir 80/443).
2. Crea `web/.env.production` con `PUBLIC_PLADI_API_URL=/api/v1` y tu `PUBLIC_CARTO_API_KEY`.
3. Construye el frontend: `cd web && npm ci && npm run build:prod` (genera `web/dist/`, que Caddy monta y sirve).
4. `docker compose up -d --build` desde `docker/`.

## Estructura del repositorio

```
api/            FastAPI (mapa, analytics, simulación, model store)
data/           Datos de arranque (CSVs PostGIS + Excels DGRH por isla)
docker/         Compose raíz + servicios (airflow, fastapi, jupyter, minio, postgis, Caddy)
docs/           schema.dbml (modelo de datos)
notebooks/      Análisis y experimentación (FASE VII)
scripts/        Utilidades (fetch_models.sh)
sql/            DDL de dimensiones, schemas gold/ml y carga de datos
web/            Frontend Astro 5 + React + Tailwind
memoria.md      Memoria técnica del proyecto (arquitectura, decisiones, bugs)
```

## Troubleshooting

- **El mapa no muestra tiles base**: falta `PUBLIC_CARTO_API_KEY` en `web/.env.production`; añádela y reconstruye con `npm run build:prod`.
- **`npm run build` sin `build:prod`**: carga `.env.production`, pero si contiene una URL local deja la web apuntando a `localhost:8000` del navegador. Regla: en producción usar **siempre** `npm run build:prod` y comprobar que `grep -r "localhost:8000" web/dist/` no devuelve nada.
- **PostGIS sin datos**: el init solo corre con el volumen vacío; para reinicializar, borra el volumen (`docker compose down -v postgis`) y vuelve a levantar.
- **`NoSuchBucket` al ejecutar un DAG**: falta el bucket `pladi` en MinIO → lanza el DAG `setup_buckets` (lo crea si no existe) y reintenta.
- **Un DAG queda en cola**: está pausado → despáusalos (ver «Poblar los datos»).
- **Airflow no arranca**: `docker compose logs airflow-init` — debe terminar con `=== Init complete ===` antes de que suban scheduler/webserver.
- **`/simulacion` devuelve 503**: no hay modelos cargados → `./scripts/fetch_models.sh` + restart de FastAPI.
- **Certificado en local**: Caddy usa un certificado interno para `localhost`; acepta el aviso del navegador o usa `npm run dev` (4321).
- **Reproducibilidad a largo plazo**: las imágenes (`minio/minio:latest`, `jupyter/base-notebook:latest`, `caddy:2-alpine`, `postgres:17`) y las dependencias Python (`>=`) no están fijadas; si necesitas congelar el entorno, fija tags y versiones exactas.

## Datos y atribución

Datos de la Direcció General de Recursos Hídrics del Govern de les Illes Balears (DGRH), AEMET, IBESTAT, IDEIB y Open-Meteo — datos públicos de sus respectivos organismos. Tiles base de CARTO y librería Leaflet.

El proyecto tiene una finalidad exclusivamente **académica y educativa**: no constituye un servicio oficial ni una herramienta de decisión.

## Licencia

MIT — ver [LICENSE](LICENSE).
