# pladi

**PLADI** — Plataforma de Datos Inteligente de la Dirección General de Recursos Hídricos del Gobierno de las Islas Baleares.

Una plataforma completa de datos abiertos sobre el ciclo del agua en Baleares: ingestas automatizadas (arquitectura medallón), base de datos geoespacial, dashboards analíticos, mapa interactivo y simulación del consumo urbano con modelos de machine learning.

## Funcionalidades

- **Mapa interactivo** de masas de agua subterránea, pozos, municipios y unidades de demanda, coloreadas por estado cuantitativo (DMA) con fichas de detalle por entidad.
- **Dashboards analíticos** (agua infiltrada, balance hídrico, abastecimiento, presión humana, ocupación turística) con filtros por isla/municipio/masa, comparativas interanuales y mapa de KPIs por municipio.
- **Simulación** de escenarios (variaciones de IPH, ocupación turística y lluvia) sobre el consumo urbano y el balance hídrico proyectados, con modelos Gradient Boosting entrenados por municipio (MAPE medio 8,7%).
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
- ~8 GB de RAM y ~10 GB de disco (imágenes Docker + datos)
- Conexión a internet para las ingestas IBESTAT/AEMET/Open-Meteo (los datos DGRH base ya están en el repo)

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

Los dashboards leen las tablas `gold.*`, que se rellenan con los DAGs de Airflow. El DAG `setup_buckets` (estructura MinIO) corre solo con `@once`. Para el resto:

```bash
cd docker
set -a && source .env && set +a

# Token de autenticación (Airflow 3: POST /auth/token → JWT)
TOKEN=$(curl -s -X POST http://localhost:8080/auth/token \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$AIRFLOW_ADMIN_USER\",\"password\":\"$AIRFLOW_ADMIN_PASSWORD\"}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')

# Función auxiliar para lanzar un DAG
run_dag() {
  curl -s -X POST "http://localhost:8080/api/v2/dags/$1/dagRuns" \
    -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d "{\"dag_run_id\":\"manual-$(date +%s)\"}" | python3 -c 'import json,sys; print(sys.stdin.read())'
}

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

# 3. Lluvia por masa — sin key: Open-Meteo; con key AEMET: añade también la serie oficial
run_dag openmeteo_lluvia_masa_subterranea
#    → dispara la cadena: lluvia_masa_subterranea → agua_infiltrada_masa_subterranea
#      → balance_hidrico_baleares

# (opcional) AEMET: variable de Airflow con la API key gratuita de aemet.es
docker compose exec airflow-webserver airflow variables set AEMET_API_KEY <tu_key>
run_dag aemet_estaciones
run_dag aemet_historico_meteo
```

Progreso en la UI de Airflow: http://localhost:8080 (usuario/clave de `docker/.env`). Las cadenas event-driven corren solas: cada gold se dispara cuando sus fuentes publican su *asset*.

> Nota: si un DAG aparece pausado, despáusalo: `docker compose exec airflow-webserver airflow dags unpause <dag_id>`.

## Modelos de machine learning (para `/simulacion`)

Los 67 modelos (17 MB, gitignored) se distribuyen como **Release de GitHub** y se descargan con un script:

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
3. `docker compose up -d --build` desde `docker/`.

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
- **Airflow no arranca**: `docker compose logs airflow-init` — debe terminar con `=== Init complete ===` antes de que suban scheduler/webserver.
- **`/simulacion` devuelve 503**: no hay modelos cargados → `./scripts/fetch_models.sh` + restart de FastAPI.
- **Certificado en local**: Caddy usa un certificado interno para `localhost`; acepta el aviso del navegador o usa `npm run dev` (4321).

## Datos y atribución

Datos de la Direcció General de Recursos Hídrics del Govern de les Illes Balears (DGRH), AEMET, IBESTAT, IDEIB y Open-Meteo — datos públicos de sus respectivos organismos. Tiles base de CARTO y librería Leaflet.

## Licencia

MIT — ver [LICENSE](LICENSE).
