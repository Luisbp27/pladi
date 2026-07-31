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
| `{dev,pro}/bronze/` | Raw (Excel, CSV, JSON) | Datos crudos de ingestas |
| `{dev,pro}/silver/` | Delta Lake | Datos limpios / transformados |
| `{dev,pro}/gold/` | Delta Lake | Datos agregados para dashboards y modelo |

Los entornos se separan por prefijo (no por bucket) para facilitar la limpieza de dev sin afectar producción.

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
Los entornos (dev/pro) se separan por prefijo en MinIO, no por bucket.

```
MinIO
├── dev/
│   ├── bronze/    ← datos crudos (raw: Excel, CSV, JSON)
│   ├── silver/    ← datos limpios (Delta Lake)
│   └── gold/      ← datos agregados (Delta Lake)
│
└── pro/
    ├── bronze/
    ├── silver/
    └── gold/
```

### Estructura de archivos

```
docker/airflow/
├── dags/                           # DAGs = jobs de Databricks
│   ├── 00_setup_buckets.py         # one-time: crea estructura en MinIO
│   ├── 01_ingest_dgrh.py           # DGRH: extract (Excel/ODS) → clean (silver)
│   ├── 01_ingest_aemet.py          # AEMET: extract (API) → clean (silver)
│   ├── 01_ingest_ibestat.py        # IBESTAT: extract (CSV) → clean (silver)
│   ├── 02_gold_balance.py          # gold: balance hídrico por masa
│   └── 02_gold_consumo.py          # gold: consumo por UD (DGRH+IBESTAT)
│
├── include/                        # módulos reutilizables (~notebooks de Databricks)
│   ├── config.py                   # PLADI_ENV, paths MinIO, Airflow Variables
│   ├── bronze/
│   │   ├── dgrh.py                 # extract: leer Excel/ODS → MinIO raw
│   │   ├── aemet.py                # extract: API AEMET → MinIO raw
│   │   └── ibestat.py              # extract: CSV IBESTAT → MinIO raw
│   ├── silver/
│   │   ├── dgrh.py                 # clean: normalizar columnas, tipar con Polars
│   │   ├── aemet.py                # clean: filtrar estaciones, join con masa_subterranea
│   │   └── ibestat.py              # clean: filtrar Illes Balears, tipar
│   └── gold/
│       ├── balance.py              # aggregate: balance hídrico por masa
│       └── consumo.py              # aggregate: consumo por UD (join DGRH+IBESTAT)
│
├── Dockerfile                      # apache/airflow:3.3.0 + polars + deltalake + boto3
├── requirements.txt                # polars, deltalake, boto3, minio, psycopg2-binary
└── docker-compose.yml              # Airflow + postgres + init (conexiones MinIO/PostGIS)
```

### Mapeo Databricks → Airflow

| Databricks | Airflow | Explicación |
|---|---|---|
| Notebook | Módulo `.py` en `include/` | Código reutilizable, testable, funciones puras |
| Job | DAG | Orquesta tareas (extract → clean → aggregate) |
| Table update trigger | `Dataset` + `schedule=[ds]` | DAG gold se dispara cuando silver se actualiza |
| Widgets / parámetros | Airflow Variables | `PLADI_ENV`, `AEMET_API_KEY`, etc. |

### Patrón de DAGs

- **DAGs 01\* (ingestas)**: una tarea `extract` (bronze) + una tarea `clean` (silver). Se ejecutan con schedule.
- **DAGs 02\* (gold)**: tareas de `aggregate` que dependen de uno o varios datasets de silver vía Airflow Datasets. Sin schedule fijo, solo se disparan por trigger.

### Variables de Airflow

| Variable | dev | pro | Uso |
|---|---|---|---|
| `PLADI_ENV` | `dev` | `pro` | Define el prefijo en MinIO |
| `AEMET_API_KEY` | (key) | (key) | API key de AEMET OpenData |

### Fuentes de datos

| Fuente | Dato | Formato origen | Destino |
|---|---|---|---|
| DGRH | Abastecimiento urbano (4 islas) | Excel/ODS | `{env}/bronze/dgrh/` → `{env}/silver/dgrh/` |
| AEMET | Precipitación por estación | API REST | `{env}/bronze/aemet/` → `{env}/silver/aemet/` |
| IBESTAT | Censo / padrón municipal | CSV | `{env}/bronze/ibestat/` → `{env}/silver/ibestat/` |
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
| FASE III — Ingestas + poblar BBDD | ❌ |
| FASE IV — Modelos + data science | ❌ |
| FASE V — Frontend (Astro) | ✅ (unificado con FASE II) |
| FASE VI — Despliegue real | ❌ |

---

## Convenciones del proyecto

### Entornos y despliegue

- **dev vs pro**: separados por prefijo en MinIO (`dev/`, `pro/`), no por buckets distintos.
- **Dominio**: `pladi.dadesbalears.es` (configurado en dondominio, IP pública 88.23.187.133, router Movistar).
- **Reverse proxy**: Caddy con SSL automático (Let's Encrypt), pendiente de desplegar.

### Ingestas (FASE III)

- Cada ingesta es un DAG que cubre bronze → silver (extract + clean).
- Módulos de lógica pura en `docker/airflow/include/` separados por capa (bronze/, silver/, gold/).
- DAGs gold usan Airflow **Datasets** como triggers (equivalente a "table update" en Databricks).
- Formato: bronze = raw (archivo original), silver = Delta Lake (Polars), gold = Delta Lake (agregaciones).

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
