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
cd web && npm run build  # → web/dist/
```
