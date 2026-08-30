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
| Jupyter | 8888 | ✅ | Notebooks FASE VII (acceso por SSH tunnel) |
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
| `gold.censo_municipal_baleares` | `(cod_municipio_ine, anio)` | cod_provincia_ine, nombre_provincia, cod_municipio_ine, nombre_municipio, anio, poblacion |
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
| FASE VI — Despliegue real | ✅ Completada — VPS en producción |
| FASE VII — Modelos + data science | 🚧 Notebooks de experimentos creados y ejecutados (2026-08-30); pendiente UI `/simulacion` |

---

## Dashboards y analítica (FASE IV — ✅ 2026-08-15, ampliada con infiltración y balance)

### Backend — `api/routers/analytics.py`

| Endpoint | Contenido |
|---|---|
| `GET /api/v1/analytics/resumen?isla=&municipio=` | KPIs: infiltración AH total del ámbito + desviación, IPH pico, ocupación (Baleares = media de islas), población, consumo, masas en déficit |
| `GET /api/v1/analytics/infiltrada?isla=&masa=` | Serie mensual hm³ (suma por ámbito o por masa) + media de referencia (2015-25) |
| `GET /api/v1/analytics/infiltrada/ranking?isla=` | Desviación % AH por masa |
| `GET /api/v1/analytics/balance?nivel=masa|ud&isla=&entidad=` | Serie anual del balance por masa/UD/isla (sumas, explotación ponderada, conteos de estado) |
| `GET /api/v1/analytics/balance/ranking?nivel=&isla=&anio=` | Ranking por masa/UD del año indicado (default último disponible) |
| `GET /api/v1/analytics/abastecimiento?isla=&municipio=` | Anual por origen + top municipios |
| `GET /api/v1/analytics/presion?isla=` | IPH mensual + media + **población censal anual por serie NUTS** |
| `GET /api/v1/analytics/ocupacion?isla=&tipo=&municipio=` | Ocupación mensual (Baleares = media de las islas) |
| `GET /api/v1/analytics/ocupacion/ranking?isla=&anio=&tipo=` | Ranking de municipios por ocupación media anual (solo con datos) |
| `GET /api/v1/analytics/uds?isla=` / `municipios?isla=` / `masas?isla=` | Catálogos para SearchSelect |
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
- `PUBLIC_PLADI_API_URL=/api/v1` en `web/.env.production` (Caddy proxys `/api/*` → FastAPI; dev usa `http://localhost:8000/api/v1`).

### Notas técnicas

- `web/src/lib/api.ts` — cliente analítico (`fetchResumen`, `fetchInfiltrada`, `fetchInfiltradaRanking`, `fetchBalance`, `fetchBalanceRanking`, `fetchUds`, `fetchMasas`, `fetchMunicipios`, `fetchAbastecimiento`, `fetchPresion`, `fetchOcupacion`, `fetchEntidad`).
- `web/src/lib/store.ts` — atoms `dashIsla`, `dashVista` y `entidad*` (drawer).
- Errores comunes SQL con asyncpg: `round(double, int)` no existe → `::numeric`; ids enteros (`id_unidad_demanda`) como int; decimal.Decimal → `float()` antes de dividir.

### Identidad y responsive (2026-08-15)

- **Logo**: icono de capas (bronze/silver/gold) en navbar + **favicon.svg** (pestaña del navegador).
- **Responsive completa** (iPhone SE 320px → iPad): labels del navbar ocultas en móvil, footer con scroll horizontal, selector de islas con scroll, sidebar móvil con backdrop, panel de capas auto-colapsado <640px, KPI cards 1 col <360px, desglose sin % en xs, tooltips con soporte tap, `:focus-visible` global, leyendas de charts compactas en móvil.

### Turismo — IPH vs población y ranking de ocupación (2026-08-15)

- **DashboardPresion**: KPI "IPH pico vs población" (ratio `×2,1` + desglose IPH/población) y líneas discontinuas de **población censal anual** bajo el IPH (modo isla y Baleares). El IPH es a nivel NUTS: **Eivissa i Formentera van juntas** (sin estimaciones).
- **DashboardOcupacion**: ranking top 5 / bottom 5 de municipios (media anual del año `hasta` del rango, respeta el toggle de tipo, nota "solo municipios con datos" — 26 de 67 tienen turismo).
- **Drawer municipio**: sin card de infiltración; ocupación = media 12 meses + pico mensual + sparkline con **ventana propia del municipio** (fix: Alaior acaba en 2025-09 y Sant Joan de Labritja en 2024-10, el corte global los dejaba vacíos).
- **EmptyState** (borde discontinuo + icono + texto contextual) para entidades sin datos: municipios sin turismo, masas/UDs sin balance, vista Ocupación sin datos; leyenda del mapa con "Sin dato" (gris); KpiBlocks con sub explicativo en vez de `—`.

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

## Simulación (FASE VII — 🚧 en desarrollo — notebooks creados 2026-08-30)

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
├── 07_censo.ipynb              # EDA censo 2021-2025 (NO entra como feature en v1)
├── 08_panel_features.ipynb     # TABLÓN ANALÍTICO: panel único + outliers (MAD) + correlaciones + preprocessing documentado
├── 10_baseline.ipynb           # 6 baselines TS: naive, media, ETS/Holt, GB temporal, auto-ARIMA, regla_negocio DGRH
├── 11_modelo_municipio.ipynb   # GB por municipio (67 modelos) → serializa models/municipio/*.joblib + metadata.json
├── 12_modelo_panel_gbm.ipynb   # GB global con one-hot de municipio
├── 13_modelo_panel_regularizado.ipynb  # Ridge/Lasso panel (alpha por CV)
├── 14_interpretabilidad.ipynb  # SHAP global+por municipio + elasticidades reales → results/elasticidades.csv + models/elasticidades.json
└── 20_comparativa.ipynb        # une results/*.csv + walk-forward de estabilidad
```

### Tablón analítico (`08_panel_features`) — patrón "feature store" del protocolo

- **Punto único** de construcción del panel municipio x año (2015+); 11/12/13/20 lo **leen** de `data/panel_features.parquet` + `panel_metadata.json` (features finales, decisiones documentadas).
- **Outliers**: detección por MAD (>3) — se mantienen (eventos reales: sequías, restricciones).
- **Correlaciones**: `iph_max` eliminada (|r| > 0.85 con `iph_media`). Features finales: `anio, iph_media, ocupacion_media, lluvia_anual_mm, lag1` (lag1 = consumo del año anterior, serie completa 2000-2024).
- Diccionario de features y "recommended preprocessing" documentados en el propio notebook.

### Entorno Jupyter (Docker)

- Servicio `jupyter` en `docker/jupyter/` (base `jupyter/base-notebook` + polars, sklearn, statsmodels, pmdarima, seaborn, shap, joblib). Puerto `127.0.0.1:8888`, volúmenes `../../notebooks:/home/jovyan/work` y `../../models:/home/jovyan/models`, `restart: unless-stopped`.
- **Acceso** (mismo patrón que Airflow/MinIO): `ssh -L 8888:localhost:8888 root@169.58.169.55` → `http://localhost:8888?token=<JUPYTER_TOKEN de docker/.env>`.
- `notebooks/data/`, `.venv` y `models/` gitignored; `results/` se commitea (métricas pequeñas).

### Modelos serializados (`models/` en raíz, gitignored)

- `models/municipio/{cod_municipio}.joblib` — 67 GB entrenados (notebook 11) + `models/metadata.json` (features, params, base_anio, MAPE por municipio) + `models/elasticidades.json`.
- Patrón de despliegue: `models/` montado en jupyter (rw) y, cuando exista el endpoint real, en fastapi (ro) — igual que `data/` con postgis/airflow. Reentrenamiento manual desde 11; versionado futuro vía MinIO/MLflow.

### Diseño del experimento (actualizado 2026-08-30 v2)

- **Objetivo**: predecir el consumo urbano **anual** por municipio (hm³). Target: `gold.abastecimiento_urbano_baleares` (2000-2024, 67 series completas).
- **Features (v2)**: `anio`, `iph_media`, `ocupacion_media`, `lluvia_anual_mm`, `lag1`. ~~Temperatura media anual (AEMET)~~ → **fuera**: el gold solo tiene precipitación. `iph_max` fuera por correlación.
- **Ventana**: 2015-2024 para modelos con features (limitada por lluvia); baselines usan historia completa. Split temporal: train < 2022, test 2022-2024 (predicción recursiva, lag actualizado con la predicción).
- **Resultados (MAPE medio test 2022-2024)**:
  - `gb_municipio` **8,7%** (ganador) > `regla_negocio` 10,2% > naive 11,6% ≈ ets 11,7% ≈ gb_temporal 11,7% > arima 12,2% > ridge 13,5% > media 17,8% > gb_panel 25,9% > lasso 29,8%.
  - **Regla de negocio** (heurística DGRH: Δconsumo = 0,3 × ΔIPH isla) queda **segunda** — muy cerca del modelo; justifica el ML solo con el delta de 1,5 pp + interpretabilidad.
  - **Walk-forward** (1 año, ventanas 2021-2024): gb_municipio estable (MAPE 6,2-7,5%) pero naive gana 2 de 4 ventanas — la ventaja del modelo es modesta y honesta.
  - **Elasticidades reales** (14_interpretabilidad, perturbación ±10%): IPH **0,093**, ocupación **≈0**, lluvia **−0,017** — el consumo es muy inercial (lag1 domina el SHAP). Estas cifras están cableadas al mock de /simulacion.
  - **Ablación de configuración (2026-08-30)** — por qué el modelo usa `iph_max` y train desde 2016:
    | Config | MAPE |
    |---|---|
    | **v1 (con `iph_max`, train 2016+)** | **8,7%** |
    | con `iph_max`, train 2015+ | 9,1% |
    | sin `iph_max`, train 2016+ | 8,9% |
    | sin `iph_max`, train 2015+ (v2) | 9,3% |
    → `iph_max` se conserva pese a |r|>0,85 con `iph_media` (la regla de correlación del protocolo es estética; aporta +0,2 pp) y 2015 se excluye del train (aporta ruido: +0,4 pp). Documentado también en `08_panel_features`.
- **Interpretabilidad**: SHAP global + por municipio representativo (Palma 07040, Calvià 07011, Sineu 07060) en 14_interpretabilidad.

### UI `/simulacion` (diseñada 2026-08-30 — frontend con API mock)

- **Layout 2 paneles**: izquierda "PanelEscenarios" (340px), derecha resultados. Header con punto violeta (`#a855f7`) y pills de isla (patrón dashboards). Responsive: panel encima en móvil.
- **Panel de escenarios** (`web/src/components/simulacion/`): ámbito (isla + SearchSelect municipio), horizonte (2026-2035), sliders % (−30..+30) de IPH / ocupación turística / lluvia (con presets Año seco −30 / Normal / Año húmedo +30). **2 escenarios fijos** (rediseño 2026-08-30): **Tendencial** (inercia + tendencia, sin cambios) y **Mayor presión humana** (editable, defaults IPH +20 · ocupación +10). Sin nombres editables. Los sliders muestran el efecto medido del modelo (IPH 0,13 · ocupación ≈0 · lluvia ≈−0,02) — por eso no hay escenario de sequía (la lluvia apenas mueve el consumo urbano; su dominio es el balance hídrico). Chip ámbar si |Δ| > 25 (fuera del rango de entrenamiento). Tooltips: IPH NUTS (Eivissa+Formentera juntas), ocupación sin efecto en municipios sin turismo.
- **Resultados** (`ResultadosSimulacion.tsx`): 4 KpiCards (consumo proyectado + Δ% vs base, consumo base, variación media anual, sensibilidad IPH), ComposedChart Recharts (histórico sólido + proyecciones dashed por escenario + area de incertidumbre; lo/hi en tooltip), ranking top/bottom 5 municipios por Δ%, tabla municipal completa con pills de escenario.
- **Mock**: `PUBLIC_SIMULACION_MOCK=true` (`.env` y `.env.production`) → `web/src/lib/simulacionMock.ts`. Histórico **real** vía `fetchAbastecimiento` (fallback sintético si la API cae); proyecciones deterministas (seed por municipio·escenario) con **elasticidades reales del modelo** (IPH 0,128 · ocupación ≈0 · lluvia −0,019, medidas en `14_interpretabilidad`), banda ±MAPE que se ensancha con el horizonte; tabla municipal con nombres reales de `fetchMunicipios`.
- **Contrato API real (pendiente)**: `GET /api/v1/simulacion/consumo?isla=&municipio=&hasta=&escenarios=[{id,nombre,iph_pct,ocupacion_pct,lluvia_pct}]` → `{ambito, base_anio, serie_historica, escenarios:[{id,nombre,color,proyeccion[{anio,consumo_hm3,lo,hi}],kpis}], municipios:{escenarioId:[{cod,nombre,isla,base_hm3,proy_hm3,delta_pct}]}}`. Cuando exista: quitar el flag mock y conectar. El backend cargará los 67 modelos joblib de `models/municipio/` (volumen compartido, montar ro en fastapi; reentrenamiento manual desde el notebook 11).
- **Pendientes v2**: cruzar la simulación con el balance hídrico (consumo → extracción → masas en déficit); bandas de incertidumbre reales del modelo (no ±MAPE fijo).

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
- **Estado**: Nanostores atoms (`theme`, `activeLayers`, `geojsonData`, `drawerOpen`, etc.) compartidos entre islas.
- **Mapa**: Leaflet 1.9.4 vía CDN (nunca como módulo npm). Sin zoom nativo ni control de capas (se gestionan vía UI propia).
- **Tiles CARTO (2026-08-30)**: los basemaps de CARTO requieren API key desde 2026. URL: `https://{s}.basemaps.cartocdn.com/rastertiles/{light_all|dark_all}/{z}/{x}/{y}{r}.png?key=...`. La key se inyecta vía `PUBLIC_CARTO_API_KEY` (`.env` en dev, `.env.production` en build) y se lee con `import.meta.env.PUBLIC_CARTO_API_KEY` en `MapView.tsx`. Es visible en el navegador (inherente a tiles raster); opcionalmente restringirla por dominio en el panel de CARTO. Los ficheros `web/.env*` están **gitignored** — clonar `web/.env.production.example` y poner la key real (en el VPS: crear `web/.env.production` antes del build).
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
