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
| Jupyter | 8888 | ✅ | Notebooks FASE VII (token en docker/.env) |
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
├── dags/                                    # 15 DAGs (todos con max_active_runs=1)
│   ├── setup_buckets.py                     # one-time: estructura de buckets MinIO
│   ├── abastecimiento_urbano_baleares.py    # gold DGRH (4 islas → PostGIS)
│   ├── aemet_estaciones.py                  # AEMET: estaciones (44 Baleares)
│   ├── aemet_historico_meteo.py             # AEMET: histórico diario 2015→mes cerrado
│   ├── dgrh_abastecimiento_urbano_*.py      # ×4 (mallorca/menorca/ibiza/formentera)
│   ├── ibestat_*.py                         # ×4 (censo/iph/hotelera/apartamentos)
│   ├── openmeteo_lluvia_masa_subterranea.py # Open-Meteo: lluvia diaria × masa sin estación
│   └── lluvia_masa_subterranea.py           # gold: fusión AEMET+Open-Meteo mensual × masa
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
│   │   ├── dgrh.py                          # helpers: enrich_geo (nombre→cod_municipio + aliases)
│   │   ├── aemet_estaciones.py              # DMS→decimal + spatial join municipio
│   │   └── ibestat_*.py / dgrh_*.py         # limpieza específica (Polars → Delta)
│   └── gold/
│       ├── abastecimiento_urbano_baleares.py  # DGRH → gold.abastecimiento_urbano_baleares
│       ├── censo_municipal_baleares.py       # → gold.censo_municipal_baleares
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
- Scheduler ejecuta con `scheduler` (Airflow 3.3 no soporta `--also-serve-api`). El API server corre por separado en `airflow-webserver`.
- `AIRFLOW__CORE__EXECUTION_API_SERVER_URL=http://airflow-webserver:8080/execution/` + `AIRFLOW__API__BASE_URL=http://airflow-webserver:8080` para que LocalExecutor pueda ejecutar tareas. La config `INTERNAL_API_URL` de Airflow 2 no existe en 3.3 y es ignorada.
- `airflow-init` crea `/opt/airflow/logs` con ownership `50000:50000` (usuario `airflow`) para que scheduler y dag-processor puedan escribir logs.
- Volumen `../../data:/opt/airflow/data:ro` montado en todos los servicios Airflow para que los DAGs DGRH puedan leer los Excel/ODS de abastecimiento urbano.
- Bronze IBESTAT usa **boto3 directo** (no `S3Hook`) con timeouts `(15, 300)` + retry (los CSV de IBESTAT superan los 3 MB y requieren read-timeout amplio).

### Mapeo Databricks → Airflow

| Databricks | Airflow | Explicación |
|---|---|---|
| Notebook | Módulo `.py` en `include/` | Código reutilizable, testable, funciones puras |
| Job | DAG | Orquesta tareas (extract → clean → load) |
| Table update trigger | `Dataset` + `schedule=[ds]` | DAG gold se dispara cuando silver se actualiza |
| Widgets / parámetros | Airflow Variables | `AEMET_API_KEY`, etc. |

### Patrón de DAGs

- **DAGs de ingesta** (dgrh/aemet/ibestat): `extract` (bronze) → `clean` (silver) → `load_gold` (PostGIS).
  - XComs se pasan como argumento: `clean(source_path=extract())` y `load_gold(source_path=clean_result)`. El operador `>>` solo establece orden, no pasa XComs.
- **DAGs gold**: cargan de silver a PostGIS `gold.*` con upsert (`ON CONFLICT ... DO UPDATE`).

### Schedules (revisados 2026-08-15, cadencia = publicación de la fuente)

| Schedule | DAGs |
|---|---|
| `@monthly` | 4× IBESTAT, aemet_estaciones, aemet_historico_meteo, openmeteo_lluvia_masa_subterranea, 4× dgrh_abastecimiento_urbano_* |
| **Asset-triggered** | `abastecimiento_urbano_baleares` (← 4 islas DGRH), `lluvia_masa_subterranea` (← aemet_histórico OR openmeteo), `agua_infiltrada_masa_subterranea` (← lluvia), `balance_hidrico_baleares` (← agua_infiltrada) |
| `@once` | setup_buckets |

- **Cadena event-driven completa** (los golds corren justo después de sus fuentes):
  ```
  dgrh ×4 ──Asset──► abastecimiento_urbano_baleares
  aemet_historico ──Asset──► lluvia_masa_subterranea ──► agua_infiltrada ──► balance
  openmeteo ───────Asset────┘
  ```
- **Productores**: los DAGs upstream devuelven `Asset(uri)` desde su último task (Airflow 3.3 registra el outlet por el valor de retorno). URIs: `pladi://silver/dgrh/abastecimiento_urbano` (compartido por las 4 islas), `pladi://silver/aemet/historico_meteo`, `pladi://silver/openmeteo/lluvia_masa_subterranea`, `pladi://gold/lluvia_masa_subterranea`.
- ⚠️ **Multi-asset**: una lista simple en `schedule=[A, B]` se comporta como AND (el DAG no dispara hasta que TODOS tengan eventos). Para OR usar `schedule=AssetAny(A, B)` (caso de lluvia_masa_subterranea).
- Los runs manuales de un upstream también disparan el gold (el mecanismo es por evento de asset, no por schedule).

### IBESTAT — datasets implementados

| Dataset | URL (IBESTAT API) | Granularidad | Tiempo |
|---|---|---|---|
| `censo_baleares` | `.../000001A_000001/~latest.csv` (padrón municipal, 1998-2025) | Municipal (INE) | Anual |
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
| `gold.censo_municipal_baleares` | `(cod_municipio_ine, anio)` | cod_provincia_ine, nombre_provincia, cod_municipio_ine, nombre_municipio, anio, poblacion — **fuente padrón municipal 1998-2025 desde 2026-09-12** (la tabla conserva el nombre `censo`; antes censo continuo 2021-25) |
| `gold.presion_humana` | `(nombre_isla, anio, mes)` | cod_provincia_ine, nombre_provincia, nombre_isla, anio, mes, iph |
| `gold.ocupacion_turistica` | `(cod_municipio_ine, anio, mes, tipo_alojamiento)` | cod_provincia_ine, nombre_provincia, cod_municipio_ine, nombre_municipio, anio, mes, tipo_alojamiento, ocupacion_plazas_pct |
| `gold.lluvia_masa_subterranea` | `(cod_masa, anio, mes)` | cod_masa, anio, mes, precipitacion_mm, fuente (`aemet`/`openmeteo`) |

`ocupacion_turistica` unifica hotelera + apartamentos con columna `tipo_alojamiento` y solo la métrica `ocupacion_plazas_pct`.

### Fuentes de datos

| Fuente | Dato | Formato origen | Destino |
|---|---|---|---|
| DGRH | Abastecimiento urbano (4 islas) | Excel/ODS | `bronze/dgrh/` → `silver/dgrh/` |
| AEMET | Precipitación por estación | API REST | `bronze/aemet/` → `silver/aemet/` |
| IBESTAT | Censo, IPH, ocupación turística | CSV (API) | `bronze/ibestat/` → `silver/ibestat/` |
| IDEIB | Dimensiones geográficas | ya en PostGIS | — |

### Bugs corregidos en DGRH y AEMET (2026-08-14)

- **Parser DGRH nombres compuestos**: `_is_continuation` no reconocía `EULÀRIA` tras `SANTA` (Eivissa) → añadido `SANTA` al regex de prefijos. La 1ª pasada ahora propaga hacia atrás el nombre completo en cadenas de 3+ partes (`SANTA EULÀRIA DES RIU` ya no deja residuos `SANTA EULÀRIA`).
- **`SILVER_SOURCES` del gold**: usaba prefijos `silver/dgrh/dgrh_abastecimiento_urbano_*` cuando los reales son `silver/dgrh/abastecimiento_urbano_*` (sin `dgrh_`). Era la causa del `TableNotFoundError` en el gold DGRH.
- **odfpy**: sí estaba instalado (módulo importable `odf`, no `odfpy`). `pd.read_excel` lee los `.ods` sin problema.
- **AEMET inventario**: endpoint correcto es `.../inventarioestaciones/todasestaciones` (no `todaslasestaciones`). Las coordenadas vienen en **DMS** (`394924N`) → parser `_dms_to_decimal` en silver.
- **Spatial join AEMET**: `ST_Contains` contra `public.municipio` + fallback al municipio más cercano (`<->`) para estaciones en el borde (B569X Capdepera a ~30 m del límite). Se filtran solo estaciones de Baleares (26).

### Convención: conformación con la dimensión en silver

Los municipios/provincias SIEMPRE se conforman con `public.municipio`/`public.provincia` en la capa **silver** (nunca en gold):
- IBESTAT: por código INE (`enrich_geo` en `silver/ibestat.py`)
- DGRH: por nombre literal + aliases (`enrich_geo` en `silver/dgrh.py`)
- AEMET: por spatial join (`silver/aemet_estaciones.py`)
- El gold solo concatena silvers y hace upsert a PostGIS.

### Bugs corregidos en IBESTAT (2026-08-14)- **`parse_time_period`**: `cod_tiempo` puede llegar como Int64 (años puros) → `str()` defensivo. Soportados los formatos reales de IBESTAT: `2025` (anual), `2026-M06` (mensual) y `2026-05-31` (fecha completa).
- **`write_delta` en local**: los paths `silver/...` sin esquema se escribían en disco local del scheduler. FIX: prefijo `s3://{BUCKET}/` en los 4 módulos silver IBESTAT.
- **`read_ibestat_csv`**: `schema_overrides` fuerza `TERRITORIO_CODE` y `TIME_PERIOD_CODE` a Utf8 (los CSV traen códigos municipales con ceros a la izquierda sin comillas, p. ej. `07003`).
- **Typo en `COLUMN_RENAME`**: `medida_code` → `medidas_code` (la columna CSV es `MEDIDAS_CODE`); sin esto `cod_medida` no existía y fallaba el pivot de ocupación.
- **Filas anuales en ocupación**: los CSV de hotelera/apartamentos mezclan períodos anuales (`2025`) y mensuales (`2026-M06`). Silver descarta las filas sin `mes` antes del `replace_strict` (la tabla gold exige `mes` en PK).
- **DAGs pausados**: los DAGs IBESTAT (excepto censo) estaban `paused=True` en Airflow → runs manuales se quedaban en `queued`. Requieren unpause.
- **Tabla renombrada**: `gold.censo_municipal` → `gold.censo_municipal_baleares` (módulo `include/gold/censo_municipal_baleares.py`, DDL en `sql/gold_ibestat.sql`).
- **Población duplicada (2026-08-15)**: el CSV del censo trae la dimensión `EDAD_CODE` con edades individuales (`Y0`…`Y_GE100`) **más una fila total `_T`**. El silver sumaba todas → población ×2 (Baleares 2,5M en vez de 1,25M). FIX: filtrar `cod_edad == "_T"` en el silver del censo (la fila total cuadra con la suma de edades individuales).

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
| FASE III — Ingestas + poblar BBDD | ✅ Completada (IBESTAT, DGRH, AEMET, Open-Meteo, gold lluvia — 2026-08-14) |
| FASE IV — Dashboards + UI/UX | ✅ Completada (2026-08-15) — ver sección "Dashboards y analítica" |
| FASE V — Frontend (Astro) | ✅ (unificado con FASE II) |
| FASE VI — Despliegue real | ✅ Completada — despliegue Docker en producción |
| FASE VII — Modelos + data science | ✅ Completada (2026-09-02) — notebooks, UI `/simulacion` y productivización del modelo |

---

## Dashboards y analítica (FASE IV — ✅ 2026-08-15, ampliada con infiltración y balance)

### Backend — `api/routers/analytics.py`

| Endpoint | Contenido |
|---|---|
| `GET /api/v1/analytics/resumen?isla=&municipio=` | KPIs: infiltración AH total del ámbito + desviación, IPH pico (**Baleares = pico de la suma mensual de las 3 series NUTS**, 2026-09), ocupación (Baleares = media de islas), población, consumo, masas en déficit |
| `GET /api/v1/analytics/infiltrada?isla=&masa=` | Serie mensual hm³ (suma por ámbito o por masa) + media de referencia (2015-25) |
| `GET /api/v1/analytics/infiltrada/ranking?isla=` | Desviación % AH por masa |
| `GET /api/v1/analytics/balance?nivel=masa|ud&isla=&entidad=` | Serie anual del balance por masa/UD/isla (sumas, explotación ponderada, conteos de estado) |
| `GET /api/v1/analytics/balance/ranking?nivel=&isla=&anio=` | Ranking por masa/UD del año indicado (default último disponible) |
| `GET /api/v1/analytics/abastecimiento?isla=&municipio=` | Anual por origen + top municipios |
| `GET /api/v1/analytics/presion?isla=` | IPH mensual + media + **población censal anual por serie NUTS** |
| `GET /api/v1/analytics/ocupacion?isla=&tipo=&municipio=` | Ocupación mensual (Baleares = media de las islas) |
| `GET /api/v1/analytics/ocupacion/ranking?isla=&anio=&tipo=` | Ranking de municipios por ocupación media anual (solo con datos) |
| `GET /api/v1/analytics/uds?isla=` / `municipios?isla=` / `masas?isla=` | Catálogos para SearchSelect |
| `GET /api/v1/analytics/mapa/kpis?isla=` | KPIs por municipio para el mapa choropleth de Visión general (consumo 2024, ocupación 12m, población padrón) |
| `GET /api/v1/analytics/entidad/{tipo}/{cod}` | KPIs + sparkline para drawer (masa: infiltración + balance; municipio/pozo/ud) |

- Los endpoints antiguos `/lluvia` se mantienen sin uso en el front (por si acaso).
- **Año hidrológico** (sep-ago): `ah = anio + (mes >= 9 ? 1 : 0)`.
- Isla de una masa: `masa_subterranea.id_unidad_demanda → unidad_demanda.cod_provincia → provincia.nombre_provincia`.
- Cruces UD↔municipio y pozos↔municipio: `ST_Intersects`/`ST_Contains` (GIST indexado).
- `mapa/masas` y `mapa/unidades-demanda` incluyen `estado_cuantitativo`, `explotacion_porcentaje` y `disponibilidad_hm3` del último año (coloreado DMA en el mapa).

### Frontend — página `/dashboards`

- **Shell estilo datoasturias**: sidebar con **Visión general** + 2 grupos colapsables: **Recursos Hídricos** (Agua infiltrada, Balance hídrico, Abastecimiento) y **Turismo** (Presión humana, Ocupación turística). Acento de color por vista en el header.
- Selector global de isla (con scroll horizontal en móvil) + SearchSelect con buscador por municipio/masa/UD (opciones filtradas por isla).
- **Charts**: Recharts 3 — theming dark/light vía nanostores.
- **RangoTemporal** (presets Todo/Últimos 5/Últimos 10 + desde/hasta, client-side): en Infiltrada (el toggle AH anula el rango), Balance (solo sección evolución), Abastecimiento, Presión y Ocupación (con modo **comparativa interanual**).
- **DashboardBalance** en 2 secciones: "Situación actual" (último año disponible: disponibilidad con tooltip ℹ️ de la fórmula, explotación % coloreada DMA, diferencia vs RP, estado + **desglose entradas/salidas** con barras apiladas y tabla de componentes) y "Evolución temporal" (rango + charts con umbrales 0.8/1.0 + ranking del año `hasta`).
- **Contexto desde el mapa** ("Más detalle"): `/dashboards?vista=balance&nivel=masa&masa=X` (masa), `/dashboards?vista=abastecimiento&municipio=X` (municipio). Los presets se aplican **solo a la vista destino** y no persisten al navegar manualmente.
- Componentes: `web/src/components/dashboards/` (DashboardsShell, DashboardGeneral, DashboardInfiltrada, DashboardBalance, DashboardAbastecimiento, DashboardPresion, DashboardOcupacion, ui.tsx).
- Visión general: infiltración AH **total del ámbito** (suma), masas en déficit sin chip duplicado, ocupación Baleares = media de islas.

### Mapa — drawer con KPIs (clic → sidebar, sin popup)

- **Popup eliminado** — clic abre el Drawer con KPIs (`/analytics/entidad/{tipo}/{cod}`):
  - Masa: infiltración AH vs media (+% desviación), último mes, sparkline 24 meses + **bloque balance** (estado DMA, disponibilidad, explotación, extracción); municipios y demanda
  - Municipio: población + variación (chip gris), consumo, ocupación del mes consolidado, infiltración AH de sus masas, pozos; sparkline ocupación 12 meses
  - Pozo: ficha + "Ver masa"
  - U.D.: KPIs de sus masas + **bloque balance** (chips DMA) + listado de masas clicable
- CTA "Más detalle": masa → vista balance; municipio → vista abastecimiento.
- **Capas masas/UDs coloreadas siempre por estado DMA** (bueno verde, riesgo ámbar, malo rojo, sin dato neutro) + **leyenda** en el panel de capas.
- **Tooltips** con el nombre en hover; **clustering de pozos** (Leaflet.markercluster CDN, `disableClusteringAtZoom: 10`, spiderfy); zoom inicial 9.
- **Masas sin balance en gris (2026-09-04)**: `dmaStyleFor` devuelve gris `#71717a` cuando no hay `estado_cuantitativo` (masas) o `explotacion_porcentaje` (UDs) — antes caían al azul por defecto y contradecían la leyenda.
- `PUBLIC_PLADI_API_URL=/api/v1` en `web/.env.production` (Caddy proxys `/api/*` → FastAPI; dev usa `http://localhost:8000/api/v1`).

### Notas técnicas

- `web/src/lib/api.ts` — cliente analítico (`fetchResumen`, `fetchInfiltrada`, `fetchInfiltradaRanking`, `fetchBalance`, `fetchBalanceRanking`, `fetchUds`, `fetchMasas`, `fetchMunicipios`, `fetchAbastecimiento`, `fetchPresion`, `fetchOcupacion`, `fetchEntidad`).
- `web/src/lib/store.ts` — atoms `dashIsla`, `dashVista` y `entidad*` (drawer).
- Errores comunes SQL con asyncpg: `round(double, int)` no existe → `::numeric`; ids enteros (`id_unidad_demanda`) como int; decimal.Decimal → `float()` antes de dividir.

### Identidad y responsive (2026-08-15)

- **Logo**: icono de capas (bronze/silver/gold) en navbar + kit en `web/public/assets/` (**favicon.svg**, PNGs, OG) servido en `/assets/*`.
- **Responsive completa** (iPhone SE 320px → iPad): labels del navbar ocultas en móvil, footer con scroll horizontal, selector de islas con scroll, sidebar móvil con backdrop, panel de capas auto-colapsado <640px, KPI cards 1 col <360px, desglose sin % en xs, tooltips con soporte tap, `:focus-visible` global, leyendas de charts compactas en móvil.

### Auditoría responsive 2026-09-04 (verificación Playwright)

- **Verificación programática** (Playwright + Chromium, `/tmp/opencode/responsive/`): 3 páginas × 320/375/414/768/1024/1440 × light/dark + interacciones (6 vistas de dashboards, escenario de simulación, capas + drawer en inicio). Métrica: `docOverflow=false` y **0 elementos desbordados** en todas las combinaciones (los únicos "offenders" son falsos positivos: drawer cerrado off-canvas, sidebar móvil off-canvas y svg/tiles internos de Leaflet clipados).
- **Fixes aplicados**:
  - `h-screen`/`w-screen` → **`h-dvh`/`w-full`** en los 3 shells + sidebar y drawer con `calc(100dvh-44px-36px)` + `min-h-dvh` en body (en iOS/Android la barra del navegador no recorta el layout).
  - **Tablas de /simulacion** (municipios y masas con cambio): wrappers `overflow-auto` + columnas secundarias ocultas en xs (`base`/`explotación` <420px, `isla`/`extracción` <640px). Antes desbordaban ~70px su contenedor a 320px.
  - Balance: grid de KPIs `grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4` (consistente con el resto).
  - `KpiMap`: hint de clic `w-full sm:w-auto sm:ml-auto` en la leyenda.
  - `LayerPanel`: se recolapsa automáticamente al redimensionar a <640px (antes solo al montar).
- **Ojo builds locales**: `astro build` carga `.env.production` (`PUBLIC_PLADI_API_URL=/api/v1`, pensado para Caddy). Para probar el build contra la API local: `PUBLIC_PLADI_API_URL=http://localhost:8000/api/v1 npm run build`.
- ⚠️ **Caddy sirve `web/dist` en vivo** (bind mount ro) — un build de verificación con URL local deja la web pública sin datos (el navegador llama a `localhost:8000` del cliente). Regla: terminar siempre con `npm run build:prod` (script que fuerza `/api/v1`) y verificar `grep -r "localhost:8000" dist/` vacío. Para desarrollo usar `npm run dev` (no toca `dist`). Incidente ocurrido el 2026-09-04 y resuelto con rebuild de producción.
- Capturas de la verificación en `/tmp/opencode/responsive/shots/` (44 PNG, no commiteadas).

### Turismo — IPH vs población y ranking de ocupación (2026-08-15)

- **DashboardPresion**: KPI "IPH pico vs población" (ratio `×2,1` + desglose IPH/población) y líneas discontinuas de **población censal anual** bajo el IPH (modo isla y Baleares). El IPH es a nivel NUTS: **Eivissa i Formentera van juntas** (sin estimaciones).
- **DashboardOcupacion**: ranking top 5 / bottom 5 de municipios (media anual del año `hasta` del rango, respeta el toggle de tipo, nota "solo municipios con datos" — 26 de 67 tienen turismo).
- **Drawer municipio**: sin card de infiltración; ocupación = media 12 meses + pico mensual + sparkline con **ventana propia del municipio** (fix: Alaior acaba en 2025-09 y Sant Joan de Labritja en 2024-10, el corte global los dejaba vacíos).
- **EmptyState** (borde discontinuo + icono + texto contextual) para entidades sin datos: municipios sin turismo, masas/UDs sin balance, vista Ocupación sin datos; leyenda del mapa con "Sin dato" (gris); KpiBlocks con sub explicativo en vez de `—`.

### Mejoras UX (2026-09-04)

- **Visión general rediseñada**: los 2 charts (agua infiltrada 24m + consumo por origen) se sustituyen por un **mapa de KPIs** (`web/src/components/dashboards/KpiMap.tsx`, Leaflet propio): choropleth de municipios con selector de KPI (consumo urbano 2024, ocupación media 12m, población padrón) + modo "Masas (DMA)" (estado coloreado). Hace `fitBounds` a la isla del filtro de arriba; tooltip con nombre; clic → `vista=abastecimiento&municipio=X` (o `vista=balance&nivel=masa&masa=X`); leyenda con rampa min/máx + "Sin dato". Las 6 KPI cards van en **una sola fila horizontal** (grid hasta 6 columnas) con la temática marcada por el **borde superior de color** de cada tarjeta (`accent` en `KpiCard`): azul Recursos hídricos, ámbar Turismo, violeta Población.
  - **Endpoint nuevo**: `GET /api/v1/analytics/mapa/kpis?isla=` → por municipio `consumo_hm3` (último año), `ocupacion_media_pct` (12 meses), `poblacion` (último padrón) + `anio_consumo`/`anio_poblacion`. Geometrías reutilizan `/mapa/municipios` y `/mapa/masas`.
- **Rango por defecto 5 años**: Abastecimiento e Infiltrada arrancan con "Últimos 5" (antes 10).
- **IPH comparativa interanual**: toggle en Presión (patrón de Ocupación): eje X = mes, una línea por año (máx 5 del rango); en Baleares la línea es la suma mensual de las 3 series NUTS.
- **Leyendas de charts**: componente `ChartLegend` (`ui.tsx`, pills con punto de color/línea/discontinua + nombre) sustituye al `<Legend>` de Recharts en Infiltrada, Abastecimiento, Presión (agrupando IPH sólido + población discontinua por isla), Ocupación, Balance (con umbrales 0.8/1.0) y ResultadosSimulacion (histórico + escenarios; barras de estado).
- **Fix filtros cruzados**: al cambiar de isla se resetea el filtro de municipio/masa/UD en los 5 dashboards (patrón `useRef` de isla previa, sin pisar los presets del "Más detalle").
- **Navbar**: el estado activo se pinta en el SSR con `path={Astro.url.pathname}` desde cada página (antes el HTML inicial marcaba siempre "Inici" hasta hidratar React). Normalización de `/index.html` y barra final en `Navbar.tsx`. Estilo activo azul más marcado.

---

## Balance hídrico simplificado (DMA) — ✅ 2026-08-15

Cadena de oro: `gold.lluvia_masa_subterranea` → `gold.agua_infiltrada_masa_subterranea` → `gold.balance_hidrico_baleares`.

- **`recurso_potencial_hm3`** añadido a `balance_masas_subterraneas_porcentajes` (82 masas, CHECK >= 0). CSV fuente: `data/postgis_dgrh/recurso_potencial.csv` (cargado también en `load_data.sql`).
- **DAG `agua_infiltrada_masa_subterranea`** (gold): `agua_infiltrada_m3 = lluvia_mm × Σ(area_km2 × coef) × 1000`, con coeficientes en **tanto por uno** de `infiltracion_epoca_material` (rango 0-0.4). 84 masas; las 3 sin coeficientes (`1902M1`, `1903M1`, `1903M2`) quedan fuera. ~11.4k filas mensuales.
- **DAG `balance_hidrico_baleares`** (gold, anual 2015-2024, rango dinámico): modelo DMA fiel al prompt simplificado:
  - Entradas: infiltración lluvia real + climáticas (`× pct_x/pct_lluvia`) + fijas (`RP × pct/100`); intrusión salina en suma_entradas pero NO en disponibilidad
  - Salidas: abastecimiento urbano (consumo municipal distribuido con pesos normalizados de `municipio_masa_subterranea`; **Formentera excluida** por no tener mapping) + torrentes/manantiales climáticas + humedales/salida_mar/zzhh fijas
  - `disponibilidad = (suma_entradas − intrusión) − (salida_mar + salida_zzhh)`, cap 0, NULL si fuente NULL; `explotacion = extraccion/disponibilidad`; estados DMA: <0.8 bueno, 0.8-1 riesgo, >1 o disp=0 malo
  - 82 masas con RP; 5 sin RP (`1803M3`, `1902M1`, `1903M1`, `1903M2`, `2101M4`) sin balance
- **Encadenamiento por Assets (Airflow 3.3)**: los outlets se declaran **devolviendo `Asset(uri)` desde el task** (el kwarg `outlets` del DAG ya no existe). `agua_infiltrada` se dispara con `schedule=[Asset("pladi://gold/lluvia_masa_subterranea")]` y el balance con `schedule=[Asset("pladi://gold/agua_infiltrada_masa_subterranea")]`. `lluvia_masa_subterranea` produce su Asset.
- DDL en `sql/gold_balance.sql`; documentado en `docs/schema.dbml`.

## Simulación (FASE VII — ✅ completada — notebooks creados 2026-08-30)

**Decisión (2026-08)**: antes de implementar nada en la UI, el equipo valida con notebooks de experimentos si un modelo propio mejora los baselines usando las tablas gold. La UI de `/simulacion` queda pendiente de esta validación.

### Estructura `notebooks/`

```
notebooks/
├── 00_export_datasets.py       # exporta gold.* + dimensiones de PostGIS → data/*.csv (host: python3 notebooks/00_export_datasets.py)
├── data/                       # CSVs + panel.parquet + panel_train/test.parquet + panel_metadata.json (gitignored)
├── results/                    # métricas por modelo (modelo, cod_municipio, mae, mape, rmse, r2) + elasticidades.csv
├── 01_abastecimiento.ipynb     # EDA target (consumo_hm3, municipio x año 2000-2024, 67 series completas)
├── 02_presion_humana.ipynb     # EDA IPH (3 series NUTS; Eivissa+Formentera juntas)
├── 03_ocupacion_turistica.ipynb# EDA ocupación (26/67 municipios; imputar 0 + flag al resto)
├── 04_lluvia_masa_subterranea.ipynb  # EDA lluvia (feature: lluvia anual media de las masas del municipio)
├── 05_agua_infiltrada.ipynb    # EDA recarga (colineal con lluvia → no entra en v1)
├── 06_balance_hidrico.ipynb    # EDA balance DMA (contexto: masas en déficit)
├── 07_censo.ipynb              # EDA población (padrón 1998-2025): NO es feature; denominador del target per cápita (2026-09-12)
├── 08_panel_features.ipynb     # TABLÓN ANALÍTICO: panel único + outliers (MAD) + correlaciones + preprocessing documentado
├── 10_baseline.ipynb           # 6 baselines TS: naive, media, ETS/Holt, GB temporal, auto-ARIMA, regla_negocio DGRH
├── 11_modelo_municipio.ipynb   # GB por municipio (67 modelos) → serializa models/municipio/*.joblib + metadata.json
├── 12_modelo_panel_gbm.ipynb   # GB global con one-hot de municipio
├── 13_modelo_panel_regularizado.ipynb  # Ridge/Lasso panel (alpha por CV)
├── 14_interpretabilidad.ipynb  # SHAP global+por municipio + elasticidades reales → results/elasticidades.csv + models/elasticidades.json
├── 20_comparativa.ipynb        # une results/*.csv + walk-forward de estabilidad
├── 21_ablacion_features.ipynb  # ablación IPH/`iph_max`/ocupación + elasticidad censo (decisión de features 2026-09-12)
└── 22_target_per_capita.ipynb  # población como feature vs target per cápita (decisión de target 2026-09-12)
```

### Tablón analítico (`08_panel_features`) — patrón "feature store" del protocolo

- **Punto único** de construcción del panel municipio x año (2015+); 11/12/13/20 lo **leen** de `data/panel_features.parquet` + `panel_metadata.json` (features finales, decisiones documentadas).
- **Outliers**: detección por MAD (>3) — se mantienen (eventos reales: sequías, restricciones).
- **Correlaciones**: `iph_max` eliminada (|r| > 0.85 con `iph_media`). Features finales: `anio, iph_media, ocupacion_media, lluvia_anual_mm, lag1` (lag1 = consumo del año anterior, serie completa 2000-2024).
- Diccionario de features y "recommended preprocessing" documentados en el propio notebook.

### Entorno Jupyter (Docker)

- Servicio `jupyter` en `docker/jupyter/` (base `jupyter/base-notebook` + polars, sklearn, statsmodels, pmdarima, seaborn, shap, joblib). Puerto `127.0.0.1:8888`, volúmenes `../../notebooks:/home/jovyan/work` y `../../models:/home/jovyan/models`, `restart: unless-stopped`.
- **Acceso** (mismo patrón que Airflow/MinIO): `http://localhost:8888?token=<JUPYTER_TOKEN de docker/.env>` (en remoto, redirige el puerto con tu túnel SSH habitual).
- `notebooks/data/`, `.venv` y `models/` gitignored; `results/` se commitea (métricas pequeñas).

### Modelos serializados (`models/` en raíz, gitignored)

- `models/municipio/{cod_municipio}.joblib` — 67 GB (notebook 11) + `models/metadata.json` (features, params, base_anio 2024, MAPE por municipio) + `models/elasticidades.json`.
- **Produccion**: el notebook 11 reentrena con datos 2016-2024 antes de serializar (los arboles no extrapolan `anio` mas alla del rango); las metricas de evaluacion siguen siendo las del holdout 2022-2024.
- Patrón de despliegue: `models/` montado en jupyter (rw) y en fastapi (rw desde 2026-09) — **los notebooks 11/14 quedan como experimentación**; la producción es el DAG `modelo_consumo_urbano` → MinIO → registry `ml.model_versions` → FastAPI (ver "Productivización del modelo").

### Diseño del experimento (actualizado 2026-08-30 v2)

- **Objetivo**: predecir el consumo urbano **anual** por municipio (hm³). Target: `gold.abastecimiento_urbano_baleares` (2000-2024, 67 series completas).
- **Features (v2)**: `anio`, `iph_media`, `ocupacion_media`, `lluvia_anual_mm`, `lag1`. ~~Temperatura media anual (AEMET)~~ → **fuera**: el gold solo tiene precipitación. `iph_max` fuera por correlación.
- **Ventana**: 2015-2024 para modelos con features (limitada por lluvia); baselines usan historia completa. Split temporal: train < 2022, test 2022-2024 (predicción recursiva, lag actualizado con la predicción).
- **Resultados (MAPE medio test 2022-2024)**:
  - `gb_municipio` **8,7%** (ganador) > `regla_negocio` 10,2% > naive 11,6% ≈ ets 11,7% ≈ gb_temporal 11,7% > arima 12,2% > ridge 13,5% > media 17,8% > gb_panel 25,9% > lasso 29,8% — superado el 2026-09-12 por el target per cápita: **7,95%** (ver «Target per cápita y población»).
  - **Regla de negocio** (heurística DGRH: Δconsumo = 0,3 × ΔIPH isla) queda **segunda** — muy cerca del modelo; justifica el ML solo con el delta de 1,5 pp + interpretabilidad.
  - **Walk-forward** (1 año, ventanas 2021-2024): gb_municipio estable (MAPE 6,2-7,5%) pero naive gana 2 de 4 ventanas — la ventaja del modelo es modesta y honesta.
  - **Elasticidades reales** (14_interpretabilidad, perturbación ±10%): IPH **0,093**, ocupación **≈0**, lluvia **−0,017** — el consumo es muy inercial (lag1 domina el SHAP). Estas cifras estaban cableadas al mock de /simulacion (sustituidas el 2026-09-12, ver «Revisión del simulador urbano»).
  - **Ablación de configuración (2026-08-30)** — por qué el modelo usa `iph_max` y train desde 2016:
    | Config | MAPE |
    |---|---|
    | **v1 (con `iph_max`, train 2016+)** | **8,7%** |
    | con `iph_max`, train 2015+ | 9,1% |
    | sin `iph_max`, train 2016+ | 8,9% |
    | sin `iph_max`, train 2015+ (v2) | 9,3% |
    → `iph_max` se conserva pese a |r|>0,85 con `iph_media` (la regla de correlación del protocolo es estética; aporta +0,2 pp) y 2015 se excluye del train (aporta ruido: +0,4 pp). Documentado también en `08_panel_features`.
    ⚠️ **Superado el 2026-09-12** (notebook 21): con el protocolo del DAG, quitar `iph_max` cuesta +0,18 pp (dentro del umbral de 0,3 pp) y el IPH se fusiona en un único factor (`iph_media`); quitar ambos IPH cuesta +1,82 pp. Decisión vigente en «Revisión del simulador urbano».
- **Interpretabilidad**: SHAP global + por municipio representativo (Palma 07040, Calvià 07011, Sineu 07060) en 14_interpretabilidad.

### UI `/simulacion` (rediseñada 2026-08-31 — escenarios libres)

- **Layout 2 paneles**: izquierda "PanelEscenarios" (340px), derecha resultados. Header con punto violeta (`#a855f7`) y pills de isla (patrón dashboards). Responsive: panel encima en móvil.
- **Persistencia y nombres (2026-09-04)**: los escenarios viven en **`sessionStorage`** (antes `localStorage`): sobreviven a recargas y navegación dentro de la web, se resetean al cerrar la pestaña/navegador. Se persiste solo el **número** del escenario (`n`); el nombre se genera al render con `t('simul.escenario_n', {n})` → siempre en el idioma activo (las respuestas de la API se re-etiquetan por id sin refetch). **Selector de horizonte**: el `<select>` nativo se sustituye por `DropdownSelect` (`ui.tsx`, dropdown custom estilo SearchSelect).
- **Escenarios libres (rediseño 2026-08-31; palancas actualizadas 2026-09-12)**: la página arranca **sin escenarios**. Un escenario = combinación de variaciones de población (padrón) / IPH / lluvia; el usuario añade hasta **5** (`MAX_ESCENARIOS`, límite del backend) con «+ Añadir escenario» y los compara en el gráfico. Nombres **auto-generados** (`Escenario 1, 2…`, contador sin reutilizar números) y no editables. Cada tarjeta: punto de color, nombre, ojo (ocultar del gráfico), ✕ borrar (se puede borrar todo) y sliders % (−30..+30) con presets de lluvia (Año seco −30 / Normal / Año húmedo +30). Sin escenarios → no se llama a la API y los resultados muestran un EmptyState. `escenarioActivo` vive en el shell (al añadir se selecciona el nuevo; al borrar el activo pasa al primero restante).
- Los sliders muestran el efecto medido (población +8,1 % · IPH +2,7 % · lluvia ≈−0,3 % por +10 %) — por eso la lluvia apenas mueve el consumo urbano (su dominio es el balance hídrico). Chip ámbar si |Δ| > 25 (fuera del rango de entrenamiento). Tooltips: población (padrón municipal; OLS 2024/2025), IPH NUTS (Eivissa+Formentera juntas). **El slider de ocupación se eliminó (2026-09-12)**: efecto causal anual no identificado.
- **Ámbito**: isla (incluida **Baleares** = las 4 islas, soportado por la API 2026-08-31) + SearchSelect de municipio (con Baleares lista los 67) + horizonte (2026-2035).
- **Resultados** (`ResultadosSimulacion.tsx`): pills «Escenario para los indicadores» sobre 4 KpiCards (consumo proyectado + Δ% vs base, consumo base, variación media anual, sensibilidad población), ComposedChart Recharts (histórico sólido + proyecciones dashed por escenario + tooltip con banda lo/hi deduplicado — Area y Line comparten dataKey), tabla municipal completa con pills de escenario y columna Isla cuando el ámbito es Baleares. ~~Ranking top/bottom 5~~ eliminado (2026-09, redundante): la tabla de detalle es **ordenable por columnas** (click en header, ▲/▼, default Δ% desc).
- **Mock**: `PUBLIC_SIMULACION_MOCK=true` → `web/src/lib/simulacionMock.ts` (opt-in para desarrollo sin API; el historico es real vía `fetchAbastecimiento`; soporta Baleares). Elasticidades reales cableadas. `ESCENARIO_COLORS` 5 colores (igual que el backend).
- **API real (implementada 2026-08-30, Baleares 2026-08-31)**: `GET /api/v1/simulacion/consumo?isla=&municipio=&hasta=&escenarios=<json>` en `api/routers/simulacion.py` + `api/simulacion_service.py`. `isla=Baleares` = 67 municipios y serie suma anual. Colores por índice (5).
  - Carga en startup (lifespan, `asyncio.to_thread`) los 67 modelos joblib de `models/municipio/` + `metadata.json` + `elasticidades.json` (volumen `../../models:/opt/models:ro` en fastapi). Sin modelos → 503 claro.
  - **Metodo hibrido**: (1) baseline = nivel congelado: features fijas en el ultimo ano observado y `anio` limitado al ultimo ano de entrenamiento (los arboles GB no extrapolan: se congelan en la hoja limite); (2) escenario = `nivel × (1+δ)` con `delta = e_censo·Δpoblación + e_iph·ΔIPH + e_lluvia·Δlluvia`, elasticidades medidas en la fila base (punto de aplicacion del escenario). No hay recursión efectiva: los arboles son piecewise-constant y no propagan variaciones pequenas de `lag1` → la proyección es un **shift estático** (ver «Revisión del simulador urbano»).
  - Banda lo/hi = ±MAPE por municipio, ensanchada con el horizonte. Respuesta = contrato `SimulacionResp`. Verificado: la prediccion del endpoint coincide exactamente con el protocolo del DAG (`include/ml/entrenar.py`).
  - **Modelos de produccion**: reentrenados con datos 2016-2024 por el DAG `modelo_consumo_urbano`; el MAPE documentado 7,95% (target per cápita) proviene del holdout 2022-2024.
- **Pendientes v2**: bandas de incertidumbre reales del modelo (no ±MAPE fijo); escenarios de reasignación de origen del agua (hoy los pesos municipio→masa son estáticos).

### Cruce con el balance hídrico (2026-08-31)

- **Endpoint** `GET /api/v1/simulacion/balance?isla=&municipio=&hasta=&escenarios=` (mismas validaciones/colores que `/consumo`). Reutiliza el pipeline compartido de `/consumo` (`_resolver_ambito`, `_serie_historica`, `_features_base`, `_proyectar` en `api/routers/simulacion.py`) + `api/balance_service.py` con la matemática.
- **Fórmula** (fiel al DAG `balance_hidrico_baleares`): `extracción(t) = extracción_base + Σ_mun (consumo_proy − consumo_base) × peso`, con los **pesos normalizados** de `municipio_masa_subterranea` (> 0, misma normalización que el DAG). El **slider de lluvia escala la infiltración** y las salidas climáticas (torrentes/manantiales × 1+lluvia_pct); el resto de componentes se mantienen en el valor de la última fila del balance ≤ base_anio. `disponibilidad = max((suma_entradas − intrusión) − (salida_mar + salida_zzhh), 0)`; explotación y estado DMA con los mismos umbrales (0.8/1.0). Año base = observado sin escalar.
- **Respuesta**: por escenario, serie anual de conteos DMA + extracción/disponibilidad totales (con el año base como referencia) y `masas_cambio` (solo las que cambian de estado en `hasta`, empeoran primero). `n_masas` del ámbito (74 con balance, última fila ≤ base) + `nota` (Formentera sin mapping municipio→masa; municipio sin masas).
- **UI** (`ResultadosSimulacion.tsx`, sección "Impacto en el balance hídrico" **antes de "Detalle por municipio"** (2026-09), escenario activo): 4 KPIs (masas en mal estado Δ vs base, masas con cambio de estado, extracción total Δ%, disponibilidad total Δ%), BarChart apilado bueno/riesgo/malo por año, tabla de masas con cambio (chips DMA + explotación/extracción base→proy). EmptyState si el ámbito no tiene masas con balance. El shell pide `/consumo` y `/balance` en `Promise.all` con el mismo debounce (un solo loading). Mock con bloque balance sintético.

### Revisión del simulador urbano (2026-09-12)

**Hallazgos experimentales** (contra la API de producción + análisis reproducidos en `notebooks/21_ablacion_features.ipynb`):

1. **Los sliders apenas movían**: ocupación +50 % → +0,40 % del consumo final; IPH +50 % → +4,59 %; lluvia +50 % → −0,84 % (elasticidades antiguas 0,093 / 0,008 / −0,017, medidas con los modelos de evaluación y perturbación a una cola).
2. **La proyección es una línea plana**: la recursión no propaga nada (ratio escenario/tendencial constante ≈ 1,0183 todos los años). Los GB son piecewise-constant y con 6 filas de train por municipio no aportan dinámica: el "método híbrido" equivale a **nivel congelado × (1+δ)**.
3. **Censo (palanca nueva)**: OLS en niveles `consumo_hm3 ~ población` (67 municipios, censo 2024/2025, 134 obs) → pendiente 0,0710 hm³/1000 hab, R² = 0,93, per cápita mediana ≈ 177 L/hab/día, elasticidad en la media `b·x̄/ȳ` = 0,79 (0,81 en el análisis original). El slider de censo queda respaldado con datos reales; alternativa de planificación ~1,0 documentada en `censo_origen`.
4. **Ocupación**: regresión pooled con efectos fijos municipio+año (26 municipios, 2008-2024, 442 obs) → β = −0,005 ± 0,005 hm³/punto (**NO significativo**). La correlación temporal intra-municipio (+0,57) era tendencia común, no efecto causal: la ocupación hotelera anual no mueve el consumo anual de forma identificable.

**Ablación de features** (notebook 21, protocolo exacto de `include/ml/entrenar.py`; la réplica del panel reproduce el MAPE de producción 8,685 %):

| Config | MAPE | Δ vs prod | Decisión |
|---|---|---|---|
| full (prod, `iph_media`+`iph_max`) | 8,685 | — | — |
| sin `iph_max` | 8,863 | +0,18 pp | ✅ se elimina (redundante, \|r\|>0,85) |
| sin IPH (ambos) | 10,503 | +1,82 pp | ❌ el IPH se conserva |
| sin IPH y sin ocupación | 12,255 | +3,57 pp | ❌ la ocupación se conserva como feature |

**Features finales**: `anio, iph_media, ocupacion_media, lluvia_anual_mm, lag1` (IPH fusionado en un único factor).

**Diseño final del simulador**:
- **Palancas**: **población (padrón, e = 0,81)**, IPH (e = 0,275) y lluvia (e = −0,026; su efecto real es el balance hídrico). **Ocupación fuera de la UI y del delta** (no se inventa sensibilidad); la feature se conserva porque el modelo la usa para predecir (quitarla cuesta +3,57 pp).
- **Elasticidades con higiene**: perturbación **simétrica ±10 %** (diferencia central), medidas con los **modelos de producción** (los que se sirven) en la **fila base**, punto de aplicación del escenario, y con flag de turismo real. Se calculan en el DAG (`include/ml/entrenar.py`) y viajan en el bundle (`elasticidades.json` con `nota` + `censo_origen`).
- **Método híbrido saneado**: la proyección central es un **shift estático** sobre el nivel congelado; la **banda lo/hi** (±MAPE por municipio, +3 pp/año de horizonte) es el único elemento dinámico. Docstrings y textos de UI alineados con esto.
- **API**: `escenarios` acepta `iph_pct`, `censo_pct` y `lluvia_pct`; `ocupacion_pct` se tolera por compatibilidad pero se ignora. KPI de sensibilidad del frontend pasa a población.
- **Producción**: versión **`20260912T201830Z`** (MAPE 8,863; 5 features; e_iph 0,427; e_censo 0,81) publicada por el DAG `modelo_consumo_urbano` (guardrail MAPE OK). Rollback = reactivar la versión anterior en `ml.model_versions` + reiniciar FastAPI.
- ⚠️ Ese mismo día se adoptó el **target per cápita** (siguiente apartado): la versión vigente es `20260912T210828Z` (MAPE 7,95; e_iph 0,275).

### Target per cápita y población (2026-09-12, tarde)

**Hipótesis**: añadir la población municipal como feature mejora el modelo. **Resultado** (notebook 22,
protocolo exacto de `entrenar.py`): como **feature de entrada empeora** (8,863 → 9,865; +1,00 pp:
colisiona con `anio`/`lag1` en un modelo de 6 filas por municipio). Como **target per cápita**
(predecir `consumo/población` y reconstruir × población) **mejora de forma significativa**.

| Variante (holdout recursivo 2022-2024) | MAPE | Δ |
|---|---|---|
| base (target hm³) | 8,863 | — |
| **per cápita, población congelada en año base** (réplica de producción) | **7,948** | **−0,92 pp** |
| per cápita con población real de test (cota optimista) | 7,587 | −1,28 pp |

- Mejora en **43/67 municipios**; mediana −0,84 pp; **Wilcoxon p = 0,002**. Walk-forward 2021-24:
  −0,21 / −1,06 / −0,24 / **+0,16** (gana 3 de 4 años). El backtest de producción reproduce exactamente
  esas ventanas (6,1 / 5,4 / 6,1 / 6,4) sin degradación.
- Empeora en municipios pequeños/turísticos (Formentera +5,2, Banyalbufar +4,5, Valldemossa +3,8,
  Deià +3,7) y mejora en los grandes (>3000 hab: −1,01 pp de media). Desglose completo en el notebook 22.
- Bajo per cápita se mantienen las features (IPH +2,4 pp si se quita; ocupación +1,6 pp; `anio` aporta poco).
  Elasticidades vigentes (prod, fila base, simétrico ±10 %): **iph 0,275**, ocupación 0,060 (solo
  municipios con turismo; informativa, sin palanca en la UI), lluvia −0,026.

**Datos**: el censo continuo solo cubría 2021-2025 (insuficiente para el train 2016+), así que se
**repuntó la ingesta existente** al **padrón municipal IBESTAT** (`000001A_000001`, 1998-2025, 67
municipios) manteniendo tabla, DAG y upsert (`gold.censo_municipal_baleares` conserva el nombre).
Padrón vs censo difieren ~0,65 % de mediana (máx 3,2 %); los endpoints de analytics siguen OK.

**Cambios de producción**:
- `include/ml/panel.py`: `poblacion` (padrón) como columna **no-feature**; `FEATURES` intacto.
- `include/ml/entrenar.py`: target `consumo/población`; lag `lag1_pc`; evaluación recursiva con población
  congelada; metadata `target_transform: per_capita` + `features_modelo` + `poblacion_base` por municipio;
  elasticidades sobre el modelo per cápita. `backtest.py` con el mismo protocolo.
- `api/simulacion_service.py`: ramifica por `target_transform` (compatible con bundles antiguos: sin el
  campo se mantiene el camino hm³); normaliza el lag por población base y reescala la predicción.
  `/version` expone `target_transform`.
- **La palanca de censo no cambia**: sigue siendo el coeficiente externo **0,81** (OLS), no el escalado
  estructural; el target per cápita mejora el baseline, no la semántica del slider.
- DAG `modelo_consumo_urbano`: +Asset `pladi://gold/censo_municipal_baleares` en el `AssetAny`; el DAG del
  censo ya devuelve Asset. **Versión vigente `20260912T210828Z`** (MAPE 7,95). Frontend: hint IPH a +2,7 %.

---

## Productivización del modelo (✅ 2026-09-02)

**Decisión**: el serving ya existía (FastAPI + joblib en volumen), pero el ciclo de vida era manual (retrain desde notebook 11, sobreescritura in-place, sin versionado ni monitoreo). Se productiviza con **MinIO + registry PostGIS** (no MLflow: 1 familia de modelos, 1 pipeline controlado; MLflow añadiría infraestructura sin retorno). El patrón queda: **notebook = experimentación, DAG = producción**.

### Registry y artefactos (`sql/ml_registry.sql`, `docs/schema.dbml`)

| Tabla | Contenido |
|---|---|
| `ml.model_versions` | Una fila por versión publicada: `id`, `artifact_uri` (`s3://pladi/ml/simulacion/v{id}/`), `estado` (`active`/`shadow`/`archived`, **solo una active** — índice parcial único), `mape_holdout_medio`, `mape_por_municipio`, `features`, `params`, `elasticidades`, `base_anio`, `checksum_sha256`, `nota`, `creado_en`/`activado_en` |
| `ml.backtests` | Resultados de los backtests walk-forward (drift): `ventana`, `mape_medio`, `umbral_mape` (= MAPE holdout × 1,5), `degradado`, `detalle` jsonb |

- **Bundle en MinIO** (`pladi/ml/simulacion/v{id}/`): `municipio/*.joblib` + `metadata.json` + `elasticidades.json` + `manifest.json` con sha256 por archivo. Inmutable: cada versión su propio prefijo.

### FastAPI — carga atómica (`api/model_store.py`)

- Al arrancar, `simulacion_service.load()`: (1) si `MODEL_VERSION` (env) → esa versión exacta del registry; si no → la `active`; (2) sin registry → **modo local** (`/opt/models` raíz, desarrollo). Descarga del bundle a `models/versions/v{id}/`, verifica sha256 del manifest, carga; **solo tras cargar OK** escribe el puntero `current.json`; si falla, vuelve a la versión anterior del puntero.
- `GET /api/v1/simulacion/version` → versión servida, n_modelos, MAPE medio, features, params, base_anio, elasticidades. `/health` lo refleja en `simulacion`.
- `docker/fastapi/requirements.txt`: + `minio`; volumen `models` ahora **rw** (el API descarga bundles).
- **Rollback** = `UPDATE ml.model_versions SET estado='archived' WHERE estado='active'` + activar la versión previa (o pin `MODEL_VERSION` en el compose). Reiniciar FastAPI.

### Retrain en producción (Airflow)

- `docker/airflow/requirements.txt`: + `scikit-learn`, `joblib` (rebuild de la imagen `pladi-airflow`).
- **`include/ml/`**: `panel.py` (tablón desde golds, réplica exacta del notebook 08, con `poblacion` como columna no-feature), `entrenar.py` (67 GBM con **target per cápita** + holdout 2022+ + reentrenado producción + elasticidades simétricas ±10% medidas con los modelos de producción en la fila base — revisiones 2026-09-12), `publicar.py` (bundle + manifest + registry), `backtest.py` (walk-forward del notebook 20, mismo protocolo per cápita), `registry.py` (DDL idempotente).
- **DAG `modelo_consumo_urbano`**: `schedule=AssetAny(abastecimiento_urbano_baleares, presion_humana, ocupacion_turistica, lluvia_masa_subterranea, censo_municipal_baleares)` + trigger manual. **Guardrail**: no publica si `mape_holdout > mape_activa + 2pp` (aborta antes de subir nada; el fallo del DAG es la alerta). Para esto, los golds DGRH/IPH/ocupación/población ahora **devuelven `Asset`** desde su último task (patrón de `lluvia_masa_subterranea`; URIs `pladi://gold/...`).
- **DAG `modelo_seed`** (`@once`): sube los `models/` actuales como **versión 0** a MinIO + fila active (bootstrap único; modelos montados ro en los 4 servicios de airflow).
- **DAG `modelo_backtest`** (mismo `AssetAny`): walk-forward anual (ventanas 2021+) → `ml.backtests`; **falla si alguna ventana degrada** (MAPE > holdout × 1,5) → DAG rojo = alerta.

### Despliegue de esta fase

1. Rebuild de imágenes: `docker compose build fastapi` y `airflow-init` (o `--build` en el compose raíz).
2. Trigger manual de `modelo_seed` (crea schema `ml` + versión 0).
3. Reiniciar FastAPI → `/api/v1/simulacion/version` debe mostrar la versión 0.
4. (PostGIS nuevo desde cero: `sql/ml_registry.sql` corre en el init; con volumen existente lo crea el seed.)

---

## Internacionalización ca/es (✅ 2026-09-03)

**Decisión**: ofrecer toda la web en **catalán (principal) y español** con enfoque **custom nanostore** (sin librerías i18n): coherente con el patrón del theme, switch instantáneo sin recarga y 0 dependencias. Se descartaron Paraglide (tooling nuevo) y el routing i18n de Astro (la recarga por URL pierde el estado de la UI; las páginas son shells de islas y el SEO no es prioritario).

### Mecánica

- **`web/src/lib/i18n.ts`**: atom `locale` (default **ca**), `t(clave, params)` con interpolación `{x}`, `useT()`/`useLocale()` (nanostores → re-render de todas las islas), `meses()`, `estadoLabel()`, `islaLabel()` (label localizado, valor fijo para la API — `Baleares`→«Illes Balears»), `plural()` (es/ca: singular solo n=1), `collator()` (localeCompare ca/es), `setLocale()` (persistencia + `<html lang>` + `document.title`).
- **Diccionarios** `web/src/lib/i18n/{es.ts,ca.ts}` (~290 claves, `ca` tipado contra las claves de `es` → paridad forzada por TS). Namespaces: nav, footer, page, common, mapa, dma, islas, ui, drawer, dash.*, simul.*.
- **Persistencia**: `localStorage['pladi-locale']`; script `is:inline` en `MainLayout.astro` aplica `lang`/`__pladiLocale` antes del primer paint (patrón theme).
- **Switch**: `LocaleSwitcher.tsx` (pills CA|ES) en el navbar. **Navbar y Footer son ahora islands React** (`Navbar.tsx`, `Footer.tsx`, `client:load`) para retraducirse al instante; títulos de página estáticos en ca (default) y `document.title` se actualiza al cambiar.
- **Números**: `Intl.NumberFormat('es-ES')` se mantiene tal cual — **es-ES y ca-ES formatean idéntico** (1.234,56); si algún día se añade un locale con otro formato habrá que hacerlo reactivo.
- **Nombres de escenario**: se generan al render desde el número persistido (`t('simul.escenario_n')`) → siempre en el idioma activo (2026-09-04).

### Fuera de alcance (backend)

- Strings del backend mostradas tal cual: `nota`, `ambito` (excepto `Baleares`, localizado vía `islaLabel`), `uso_principal`, nombres de masas/municipios/pozos/UDs (datos), errores de red en inglés de `fetch` («Failed to fetch…»). Si se quisiera traducirlas: la API debería devolver claves i18n en vez de texto.
- Marcas (DGRH, AEMET, IDEIB, IBESTAT, Open-Meteo) sin traducir.

---

## Convenciones del proyecto

### Entornos y despliegue

- **Dominio**: `pladi.dadesbalears.es`.
- **Hosting**: Ubuntu 24.04 (x86_64) — Docker + Docker Compose.
- **Reverse proxy**: Caddy con SSL automático (Let's Encrypt). Único servicio expuesto (80/443); el resto de servicios bind a `127.0.0.1`.
- **Acceso admin** (Airflow/MinIO): los puertos bind a `127.0.0.1`; en remoto redirigirlos con el túnel SSH habitual (8080 y 9001).
- **Carga de datos PostGIS**: `postgis/docker-compose.yml` monta `data/postgis_dgrh → /tmp/pladi_data` para que `load_data.sql` cargue los CSVs automáticamente en el primer init.
- **Credenciales**: `docker/.env` (gitignored) con contraseñas aleatorias por entorno.
- **Frontend en producción**: build con `npm run build` → `web/dist/` servido por Caddy.

### Ingestas (FASE III)

- Cada ingesta es un DAG que cubre bronze → silver → gold (extract + clean + load).
- **Decisión (2026-08)**: las masas de agua SUPERFICIAL DGRH (río/costa/transición/lago, CSVs con geometría EWKB en `data/postgis_dgrh/`) se descartan temporalmente por decisión de proyecto — no se cargan en PostGIS. Los CSVs se conservan por si se retoman.
- **Todos los DAGs llevan `max_active_runs=1`** — prohibida la ejecución concurrente de un mismo DAG (los triggers extra quedan en cola). Es convención obligatoria del proyecto.
- Módulos de lógica pura en `docker/airflow/include/` separados por capa (bronze/, silver/, gold/) + `parsers/`.
- Formato: bronze = raw (archivo original), silver = Delta Lake (Polars), gold = PostGIS (`gold.*`).
- Bronze IBESTAT: `boto3` directo, timeout `(15, 300)` + retry HTTP.
- Silver comparte helpers en `include/silver/ibestat.py` (parse_time_period, filter_municipal, enrich_geo, DELTA_STORAGE_OPTIONS).
- **Llamadas AEMET**: helper `include/bronze/aemet.py` → `aemet_request()` con espera fija ~61s en 429 (cruza la ventana de rate limit por minuto) + backoff corto en 5xx. El rate limit de AEMET también llega como `estado: 429` en body con HTTP 200.
- **Ingestas históricas** (AEMET histórico, Open-Meteo): patrón incremental obligatorio — bronze comprueba la última fecha en silver y solo pide lo que falta (con solape de 1 mes o 30 días); silver se reescribe completo con dedupe keep-last `(clave, fecha)`. El histórico vive en silver; bronze solo acumula ventanas nuevas.
- AEMET diarios: ventanas máx. 6 meses por estación; mensuales 36 meses; todasestaciones 15 días. Coordenadas en DMS (`394924N`). Precipitación `Ip` → 0.0 mm.
- Open-Meteo archive (`daily=precipitation_sum`): gratuito sin key; 429 horario posible en IPs de datacenter → backoff con espera de 60s.

### Frontend (FASE II)

- **Framework**: Astro 5 con React islands (`client:load`).
- **Tema**: Tailwind `darkMode: "class"` con **light mode por defecto**. Botón ☀️/🌙 en el navbar.
- **Estado**: Nanostores atoms (`theme`, `locale`, `activeLayers`, `geojsonData`, `drawerOpen`, etc.) compartidos entre islas.
- **i18n**: ca (default) + es vía diccionarios propios en `web/src/lib/i18n/` (ver "Internacionalización ca/es"). TODO texto de UI pasa por `t()`/`useT()`; nada de strings es hardcodeadas en componentes.
- **Mapa**: Leaflet 1.9.4 vía CDN (nunca como módulo npm). Sin zoom nativo ni control de capas (se gestionan vía UI propia).
- **Tiles CARTO (2026-08-30)**: los basemaps de CARTO requieren API key desde 2026. URL: `https://{s}.basemaps.cartocdn.com/rastertiles/{light_all|dark_all}/{z}/{x}/{y}{r}.png?key=...`. La key se inyecta vía `PUBLIC_CARTO_API_KEY` (`.env` en dev, `.env.production` en build) y se lee con `import.meta.env.PUBLIC_CARTO_API_KEY` en `MapView.tsx`. Es visible en el navegador (inherente a tiles raster); opcionalmente restringirla por dominio en el panel de CARTO. Los ficheros `web/.env*` están **gitignored** — clonar `web/.env.production.example` y poner la key real (en el servidor: crear `web/.env.production` antes del build).
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
