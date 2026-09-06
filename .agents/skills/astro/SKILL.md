# Astro — pladi Frontend Skill

Astro 5 best practices for the pladi project frontend. Use when creating, editing, or debugging the `web/` directory.

## Project Conventions

- **Framework**: Astro 5 (static output) with React client islands for interactivity
- **Styling**: Tailwind CSS 3 via `@astrojs/tailwind`
- **State**: Nanostores for shared client state across React islands
- **Map**: Leaflet 1.9.4 loaded via CDN script tag (not npm module) to avoid SSR issues
- **API**: FastAPI backend at `http://localhost:8000/api/v1/mapa`

## Project Structure

```
web/
├── astro.config.mjs        # Astro config: react + tailwind integrations
├── tailwind.config.mjs      # Tailwind config
├── tsconfig.json            # TypeScript via astro/tsconfigs/strict
├── package.json
├── public/
└── src/
    ├── layouts/
    │   └── MainLayout.astro  # Base layout: Inter font, dark theme
    ├── components/
    │   ├── Navbar.astro       # Fixed glass navbar (44px)
    │   ├── Footer.astro       # Fixed footer (36px)
    │   ├── MapView.tsx        # React island: fullscreen Leaflet map
    │   ├── LayerPanel.tsx     # React island: collapsible layer toggles
    │   └── Drawer.tsx         # React island: feature detail slide-out
    ├── pages/
    │   ├── index.astro        # Home: map + layer panel + drawer
    │   ├── dashboards.astro   # Placeholder
    │   └── simulacion.astro   # Placeholder
    ├── lib/
    │   ├── api.ts             # FastAPI client + layer metadata
    │   └── store.ts           # Nanostores: layer state, drawer state
    ├── styles/
    │   └── global.css         # Tailwind directives + Leaflet dark popup
    └── types.d.ts
```

## Key Design Decisions

1. **Map is React island with `client:load`** — All Leaflet code lives in MapView.tsx, loaded dynamically via CDN script tag to avoid SSR hydration errors with the `window` object.

2. **Nanostores bridge Astro ↔ React** — Shared state (active layers, loading, drawer) is managed via nanostores atoms. React islands subscribe via `useStore()`.

3. **Layer toggle flow**: User clicks switch → `toggleLayer(id)` in store.ts fetches GeoJSON from FastAPI → stored in `geojsonData` atom → MapView reacts and adds/removes Leaflet layer.

4. **Popup → Drawer flow**: Click on map feature → popup HTML button dispatches `pladi:feature-detail` custom event → MapView's event handler decodes properties → updates drawer stores → Drawer slides in.

## Styling

- **Theme**: Dark mode (`bg-[#09090b]`, `text-zinc-200`)
- **Glassmorphism**: `bg-zinc-950/70`, `backdrop-blur-lg`, `border-zinc-800/40`
- **Typograpy**: Inter (Google Fonts), loaded in MainLayout
- **Color palette**: Blue (#3b82f6), Green (#22c55e), Violet (#a855f7), Amber (#f59e0b) for layer indicators

## Commands

```bash
cd web
npm run dev          # Development server (http://localhost:4321)
npm run build        # Production build to dist/
npm run preview      # Preview production build
npx astro check      # Type-check
```

## .env (optional)

```bash
PUBLIC_PLADI_API_URL=http://localhost:8000/api/v1/mapa
```

## Common Issues

1. **Leaflet SSR errors**: Never import `leaflet` package directly (CJS/ESM). Always load via CDN script tag in a `client:load` React island.

2. **State not updating across islands**: Ensure nanostores atoms are subscribed with `useStore()`. Calling `.set()` on an atom triggers re-render in all subscribers.

3. **map functions undefined**: MapView defines all Leaflet functions on `window` after CDN script loads. Check browser console for script load errors.

## References

- Astro docs: https://docs.astro.build/
- Astro + React: https://docs.astro.build/en/guides/integrations-guide/react/
- Nanostores: https://github.com/nanostores/nanostores
- Leaflet: https://leafletjs.com/reference.html
- Tailwind CSS 3: https://tailwindcss.com/docs
