# pladi — Memoria del proyecto

## Arquitectura (FASE I — ✅ completada)

### Servicios dockerizados

| Servicio | Puerto | Estado | Descripción |
|---|---|---|---|
| PostGIS | 5432 | ✅ | 9 tablas de dimensiones pobladas |
| MinIO | 9000 / 9001 | ✅ | Datalake con buckets bronze/silver/gold |
| Airflow | 8080 | ✅ | LocalExecutor, conexiones a MinIO y PostGIS |
| FastAPI | 8000 | ✅ | `/api/v1/health`, hot reload, código en `/api/` |
| Reflex | — | ❌ | Frontend (FASE V) |
| Spark | — | ❌ | Procesamiento distribuido (opcional) |

### Estructura de carpetas
```
pladi/
├── api/               # Código FastAPI (main.py, config.py, routers/)
├── data/
│   ├── postgis_dgrh/  # CSVs de dimensiones (9 tablas)
│   └── abastecimiento_urbano/
├── docker/
│   ├── .env           # Variables de entorno globales
│   ├── docker-compose.yml  # Orquestador raíz (include)
│   ├── postgis/       # docker-compose + init SQL
│   ├── minio/         # docker-compose
│   ├── airflow/       # Dockerfile, dags/, plugins/, init
│   └── fastapi/       # Dockerfile, requirements.txt
├── docs/
│   └── schema.dbml    # Modelo de datos normalizado (DBML)
├── sql/
│   ├── dgrh_bbdd_postgis.sql  # DDL (9 tablas)
│   └── load_data.sql          # Carga de CSVs con geometrías
└── memoria.md
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

| Bucket | Uso |
|---|---|
| bronze | Datos crudos de ingestas |
| silver | Datos limpios / transformados |
| gold | Datos agregados para dashboards y modelo |

---

## Ingestas (FASE III — ❌ pendiente)

| Fuente | Dato | Formato | Destino bronze |
|---|---|---|---|
| DGRH | Abastecimiento urbano | Excel → Delta | MinIO |
| AEMET | Lluvia acumulada | API → Delta | MinIO |
| IBESTAT | Censo / población | CSV → Delta | MinIO |
| IDEIB | (ya cargado en PostGIS) | WFS → Delta | — |

> Los DAGs de Airflow están por desarrollar en `docker/airflow/dags/`

---

## Fases pendientes

| Fase | Estado |
|---|---|
| FASE I — Arquitectura | ✅ Completada |
| FASE II — Diseño de frontales | ❌ |
| FASE III — Ingestas + poblar BBDD | ❌ |
| FASE IV — Modelos + data science | ❌ |
| FASE V — Frontend (Reflex) | ❌ |
| FASE VI — Despliegue real | ❌ |
