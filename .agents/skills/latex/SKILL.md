---
name: latex
description: LaTeX best practices for the pladi TFM memoria. Use when writing, editing, compiling, or debugging the `memoria/` directory (main.tex, MUXLaTeX.cls, Capitulos/, Anexos/, biblio.bib). Covers the UCM MUXLaTeX template, pdflatex + BibTeX workflow, the 20-page content limit, figures/tables helpers, and Spanish-language gotchas.
---

# LaTeX — Memoria TFM pladi

Guía para trabajar con la memoria en LaTeX del TFM *pladi*. Todo vive en
`memoria/` (gitignored temporalmente).

## Pila técnica (NO cambiar sin avisar)

- **Clase**: `MUXLaTeX.cls` (plantilla oficial UCM, adaptada para la FEE).
- **Motor**: `pdflatex` (la clase usa `mathpazo` y logos PNG/JPG — no usar
  xelatex/lualatex ni biber).
- **Bibliografía**: **BibTeX clásico** con estilo `IEEEtran`, desde `biblio.bib`.
  Citar con `\cite{clave}`. NO usar `biblatex`/`biber`.
- **Idioma**: `babel` con `spanish` cargado; escribe tildes/ñ UTF-8 directas.
- **Compilar**: `make pdf` (pdflatex → bibtex → pdflatex ×2). `make clean` borra
  auxiliares.

## Estructura

```
memoria/
├── main.tex           # Raíz: \maquetacion{...} + \input de capítulos + \bibliografia
├── MUXLaTeX.cls       # Clase adaptada (portada FEE, MADRID 2026, tutor opcional)
├── biblio.bib         # BibTeX (IEEEtran)
├── Capitulos/         # capitulo01..06.tex — UN fichero por capítulo
├── Anexos/            # resumen.tex (resumen+abstract+keywords), anexos.tex
├── LOGOS/             # logos UCM que usa la portada (no tocar rutas)
├── figures/           # imágenes para \figura / \figuras
└── template/          # MUXLaTeX original + docs oficiales FEE (referencia)
```

## Reglas de la memoria

1. **Límite 20 páginas**: aplica SOLO a los capítulos 1–6 (contenido).
   Portada, índice, resumen/abstract, bibliografía, anexos y dedicatoria NO
   cuentan. Sé conciso en el contenido.
2. **Capítulo = fichero**: cada capítulo es un `\chapter{...}` en su propio
   `Capitulos/capitulo0N.tex`. Las secciones usan `\section{...}`.
3. **Bibliografía (7) y Anexos (8)** no son capítulos: la bibliografía sale de
   `\bibliografia` (biblio.bib) y los anexos de `Anexos/anexos.tex`
   (`\chapter*` sin numerar).
4. Añadir un capítulo nuevo implica: crear el `.tex` y añadir su
   `\input{...}` en `main.tex` ANTES de `\bibliografia`.

## Figuras y tablas

La clase define helpers (NO usar `\includegraphics` suelto):

```latex
\figura{figures/arquitectura.png}{0.8}{Caption de la figura}   % ancho en fracción de \textwidth
\figuras{figures/a.png}{figures/b.png}{Caption para ambas}     % dos figuras lado a lado
```

- Guarda las imágenes en `figures/` y referencia rutas relativas a `main.tex`.
- `\indicefiguras{si}` / `\indicetablas{no}` en `main.tex` activan los listados.

## Gotchas

- Si cambias `biblio.bib`, hay que recompilar con bibtex (`make pdf` ya lo hace).
- Errores de "There's no line here to end" en la portada suelen venir de pasar
  `\direccion{...}` sin tutor: usa `\direccion{no}{no}{no}` (la clase ya está
  adaptada para omitir "Dirigido por").
- El `\chapter*` manual necesita `\addcontentsline{toc}{chapter}{...}` para
  aparecer en el índice (ver `Anexos/resumen.tex` y `Anexos/anexos.tex`).
- No reordenes `LOGOS/` ni cambies los nombres de archivo: la clase los
  referencia con rutas fijas.
- `template/muxlatex/` es la plantilla original intacta; no la uses para editar.

## Cómo compilar

```bash
cd memoria
make pdf      # genera main.pdf
make clean    # elimina auxiliares + pdf
```

Sin TeX instalado aún: `sudo apt install texlive-full`.
