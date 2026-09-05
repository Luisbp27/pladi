# Agents — pladi web/

Este proyecto usa la skill **astro** para el frontend. Las instrucciones de desarrollo están en `.agents/skills/astro/SKILL.md`.

## Stack

- **Astro 5** — Static site generation
- **React 19** — Client islands for interactive components
- **Tailwind CSS 3** — Utility-first styling via `@astrojs/tailwind`
- **Nanostores** — Lightweight client state shared across islands
- **Leaflet 1.9.4** — Map loaded via CDN in `MapView.tsx` (client:load)

## Convenciones

- Los componentes interactivos son `.tsx` con directiva `client:load`
- Los componentes estáticos son `.astro`
- El estado compartido va en `src/lib/store.ts` (nanostores atoms)
- Las llamadas a la API en `src/lib/api.ts`
- Leaflet **nunca** se importa como módulo npm — siempre vía CDN

## Cómo arrancar

```bash
cd web && npm run dev    # → http://localhost:4321
```

## Cómo build

```bash
cd web && npm run build        # build de verificación (carga .env según modo)
cd web && npm run build:prod   # build de producción (fuerza PUBLIC_PLADI_API_URL=/api/v1)
```

## ⚠️ Producción sirve `web/dist` EN VIVO

Caddy monta `../web/dist` como `read-only` (`docker/docker-compose.yml`) y lo sirve
en `pladi.dadesbalears.es` **sin pasos intermedios**: cada `npm run build` sobreescribe
la web pública al instante.

- Para probar contra la API local usa `npm run dev` (no toca `dist`) o un build con
  `PUBLIC_PLADI_API_URL=http://localhost:8000/api/v1 npm run build`.
- Si haces un build de verificación con la URL local, termina SIEMPRE con
  `npm run build:prod` y comprueba que `grep -r "localhost:8000" dist/` no devuelve nada.
