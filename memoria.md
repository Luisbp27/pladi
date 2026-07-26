memoria.md

ingestas con polars y delta lake:
- dgrh: abastecimiento urbano
- aemet: lluvia acumulada
- ibestat: censo
- ideib: municipios, pozos, masas

visualizaciones/frontales:
- mapa
- dashboards
- simulacion

tecnologia:
- docker: todo con contenedores
- bbdd: postgis
- api: fastapi --> tanto para servir el modelo como para hacer la conexion entre front y back en cuanto a datos
- etl: apache airflow, python, delta y polars
- datalake: minio
- front: reflex

FASE I: Montar toda la arquitectura
FASE II: Diseñar 3 frontales
FASE III: Implementar ingestas y poblar bbdd
FASE IV: Desarrollar modelos + data science
FASE V: Desarrollar frontal
FASE VI: Despliegue en entorno real