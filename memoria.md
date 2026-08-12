# pladi — Memoria del proyecto

## Arquitectura (FASE I — ✅ completada)

### Servicios dockerizados

| Servicio | Puerto | Estado | Descripción |
|---|---|---|---|
| PostGIS | 5432 | ✅ | 9 tablas de dimensiones pobladas |
| MinIO | 9000 / 9001 | ✅ | Datalake con buckets bronze/silver/gold |
| Airflow | 8080 | ✅ | LocalExecutor, conexiones a MinIO y PostGIS |
| FastAPI | 8000 | ✅ | `/api/v1/health` + endpoints GeoJSON para mapa |
| Astro | 4321 | ✅ | Frontend en desarrollo (FASE II) |
| Spark | — | ❌ | Procesamiento distribuido (opcional) |

### Estructura de carpetas
```
pladi/
├── api/                          # Código FastAPI (main.py, config.py, routers/)
│   ├── main.py                   # App + lifespan + CORS + routers
│   ├── config.py                 # Settings via pydantic-settings
│   ├── database.py               # Pool asyncpg + fetch_geojson_feature_collection()
│   ├── routers/
│   │   └── mapa.py               # GET /api/v1/mapa/{capas,masas,pozos,municipios,unidades-demanda}
│   └── schemas/                  # Pydantic models (futuro)
├── web/                          # App Astro 5 (FASE II — en desarrollo)
│   ├── astro.config.mjs          # Astro config: react + tailwind
│   ├── tailwind.config.mjs       # Tailwind 3 + Inter font
│   ├── src/
│   │   ├── layouts/
│   │   │   └── MainLayout.astro  # Base HTML: Inter, dark theme
│   │   ├── components/
│   │   │   ├── Navbar.astro      # Glass navbar + ThemeSwitcher (light/dark)
│   │   │   ├── Footer.astro      # Fuentes de datos clickeables + © 2026
│   │   │   ├── MapView.tsx       # 🏝️ React island: Leaflet + tile switching
│   │   │   ├── LayerPanel.tsx    # 🏝️ React island: panel capas flotante
│   │   │   ├── Drawer.tsx        # 🏝️ React island: drawer detalle funcional
│   │   │   └── ThemeSwitcher.tsx # 🏝️ React island: toggle ☀️/🌙
│   │   ├── pages/
│   │   │   ├── index.astro       # Mapa fullscreen + panel + drawer
│   │   │   ├── dashboards.astro  # Placeholder
│   │   │   └── simulacion.astro  # Placeholder
│   │   ├── lib/
│   │   │   ├── api.ts            # Cliente FastAPI + metadatos capas
│   │   │   └── store.ts          # Estado global (nanostores)
│   │   └── styles/
│   │       └── global.css        # Tailwind + Leaflet dark popup
├── data/
│   ├── postgis_dgrh/             # CSVs de dimensiones (9 tablas)
│   └── abastecimiento_urbano/
├── docker/
│   ├── .env                      # Variables de entorno globales
│   ├── docker-compose.yml        # Orquestador raíz (include)
│   ├── postgis/                  # docker-compose + init SQL
│   ├── minio/                    # docker-compose
│   ├── airflow/                  # Dockerfile, dags/, plugins/, init
│   └── fastapi/                  # Dockerfile, requirements.txt
├── docs/
│   └── schema.dbml               # Modelo de datos normalizado (DBML)
├── sql/
│   ├── dgrh_bbdd_postgis.sql     # DDL (9 tablas)
│   └── load_data.sql             # Carga de CSVs con geometrías
├── memoria.md
└── plan.md
```

### Base de datos — PostGIS (SRID 4326)

| Tabla | Filas | Descripción |
|---|---|---|
| provincia | 4 | Códigos INE (071-074) |
| municipio | 67 | Con geometría MULTIPOLYGON |
| unidad_demanda | 10 | Agrupa masas por zona de gestión |
| masa_subterranea | 87 | Acuíferos con geometría |
| pozos | 1226 | Red de control (calidad + piezometría) |
| balance_masas_subterraneas_porcentajes | 82 | Componentes del balance hídrico |
| infiltracion_epoca_material | 661 | Coeficientes de infiltración |
| masa_subterranea_estacion_aemet | 284 | Relación masa ↔ estación meteorológica |
| municipio_masa_subterranea | 153 | Relación municipio ↔ masa |

### Data Lake — MinIO

| Ubicación | Formato | Uso |
|---|---|---|
| `bronze/` | Raw (Excel, CSV, JSON) | Datos crudos de ingestas |
| `silver/` | Delta Lake | Datos limpios / transformados |
| `gold/` | Delta Lake | Datos agregados para dashboards y modelo |

---

## FASE II — Frontend (✅ completada — migrado a Astro)

### Marco
- **Framework**: Astro 5 (static output) + React islands (MapView, LayerPanel, Drawer)
- **Estilo**: Tailwind CSS 3, darkMode: "class", light mode por defecto, botón sol/luna en navbar
- **Estado**: Nanostores para estado compartido entre islas (theme, activeLayers, geojsonData, drawer, etc.)
- **Referencias**: [IBMeteo](https://ibmeteo.com/) y [Dato Asturias](https://datoasturias.com/)

### Componentes implementados
| Componente | Estado | Stack | Descripción |
|---|---|---|---|
| Navbar glass | ✅ | Astro static | backdrop-blur, 44px, logo droplets, links con active state |
| Panel de capas | ✅ | React island | Flotante top-left, switches, spinners de carga, contadores, colapsable |
| Footer | ✅ | Astro static | Fixed bottom, fuentes DGRH·AEMET·IDEIB·IBESTAT |
| Mapa Leaflet | ✅ | React island | Tiles CartoDB dark/light, popups estilizados, carga/descarga dinámica |
| Drawer detalle | ✅ | React island | Drawer derecho funcional, overlay, propiedades feature (bug arreglado) |

### API Endpoints (FastAPI)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/health` | Health check |
| GET | `/api/v1/mapa/capas` | Lista de 4 capas disponibles |
| GET | `/api/v1/mapa/masas` | GeoJSON FeatureCollection (87 features, ST_Simplify 0.001) |
| GET | `/api/v1/mapa/pozos` | GeoJSON FeatureCollection (1226 features) |
| GET | `/api/v1/mapa/municipios` | GeoJSON FeatureCollection (67 features) |
| GET | `/api/v1/mapa/unidades-demanda` | GeoJSON FeatureCollection (10 features) |

### Estado del frontend
- **Build estático**: `npx astro build` genera `dist/` sin errores (3 páginas)
- **Dev server**: `npm run dev` en `http://localhost:4321`
- Leaflet se carga vía CDN en `MapView.tsx` (client:load island) — **sin SSR/hydration errors**
- **Drawer funcional**: implementado como React island con transición CSS, overlay y cierre X
- Comunicación popup → drawer: `window.dispatchEvent('pladi:feature-detail')` → nanostores → Drawer re-render

### Flujo de carga de capas (corregido 2026-07-30)

**Bug inicial**: `loadDefaultLayers()` llamaba a `toggleLayer()`, que invierte el estado.
Como `masas` y `pozos` arrancan como `true`, `toggleLayer` las pasaba a `false` → desactivaba
la capa y seteaba `geojsonData` a `null` → capas invisibles.

**Solución** (`store.ts`):
1. `loadLayer(id)` — fuerza la carga directa (fetch → `geojsonData.setKey`) sin togglear estado
2. `toggleLayer(id)` — invierte `activeLayers`; si activa → llama `loadLayer()`; si desactiva → `geojsonData.setKey(null)`
3. `loadDefaultLayers()` — recorre `activeLayers` y llama `loadLayer(id)` para las activas

**Flujo completo**:
1. MapView monta → carga Leaflet CDN → inicializa `L.map()` en `#pladi-map`
2. `script.onload` → dynamic import → `loadDefaultLayers()` → `loadLayer(id)` → `fetch()` FastAPI → `geojsonData.setKey(id, data)`
3. React `useStore(geojsonData)` detecta cambio → `useEffect` llama `addLayer(id, data, options)`
4. `addLayer()` → `window.L.geoJSON(data, options).addTo(map)` — capa visible
5. Toggle usuario (panel capas) → `toggleLayer(id)` → activa/desactiva + carga/descarga capa

### Notas para debugging
- **Capas no visibles**: revisar consola (F12) — errores de fetch a `http://localhost:8000/api/v1/mapa/{endpoint}` indican que FastAPI no está corriendo
- **Mapa no carga**: verificar que el CDN de Leaflet y CartoDB no estén bloqueados; la consola muestra errores 404/CORS
- **Estado en React DevTools**: inspeccionar nanostores atoms (`geojsonData`, `activeLayers`, `layerLoading`) para ver si los datos llegaron
- `loadDefaultLayers()` solo carga capas cuyo `activeLayers[id] === true` al iniciar (por defecto: masas + pozos)
- El `setTimeout(300)` en `loadDefaultLayers` da tiempo a que el mapa termine de inicializarse

### Limitaciones resueltas
- ~~Reflex 0.5.10 bugs (hydration, drawer, rx.cond)~~ → **Migrado a Astro 5**
- ~~Comunicación JS→Python vía input oculto~~ → **Nanostores + custom events**
- ~~Workarounds de `call_script`~~ → **React state directo + fetch API**
- ~~Bug toggleLayer en loadDefaultLayers~~ → **Función loadLayer() separada (2026-07-30)**

### Cómo arrancar
```bash
# Terminal 1: FastAPI (Docker)
cd docker && docker compose up -d

# Terminal 2: Astro dev server
cd web && npm run dev
# → http://localhost:4321
```

### Cómo construir para producción
```bash
cd web && npm run build
# Output en web/dist/
```

---

## Ingestas (FASE III — 🚧 en desarrollo)

### Arquitectura de datos

Las ingestas siguen el patrón medallón (bronze → silver → gold) orquestadas por Airflow.

```
MinIO
├── bronze/    ← datos crudos (raw: Excel, CSV, JSON)
├── silver/    ← datos limpios (Delta Lake)
└── gold/      ← datos agregados (Delta Lake) → PostGIS gold.*
```

### Estructura de archivos (real)

```
docker/airflow/
├── dags/                                    # 12 DAGs
│   ├── setup_buckets.py                     # one-time: estructura de buckets MinIO
│   ├── abastecimiento_urbano_baleares.py    # gold DGRH (4 islas → PostGIS)
│   ├── aemet_estaciones.py                  # AEMET: estaciones
│   ├── aemet_historico_meteo.py             # AEMET: histórico meteorológico
│   ├── dgrh_abastecimiento_urbano_*.py      # ×4 (mallorca/menorca/ibiza/formentera)
│   └── ibestat_*.py                         # ×4 (censo/iph/hotelera/apartamentos)
│
├── include/                                 # módulos reutilizables
│   ├── config.py                            # IBESTAT_URLS + paths MinIO + BUCKET
│   ├── parsers/
│   │   ├── dgrh.py                          # parser Excel/ODS por isla
│   │   └── ibestat.py                       # lector CSV bilingüe IBESTAT
│   ├── bronze/
│   │   ├── ibestat.py                       # core: extract() HTTP→MinIO (boto3)
│   │   └── ibestat_*.py                     # ×4 thin wrappers por dataset
│   ├── silver/
│   │   ├── ibestat.py                       # helpers: parse_time_period, filter_municipal, enrich_geo, DELTA_STORAGE_OPTIONS
│   │   └── ibestat_*.py                     # ×4 limpieza específica (Polars → Delta)
│   └── gold/
│       ├── abastecimiento_urbano_baleares.py  # DGRH → gold.abastecimiento_urbano_baleares
│       ├── censo_municipal.py               # → gold.censo_municipal
│       ├── presion_humana.py                # → gold.presion_humana
│       └── ocupacion_turistica.py           # → gold.ocupacion_turistica
│
├── Dockerfile                               # apache/airflow:3.3.0 + polars + deltalake + boto3
├── requirements.txt                         # polars, deltalake, boto3, minio, psycopg2-binary
└── docker-compose.yml                       # Airflow + postgres + init + dag-processor
```

### Arquitectura Airflow 3 (notas)

- Airflow 3.3.0 requiere un contenedor **`airflow-dag-processor`** separado para parsear DAGs.
- `PYTHONPATH=/opt/airflow` para que los imports de `include.*` funcionen.
- Scheduler ejecuta con `--also-serve-api` + `AIRFLOW__CORE__INTERNAL_API_URL=http://airflow-webserver:8080` para que LocalExecutor pueda ejecutar tareas.
- Bronze IBESTAT usa **boto3 directo** (no `S3Hook`) con timeouts `(15, 300)` + retry (los CSV de IBESTAT superan los 3 MB y requieren read-timeout amplio).

### Mapeo Databricks → Airflow

| Databricks | Airflow | Explicación |
|---|---|---|
| Notebook | Módulo `.py` en `include/` | Código reutilizable, testable, funciones puras |
| Job | DAG | Orquesta tareas (extract → clean → load) |
| Table update trigger | `Dataset` + `schedule=[ds]` | DAG gold se dispara cuando silver se actualiza |
| Widgets / parámetros | Airflow Variables | `AEMET_API_KEY`, etc. |

### Patrón de DAGs

- **DAGs de ingesta** (dgrh/aemet/ibestat): `extract` (bronze) → `clean` (silver) → `load_gold` (PostGIS). Schedule `@daily`.
- **DAGs gold**: cargan de silver a PostGIS `gold.*` con upsert (`ON CONFLICT ... DO UPDATE`).

### IBESTAT — datasets implementados

| Dataset | URL (IBESTAT API) | Granularidad | Tiempo |
|---|---|---|---|
| `censo_baleares` | `.../000305A_000010/~latest.csv` | Municipal (INE) | Anual |
| `indice_presion_humana` | `.../000011A_000002/~latest.csv` | Isla (NUTS) | Diario → agregado mensual |
| `ocupacion_hotelera` | `.../000061A_000006/~latest.csv` | Municipal (INE) | Mensual |
| `ocupacion_apartamentos_turisticos` | `.../000060A_000006/~latest.csv` | Municipal (INE) | Mensual |

Los datasets de `ocupacion_campings` y `ocupacion_turismo_rural` fueron descartados (sin desglose municipal).

Los CSVs IBESTAT contienen datos a múltiples granularidades (Baleares → isla → municipio).
En silver se filtra a la granularidad más baja (`TERRITORIO_CODE` INE de 5 dígitos `07xxxx`),
excepto IPH que solo existe a nivel isla (NUTS).

### Tablas gold IBESTAT (DDL en `sql/gold_ibestat.sql`)

| Tabla | PK | Columnas |
|---|---|---|
| `gold.censo_municipal` | `(cod_municipio_ine, anio)` | cod_provincia_ine, nombre_provincia, cod_municipio_ine, nombre_municipio, anio, poblacion |
| `gold.presion_humana` | `(nombre_isla, anio, mes)` | cod_provincia_ine, nombre_provincia, nombre_isla, anio, mes, iph |
| `gold.ocupacion_turistica` | `(cod_municipio_ine, anio, mes, tipo_alojamiento)` | cod_provincia_ine, nombre_provincia, cod_municipio_ine, nombre_municipio, anio, mes, tipo_alojamiento, ocupacion_plazas_pct |

`ocupacion_turistica` unifica hotelera + apartamentos con columna `tipo_alojamiento` y solo la métrica `ocupacion_plazas_pct`.

### Fuentes de datos

| Fuente | Dato | Formato origen | Destino |
|---|---|---|---|
| DGRH | Abastecimiento urbano (4 islas) | Excel/ODS | `bronze/dgrh/` → `silver/dgrh/` |
| AEMET | Precipitación por estación | API REST | `bronze/aemet/` → `silver/aemet/` |
| IBESTAT | Censo, IPH, ocupación turística | CSV (API) | `bronze/ibestat/` → `silver/ibestat/` |
| IDEIB | Dimensiones geográficas | ya en PostGIS | — |

### Airflow connections (auto-configuradas en init)

| Connection ID | Tipo | Destino |
|---|---|---|
| `minio_default` | AWS S3 | MinIO (`http://minio:9000`) |
| `postgis_pladi` | Postgres | PostGIS (`postgis:5432`) |

---

## Fases pendientes

| Fase | Estado |
|---|---|
| FASE I — Arquitectura | ✅ Completada |
| FASE II — Diseño de frontales | ✅ Completada (Astro 5 + React islands) |
| FASE III — Ingestas + poblar BBDD | 🚧 IBESTAT ✅ end-to-end (bronze→silver→gold); DGRH/AEMET pendientes de test |
| FASE IV — Modelos + data science | ❌ |
| FASE V — Frontend (Astro) | ✅ (unificado con FASE II) |
| FASE VI — Despliegue real | ✅ Completada — VPS en producción |

---

## Convenciones del proyecto

### Entornos y despliegue

- **Dominio**: `pladi.dadesbalears.es` (dondominio, registro A → `169.58.169.55`).
- **Hosting**: VPS Ubuntu 24.04 (x86_64) — Docker + Docker Compose.
- **Reverse proxy**: Caddy con SSL automático (Let's Encrypt). Único servicio expuesto (80/443); el resto de servicios bind a `127.0.0.1`.
- **Acceso admin** (Airflow/MinIO): vía SSH tunnel (`ssh -L 8080:localhost:8080 -L 9001:localhost:9001 root@169.58.169.55`).
- **Carga de datos PostGIS**: `postgis/docker-compose.yml` monta `data/postgis_dgrh → /tmp/pladi_data` para que `load_data.sql` cargue los CSVs automáticamente en el primer init.
- **Credenciales**: `docker/.env` (gitignored) con contraseñas aleatorias por entorno.
- **Frontend en producción**: build con `npm run build` → `web/dist/` servido por Caddy.

### Ingestas (FASE III)

- Cada ingesta es un DAG que cubre bronze → silver → gold (extract + clean + load).
- Módulos de lógica pura en `docker/airflow/include/` separados por capa (bronze/, silver/, gold/) + `parsers/`.
- Formato: bronze = raw (archivo original), silver = Delta Lake (Polars), gold = PostGIS (`gold.*`).
- Bronze IBESTAT: `boto3` directo, timeout `(15, 300)` + retry HTTP.
- Silver comparte helpers en `include/silver/ibestat.py` (parse_time_period, filter_municipal, enrich_geo, DELTA_STORAGE_OPTIONS).

### Frontend (FASE II)

- **Framework**: Astro 5 con React islands (`client:load`).
- **Tema**: Tailwind `darkMode: "class"` con **light mode por defecto**. Botón ☀️/🌙 en el navbar.
- **Estado**: Nanostores atoms (`theme`, `activeLayers`, `geojsonData`, `drawerOpen`, etc.) compartidos entre islas.
- **Mapa**: Leaflet 1.9.4 vía CDN (nunca como módulo npm). Sin zoom nativo ni control de capas (se gestionan vía UI propia).
- **Capas**: orden en panel: Municipios → Pozos → Masas Subterráneas → Unidades de Demanda.
- Build: `cd web && npm run build` → `web/dist/` (servido por Caddy en producción).

### API (FASE I)

- **Framework**: FastAPI + asyncpg + pydantic-settings.
- **GeoJSON**: FeatureCollection vía `ST_AsGeoJSON` + `ST_SimplifyPreserveTopology` desde PostGIS.
- **CORS**: abierto (`allow_origins=["*"]`) para desarrollo.
- **API URL**: configurable vía `PUBLIC_PLADI_API_URL` (frontend) o misma URL en producción con Caddy.

### Base de datos (FASE I)

- **Motor**: PostgreSQL 17 + PostGIS 3.5.
- **SRID**: 4326 (WGS84) para todas las geometrías.
- **Tablas**: 9 tablas de dimensiones pobladas desde CSVs vía `sql/load_data.sql`.
